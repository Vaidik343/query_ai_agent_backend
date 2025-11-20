const { FoodReport } = require('../models/index');
const { sequelize } = require("../models");
const { parseAndBuild } = require('../utils/queryParser');
// ---------------------------------------------
//  Main Controller
// ---------------------------------------------
// src/controllers/queryController.js

const runQuery = async (req, res) => {
  try {
    const { labId, prompt } = req.body;
    if (!labId || !prompt) return res.status(400).json({ error: 'labId and prompt required' });

    console.log('🔥 parser run:', { labId, prompt });

    const built = parseAndBuild(labId, prompt);
    if (!built || !built.success) {
      return res.status(400).json({ error: built.error || 'Could not parse prompt' });
    }

    console.log('🟣 SQL:', built.sql);
    console.log('🔁 replacements:', built.replacements);

    // execute parameterized query
    const result = await sequelize.query(built.sql, {
      type: sequelize.QueryTypes.SELECT,
      replacements: built.replacements
    });

    // human readable short answer (basic)
    let answerText = '';
    if (/^select\s+count/i.test(built.sql) || /count\(/i.test(built.sql)) {
      const cnt = result[0] ? Object.values(result[0])[0] : 0;
      answerText = `Count: ${cnt}`;
    } else if (/avg/i.test(built.sql)) {
      const val = result[0] ? result[0].value ?? Object.values(result[0])[0] : null;
      answerText = val === null || val === undefined ? 'No data' : `Average: ${val}`;
    } else {
      answerText = `Returned ${result.length} rows.`;
    }

    return res.json({
      sql: built.sql,
      replacements: built.replacements,
      answerText,
      answerTable: result
    });

  } catch (error) {
    console.error('runQuery parser error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};



// ---------------------------------------------
// Helper → Strong SQL Cleanup
// ---------------------------------------------
// function cleanSQL(sql) {
//   return sql
//     .replace(/```sql/gi, "")
//     .replace(/```/g, "")
//     .replace(/^sql[\s:]/i, "")
//     .replace(/^SQL[\s:]/i, "")
//     .replace(/--.*/g, "")
//     .replace(/\bFoodReports\b/g, `"FoodReports"`)
//     .trim();
// }


// ---------------------------------------------
const getAllData = async (req, res) => {
  try {
    const data = await FoodReport.findAll();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
};

const getDataByLab = async (req, res) => {
  try {
    const { labId } = req.params;

    const data = await FoodReport.findAll({
      where: { lab_id: labId },
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lab data" });
  }
};

module.exports = { runQuery, getAllData, getDataByLab };
