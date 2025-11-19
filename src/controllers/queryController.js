const { FoodReport } = require('../models/index');
// const OpenAI = require("openai")
const { sequelize } = require("../models");
// const { safeOpenAIRequest } = require('../utils/openaiHelper');
const { queryOllama } = require("../utils/ollamaHelper");


// const client = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY
// });

const runQuery = async (req, res) => {
  try {
    const { labId, prompt } = req.body;

    if (!labId || !prompt) {
      return res.status(400).json({
        error: "labId and prompt are required",
      });
    }

    // --- 1️⃣ SQL Prompt ---
    const sqlPrompt = `
You convert natural language to EXACT SQL for PostgreSQL.

DATABASE:
Table: "FoodReports"
Columns: lab_id INT, protein FLOAT, fat FLOAT, weight FLOAT, expiry INT

STRICT RULES:
- ALWAYS include: lab_id = ${labId}
- Output MUST be ONLY SQL. No Markdown. No explanation.
- Do NOT use backticks.
- Do NOT guess missing columns.
- Do NOT rename columns.
- Always select known existing fields.

User request: ${prompt}

Return only the SQL query:
`;

    const sqlRaw = await queryOllama(sqlPrompt, 150);

    let sql = sqlRaw
      .replace(/```sql/gi, "")
      .replace(/```/g, "")
      .replace(/\bFoodReports\b/g, `"FoodReports"`)
      .trim();

    console.log("SQL GENERATED:", sql);

    // --- 2️⃣ SQL Safety ---
    if (/drop|delete|update|insert|alter|truncate/i.test(sql)) {
      return res.status(400).json({
        error: "Unsafe SQL detected",
        sql,
      });
    }

    // --- 3️⃣ Execute SQL ---
    const result = await sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
    });

    // --- 4️⃣ Explanation Prompt ---
    const explainPrompt = `
Explain the result very simply.

User asked: ${prompt}
Rows returned: ${result.length}

Data: ${JSON.stringify(result)}

Return short explanation only.
`;
    console.log("🚀 ~ runQuery ~ explainPrompt:", explainPrompt)

    const explanation = await queryOllama(explainPrompt, 100);

    // --- 5️⃣ Response ---
    res.json({
      sql,
      answerText: result.length === 0 ? "No matching data found." : explanation,
      answerTable: result.length > 0 ? result : null,
    });

  } catch (error) {
    console.error("runQuery error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
console.log("🚀 ~ runQuery ~ runQuery:", runQuery)




const getAllData = async (req, res) => {
    try {
        const data = await FoodReport.findAll();
        res.json({ data });
    } catch (error) {
        console.log("🚀 ~ getAllData ~ error:", error)
        res.status(500).json({ error: "Failed to fetch data" });
    }
}

const getDataByLab = async (req, res) => {
  try {
    const { labId } = req.params;

    const data = await FoodReport.findAll({
      where: { lab_id: labId },
     
    });

    res.json({ data });

  } catch (error) {
    console.log("🚀 ~ getDataByLab ~ error:", error);
    res.status(500).json({ error: "Failed to fetch lab data" });
  }
};


module.exports = { runQuery, getAllData ,getDataByLab}
