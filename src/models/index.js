const sequelize = require("../config/db");
const FoodReport = require("./foodReport")(sequelize);

module.exports = {
  sequelize,
  FoodReport
};
