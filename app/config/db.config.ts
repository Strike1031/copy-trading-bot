import dotenv from "dotenv";
import { Dialect } from "sequelize";

// Load environment variables
dotenv.config();

// Define the database configuration interface
interface DBConfig {
  HOST: string | undefined;
  USER: string | undefined;
  PASSWORD: string | undefined;
  DB: string | undefined;
  dialect: Dialect;
  pool: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
  dialectOptions: {
    connectTimeout: number;
  };
  PORT: number | undefined
}

// Create the configuration object
const dbConfig: DBConfig = {
  HOST: process.env.DATABASE_HOST,
  USER: process.env.DATABASE_USER,
  PASSWORD: process.env.DATABASE_PASSWROD,
  DB: process.env.DATABASE_NAME,
  dialect: "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: 30000,
  },
  PORT: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : undefined,
};

export default dbConfig;