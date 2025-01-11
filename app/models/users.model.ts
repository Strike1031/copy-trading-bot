import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// Define the attributes for the User model
interface UserAttributes {
  id?: number; // Optional because it's auto-incremented
  userId: string; // Unique identifier for the user
  publicKey?: string; // Public key (optional)
  privateKey?: string; // Private key (optional)
}

// Define attributes required for creation
interface UserCreationAttributes extends Optional<UserAttributes, "id" | "publicKey" | "privateKey"> {}

// Extend Sequelize's Model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id?: number; // Auto-incremented ID
  public userId!: string; // Unique user ID
  public publicKey?: string; // Public key
  public privateKey?: string; // Private key
}

// Export a function to initialize the User model
export default (sequelize: Sequelize): typeof User => {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      publicKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      privateKey: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users", // Explicit table name
      timestamps: false, // Disable timestamps if not needed
    }
  );

  return User;
};
