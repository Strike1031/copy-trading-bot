import { Request, Response } from "express";
import { btoa } from "buffer";
import { Sequelize } from "sequelize";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import base58 from 'bs58';
import db from "../models/index";
const User = db.users;
const Mirror = db.mirrors;

import {
  Keypair,
  PublicKey,
  Connection,
  Transaction,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { sendRequest, cancelRequest } from "../../trading";
import WebSocket from 'ws';

const connection = new Connection(process.env.RPC_ENDPOINT!);
const ws = new WebSocket(process.env.RPC_WEBSOCKET_ENDPOINT!);


// Helper function to create a Solana wallet
const createSolanaWallet = (): { publicKey: string; privateKey: string } => {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toString(),
    privateKey: Buffer.from(keypair.secretKey).toString("base64"),
  };
};

export default {
  // Get user info
  async getUserInfo(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      let user = await User.findOne({ where: { userId } });

      if (!user) {
        const { publicKey, privateKey } = createSolanaWallet();
        user = await User.create({ userId, publicKey, privateKey });
      }

      res.json(user.publicKey);
    } catch (error) {
      res.status(500).json({ error: "Error", message: (error as Error).message });
    }
  },

  // Withdraw funds
  async withdraw(req: Request, res: Response): Promise<void> {
    const { userId, amount, withdrawAddress } = req.body;

    try {
      const user = await User.findOne({ where: { userId } });
      if (!user) {
        res.status(404).send("User not found");
        return;
      }

      const connection = new Connection(process.env.SOLANA_RPC || clusterApiUrl("mainnet-beta"), "confirmed");

      const secretKeyBuffer = Buffer.from(user.privateKey!, "base64");
      const fromWallet = Keypair.fromSecretKey(secretKeyBuffer);

      // const fromWallet = Keypair.fromSecretKey(Buffer.from(user.privateKey!, "base64"));
      const toPublicKey = new PublicKey(withdrawAddress);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromWallet.publicKey,
          toPubkey: toPublicKey,
          lamports: amount * 1e9, // Convert amount to lamports
        })
      );

      const signature = await connection.sendTransaction(transaction, [fromWallet]);
      res.json({ success: true, signature });
    } catch (error) {
      console.error("Error withdrawing SOL:", error);
      res.status(500).send("Error processing withdrawal");
    }
  },

  // Add a mirror entry
  async addMirror(req: Request, res: Response): Promise<void> {
    const { userId, mirrorAddress } = req.body;

    if (!userId || !mirrorAddress) {
      res.status(400).json({ error: "userId and mirrorAddress are required" });
      return;
    }

    try {
      const user = await User.findOne({ where: { userId } });
      if (!user) {
        res.status(404).send("User not found");
        return;
      }

      const existMirror = await Mirror.findOne({ where: { userId, mirrorAddress } });
      if (existMirror) {
        res.status(400).json({ error: "It already exists" });
        return;
      }

      await Mirror.create({ userId, mirrorAddress });
      res.json({ success: true });

      // Retrieve the private key for the user from the database
      const privateKeyBase58 = user.privateKey; // Assuming `privateKey` is stored in the User table
      if (!privateKeyBase58) {
        console.error(`No private key found for userId: ${userId}`);
        return;
      }

      const secretKeyBuffer = Buffer.from(privateKeyBase58, "base64");
      const keyPair = Keypair.fromSecretKey(secretKeyBuffer);
      // const keyPair = Keypair.fromSecretKey(base58.decode(privateKeyBase58));

      // Call the sendRequest function to start copy trading
      await sendRequest(mirrorAddress, keyPair, connection, ws);
      console.log(`Copy trading initiated for userId: ${userId}, mirrorAddress: ${mirrorAddress}`);

    } catch (error) {
      console.error("Error adding mirror:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // Remove a mirror entry
  async removeMirror(req: Request, res: Response): Promise<void> {
    const { userId, mirrorAddress } = req.body;

    if (!userId || !mirrorAddress) {
      res.status(400).json({ error: "userId and mirrorAddress are required" });
      return;
    }

    try {
      const user = await User.findOne({ where: { userId } });
      if (!user) {
        res.status(404).send("User not found");
        return;
      }

      const mirror = await Mirror.findOne({ where: { userId, mirrorAddress } });

      if (!mirror) {
        res.status(404).json({ error: "Mirror entry not found" });
        return;
      }

      await mirror.destroy();
      res.json({ success: true, message: "Mirror removed successfully" });

      // Retrieve the private key for the user from the database
      const privateKeyBase58 = user.privateKey; // Assuming `privateKey` is stored in the User table
      if (!privateKeyBase58) {
        console.error(`No private key found for userId: ${userId}`);
        return;
      }

      const secretKeyBuffer = Buffer.from(privateKeyBase58, "base64");
      const keyPair = Keypair.fromSecretKey(secretKeyBuffer);
      await cancelRequest(mirrorAddress, keyPair, connection, ws);
    } catch (error) {
      console.error("Error removing mirror:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
