import WebSocket from 'ws';
import { Metaplex } from "@metaplex-foundation/js";
import { PublicKey, Connection, Keypair } from '@solana/web3.js'
import { getMint, TOKEN_PROGRAM_ID, getAccount, NATIVE_MINT, getAssociatedTokenAddress } from '@solana/spl-token';

import { getAllTokenPrice, getTokenPrice } from "./trading/config";
import { getAtaList } from "./trading/utils/spl";
import { getBuyTxWithJupiter, getSellTxWithJupiter } from "./trading/utils/swapOnlyAmm";
import base58 from 'bs58'
import { RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, JUP_AGGREGATOR, TARGET_WALLET, MAXIMUM_BUY_AMOUNT } from './trading/constants';
import { execute } from './trading/utils/legacy';

// Create a WebSocket connection

const connection = new Connection(RPC_ENDPOINT)
// const ws = new WebSocket(RPC_WEBSOCKET_ENDPOINT);
// const keyPair = Keypair.fromSecretKey(base58.decode(process.env.PRIVATE_KEY as string));

const metaplex = Metaplex.make(connection);
let geyserList: any = []
// const wallet = TARGET_WALLET as string;
// console.log("🚀 ~ wallet:", wallet)

interface SwapInfo {
	tokenAta: string;
	tokenAmount: string;
}

interface TokenMetaData {
	tokenName: string;
	tokenSymbol: string;
	tokenLogo: string;
}

const getMetaData = async (mintAddr: string) => {
	let mintAddress = new PublicKey(mintAddr);

	let tokenName: string = "";
	let tokenSymbol: string = "";
	let tokenLogo: string = "";

	const metadataAccount = metaplex
		.nfts()
		.pdas()
		.metadata({ mint: mintAddress });

	const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

	if (metadataAccountInfo) {
		const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
		tokenName = token.name;
		tokenSymbol = token.symbol;
		//    @ts-ignore
		tokenLogo = token.json?.image;
	}

	return ({
		tokenName: tokenName,
		tokenSymbol: tokenSymbol,
		tokenLogo: tokenLogo,
	})
}

let tokenList: any;
tokenList = getAllTokenPrice()


