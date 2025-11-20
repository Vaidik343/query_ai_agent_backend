const { FoodReport } = require('../models/index');
const { sequelize } = require("../models");
const { askGroq } = require("../utils/groqHelper"); // your groq helper

// ---------------------------------------------
//  Main Controller
// ---------------------------------------------
const runQuery = async (req, res) => {
  console.log("🔥 /run-query endpoint hit:", req.body);

  try {
    const { labId, prompt } = req.body;

    console.log("🚀 runQuery →", { labId, prompt });

    if (!labId || !prompt) {
      return res.status(400).json({
        error: "labId and prompt are required",
      });
    }

    // ---------------------------------------------
    // 1️⃣ SQL GENERATION PROMPT
    // ---------------------------------------------
    const sqlPrompt = `
Convert natural language to a **PostgreSQL SELECT SQL query**.

Table: "FoodReports"
Columns: lab_id, protein, fat, weight, expiry

Rules:
- ALWAYS include: WHERE lab_id = ${labId}
- Use ONLY table name: "FoodReports"
- Return PURE SQL
- NO markdown
- NO backticks
- NO explanation
- NO labels like "sql" or "SQL:"
User question: ${prompt}
`;

    console.log("⚡ Sending SQL generation prompt to Groq...");
    let sql = await askGroq(sqlPrompt);

    // ---------------------------------------------
    // 2️⃣ CLEAN SQL
    // ---------------------------------------------
    sql = cleanSQL(sql);
    console.log("🟣 Cleaned SQL:", sql);

    let result;

    try {
      // ---------------------------------------------
      // 3️⃣ PRIMARY SQL EXECUTION
      // ---------------------------------------------
      result = await sequelize.query(sql, {
        type: sequelize.QueryTypes.SELECT,
      });

    } catch (e) {
      // ---------------------------------------------
      // 4️⃣ FALLBACK SQL PROMPT (simple & guaranteed safe)
      // ---------------------------------------------
      console.log("❌ SQL failed. Retrying with simpler fallback...");

      const fallbackPrompt = `
User question: ${prompt}

Generate a valid PostgreSQL SELECT query.

Rules:
- Table: "FoodReports"
- Columns: lab_id, protein, fat, weight, expiry
- MUST include: WHERE lab_id = ${labId}
- Return ONLY SQL
- NO markdown, NO backticks, NO explanations, NO 'sql:' prefix
`;

      sql = await askGroq(fallbackPrompt);
      sql = cleanSQL(sql);

      console.log("🟣 Fallback SQL (clean):", sql);

      // Execute fallback SQL
      result = await sequelize.query(sql, {
        type: sequelize.QueryTypes.SELECT,
      });
    }

    // ---------------------------------------------
    // 5️⃣ EXPLANATION USING GROQ
    // ---------------------------------------------
    const explainPrompt = `
Explain this SQL result in simple English.
User question: ${prompt}
SQL: ${sql}
Data: ${JSON.stringify(result)}
Keep it short.
`;

    const explanation = await askGroq(explainPrompt);

    // ---------------------------------------------
    // 6️⃣ SEND RESPONSE
    // ---------------------------------------------
    res.json({
      sql,
      answerText: result.length === 0 ? "No matching data." : explanation.trim(),
      answerTable: result.length > 0 ? result : null,
    });

  } catch (error) {
    console.log("🔥 runQuery error:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

// ---------------------------------------------
// Helper → Strong SQL Cleanup
// ---------------------------------------------
function cleanSQL(sql) {
  return sql
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .replace(/^sql[\s:]/i, "")
    .replace(/^SQL[\s:]/i, "")
    .replace(/--.*/g, "")
    .replace(/\bFoodReports\b/g, `"FoodReports"`)
    .trim();
}


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
