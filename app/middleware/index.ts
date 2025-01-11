import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";

dotenv.config();

// Extend Express Request to include `userId`
interface CustomRequest extends Request {
  userId?: string;
}

function verifyToken(req: CustomRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization;

  if (!token) {
    console.log("token", req);
    res.status(403).json({ message: "Failed", data: "none" });
    return; // Explicitly return to stop further execution
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY || "", (err, decoded) => {
    if (err) {
      console.log(err);
      res.status(401).json({ message: "Failed" });
      return; // Explicitly return to stop further execution
    }

    // Ensure the decoded token has a userId
    if (typeof decoded === "object" && decoded.userId) {
      req.userId = decoded.userId;
    }

    next();
  });
}

export default verifyToken;