export async function sendRequest(mirrorAddress: string, keyPair: Keypair, connection: Connection, ws: WebSocket): Promise<void> {

	let temp: any = []

	const pubkey: any = await getAtaList(connection, mirrorAddress);
	// console.log("🚀 ~ sendRequest ~ pubkey:", pubkey)

	for (let i = 0; i < pubkey.length; i++) if (!geyserList.includes(pubkey[i])) {
		geyserList.push(pubkey[i])
		temp.push(pubkey[i])
	}
	// const src = keyPair.secretKey.toString();

	// const accountInfo = await connection.getAccountInfo(keyPair.publicKey)

	// const tokenAccounts = await connection.getTokenAccountsByOwner(keyPair.publicKey, {
	// 	programId: TOKEN_PROGRAM_ID,
	// },
	// 	"confirmed"
	// )
	// console.log("🚀 ~ sendRequest ~ tokenAccounts:", tokenAccounts)

	const request = {
		jsonrpc: "2.0",
		id: 420,
		method: "transactionSubscribe",
		params: [
			{
				failed: false,
				accountInclude: temp
			},
			{
				commitment: "finalized",
				encoding: "jsonParsed",
				transactionDetails: "full",
				maxSupportedTransactionVersion: 0
			}
		]
	};

	if (temp.length > 0) {
		ws.send(JSON.stringify(request));
	}

	ws.on('message', async (data: WebSocket.Data) => {
		const messageStr = data.toString('utf8');
		try {
			if (messageStr == "") return;
			const messageObj = JSON.parse(messageStr);
			console.log("websocket messageObj----", messageObj);
			if (!messageObj?.params?.result) {
				console.log("Invalid message structure in the subscription: params or result missing.");
				return;
			}
			const result = messageObj.params.result;
			const logs = result.transaction.meta.logMessages;
			const signature = result.signature;
			const accountKeys = result.transaction.transaction.message.accountKeys.map((ak: { pubkey: string }) => ak.pubkey);

			// if (!messageStr.includes(JUP_AGGREGATOR!)) {
			//     console.log("Not a Jupiter swap");
			//     return;
			// }

			const tempAta: string[] = await getAtaList(connection, mirrorAddress);

			const swapInfo: SwapInfo[] = result.transaction.meta.innerInstructions.flatMap((instruction: any) => {
				return instruction.instructions
					.filter((inst: any) => inst.program === "spl-token" && inst.parsed?.type === "transfer")
					.map((inst: any) => ({
						tokenAta: inst.parsed.info.source,
						tokenAmount: inst.parsed.info.amount
					}));
			});

			if (swapInfo.length < 2) {
				console.log("Incomplete swap info");
				return;
			}

			const inputMsg = await Promise.all(swapInfo.slice(0, 2).map(async (ele: SwapInfo) => {
				const ataAccountInfo = await getAccount(connection, new PublicKey(ele.tokenAta));
				const mintAddress = ataAccountInfo.mint;

				const mintAccountInfo = await getMint(connection, mintAddress);
				const { decimals } = mintAccountInfo;

				const price = await getTokenPrice(mintAddress.toBase58());
				const { tokenName, tokenSymbol, tokenLogo } = await getMetaData(mintAddress.toBase58());

				return {
					...ele,
					tokenName,
					tokenSymbol,
					tokenLogo,
					mint: mintAddress.toBase58(),
					decimals: Number(decimals),
					uiAmount: Number(ele.tokenAmount) / (10 ** decimals),
					price: Number(price)
				};
			}));

			const msg = `Swap : ${inputMsg[0].tokenName} - ${inputMsg[1].tokenName}\nAmount :  ${inputMsg[0].uiAmount} ${inputMsg[0].tokenSymbol} - ${inputMsg[1].uiAmount} ${inputMsg[1].tokenSymbol}\nAmount in USD :  ${(inputMsg[0].uiAmount * inputMsg[0].price).toPrecision(6)} $ - ${(inputMsg[1].uiAmount * inputMsg[1].price).toPrecision(6)} $\nTx : https://solscan.io/tx/${signature}`;

			console.log("Swap message:", msg);

			const solBalance = await connection.getBalance(keyPair.publicKey);
			const remainingSolBalance = 0.01 * 10 ** 9;

			let swapTx;
			if (solBalance > remainingSolBalance) {
				swapTx = await getBuyTxWithJupiter(keyPair, new PublicKey(inputMsg[1].mint), Math.floor(solBalance - remainingSolBalance));
			} else {
				console.log("Insufficient balance");
				return;
			}

			if (swapTx) {
				const latestBlockhash = await connection.getLatestBlockhash();
				const txSig = await execute(swapTx, latestBlockhash, false);
				console.log("Transaction submitted:", `https://solscan.io/tx/${txSig}`);
			}
		} catch (error) {
			console.error("Error processing transaction:", error);
		}
	});

}


export async function cancelRequest(mirrorAddress: string, keyPair: Keypair, connection: Connection, ws: WebSocket): Promise<void> {

	let temp: any = []

	const pubkey: any = await getAtaList(connection, mirrorAddress);
	// console.log("🚀 ~ sendRequest ~ pubkey:", pubkey)

	for (let i = 0; i < pubkey.length; i++) if (!geyserList.includes(pubkey[i])) {
		geyserList.push(pubkey[i])
		temp.push(pubkey[i])
	}
	// const src = keyPair.secretKey.toString();

	// const accountInfo = await connection.getAccountInfo(keyPair.publicKey)

	// const tokenAccounts = await connection.getTokenAccountsByOwner(keyPair.publicKey, {
	// 	programId: TOKEN_PROGRAM_ID,
	// },
	// 	"confirmed"
	// )
	// console.log("🚀 ~ sendRequest ~ tokenAccounts:", tokenAccounts)

	const request = {
		jsonrpc: "2.0",
		id: 421,
		method: "transactionUnsubscribe",
		params: [
			{
				failed: false,
				accountInclude: temp
			},
			{
				commitment: "finalized",
				encoding: "jsonParsed",
				transactionDetails: "full",
				maxSupportedTransactionVersion: 0
			}
		]
	};

	if (temp.length > 0) {
		ws.send(JSON.stringify(request));
	}
}