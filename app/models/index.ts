import { Sequelize, Dialect } from "sequelize";
import dbConfig from "../config/db.config";
import defineUserModel from "./users.model";
import defineMirrorModel from "./mirrors.model";

// Ensure dbConfig conforms to the DBConfig interface
const config = dbConfig;

// Initialize Sequelize instance
const sequelize = new Sequelize(config.DB as string, config.USER as string, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,
  logging: false,
  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.acquire,
    idle: config.pool.idle,
  },
  dialectOptions: {
    connectTimeout: 30000,
  },
  port: config.PORT
});

// Initialize models and database object
const db: {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
  users: ReturnType<typeof defineUserModel>;
  mirrors: ReturnType<typeof defineMirrorModel>;
} = {
  Sequelize,
  sequelize,
  users: defineUserModel(sequelize),
  mirrors: defineMirrorModel(sequelize)
};

// Define models
db.users = defineUserModel(sequelize);
db.mirrors = defineMirrorModel(sequelize);

// Export the database object
export default db;
