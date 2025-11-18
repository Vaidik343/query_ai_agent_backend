require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

// Load Sequelize models (this loads sequelize instance automatically)
const { sequelize } = require("./models");

// Middlewares
app.use(express.json());
app.use(cors());

// test route
app.get("/", (req, res) => {
  res.send("home page");
});

// START SERVER
const PORT = process.env.PORT || 7000;

const startServer = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log("✅ Database Connected!");

    // Sync models
    await sequelize.sync({ alter: true });
    console.log("✅ Models Synced!");

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
  }
};

startServer();
