import { Sequelize, Model, Optional, DataTypes } from "sequelize";

// Define the Mirror model attributes
interface MirrorAttributes {
  id?: number; // Primary key (optional because it's auto-incremented)
  userId: string; // User ID
  mirrorAddress: string; // Mirror address
}

// Define optional attributes for creation
interface MirrorCreationAttributes extends Optional<MirrorAttributes, "id"> {}

// Extend Sequelize's Model class
class Mirror extends Model<MirrorAttributes, MirrorCreationAttributes> implements MirrorAttributes {
  public id?: number; // Primary key (optional because it's auto-incremented)
  public userId!: string; // User ID
  public mirrorAddress!: string; // Mirror address
}

// Export a function that initializes the model
export default (sequelize: Sequelize): typeof Mirror => {
  Mirror.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mirrorAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Mirror",
      tableName: "mirrors", // Explicit table name
      timestamps: false, // Disable timestamps if not required
    }
  );

  return Mirror;
};
