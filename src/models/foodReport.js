const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("FoodReport", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    lab_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    protein: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    fat: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    expiry: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
  }, {
    timestamps: false,
    createdAt: "created_at"
  });
};
