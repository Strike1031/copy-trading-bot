import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import db from "./app/models"; // Ensure models/index.ts exports sequelize properly
import apiRoutes from "./app/routes/api.routes"; // Ensure api.routes.ts exports a function

dotenv.config();

const app: Application = express();
const server = http.createServer(app);

// CORS Options
const corsOptions = {
  origin: "*",
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
db.sequelize
  .sync()
  .then(() => {
    console.log("Synced db.");
  })
  .catch((err: Error) => {
    console.error("Failed to sync db:", err.message);
  });

// Test Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json("success");
});

// Routes
apiRoutes(app);

// Set port and start server
const PORT: number = parseInt(process.env.PORT || "5000", 10);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
