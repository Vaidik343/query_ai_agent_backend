const { sequelize, FoodReport } = require('../models');

async function seed() {
  try {
    // Authenticate connection
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Generate 100 sample data entries for FoodReport
    const sampleData = [];
    for (let i = 0; i < 100; i++) {
      sampleData.push({
        lab_id: Math.floor(Math.random() * 10) + 1, // Random lab_id between 1 and 10
        protein: parseFloat((Math.random() * 20 + 5).toFixed(1)), // Random protein between 5.0 and 25.0
        fat: parseFloat((Math.random() * 10 + 2).toFixed(1)), // Random fat between 2.0 and 12.0
        weight: parseFloat((Math.random() * 200 + 50).toFixed(1)), // Random weight between 50.0 and 250.0
        expiry: Math.floor(Math.random() * 500) + 100 // Random expiry between 100 and 600 days
      });
    }

    // Insert data
    await FoodReport.bulkCreate(sampleData);
    console.log('Sample data seeded successfully.');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

seed();
