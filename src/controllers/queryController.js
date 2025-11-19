const { FoodReport } = require('../models/index');
const OpenAI = require("openai")
const { sequelize } = require("../models");
const { safeOpenAIRequest } = require('../utils/openaiHelper');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const runQuery = async (req, res) => {

    try {
      
        const {labId, prompt} = req.body;
        console.log("🚀 ~ runQuery ~ labId, prompt:", labId, prompt)

        if (!labId || !prompt) {
      return res.status(400).json({
        error: "labId and prompt are required",
      });

      
         }
  const schema = `
You convert natural language to SQL for PostgreSQL.
Table: "FoodReports"
Columns:
- lab_id INT
- protein FLOAT
- fat FLOAT
- weight FLOAT
- expiry DATE
- created_at TIMESTAMP

Rules:
- Always filter by lab_id = ${labId}
- Return ONLY pure SQL.
- DO NOT return markdown.
- DO NOT use \`\`\`.
- No explanation. Only SQL.
`;


const { encoding_for_model } = require("tiktoken"); // or require if using CommonJS
    const enc = encoding_for_model("gpt-4.1");
    const promptTokens = enc.encode(prompt).length;
    const schemaTokens = enc.encode(schema).length;
    const totalTokens = promptTokens + schemaTokens;

    console.log("🚀 Estimated tokens for this request:", totalTokens);


  console.log("🚀 ~ runQuery ~ schema:", schema)


    const ai = await safeOpenAIRequest(client, {
  model: "gpt-4.1",
  messages: [
    { role: "system", content: schema },
    { role: "user", content: prompt }
  ],
  max_output_tokens: 200,  // <-- limit output tokens to 200
  temperature: 0           // optional: deterministic SQL
});


    let sql = ai.choices[0].message.content.trim();

    // 🧹 Remove ```sql and ``` if AI still sends markdown
   // 🧹 Clean SQL from markdown + force correct table name
sql = sql
  .replace(/```sql/gi, "")
  .replace(/```/g, "")
  .replace(/\bFoodReports\b/g, `"FoodReports"`)  // <--- REQUIRED FIX
  .trim();


    // 🔒 Basic SQL safety
    if (/drop|delete|update|insert|alter/i.test(sql)) {
      return res.status(400).json({
        error: "Unsafe SQL detected",
        sql,
      });
    }

   // After running SQL:
const result = await sequelize.query(sql, {
  type: sequelize.QueryTypes.SELECT,
});

// Ask AI to explain result in human English
const explanationAI = await safeOpenAIRequest(client, {
  model: "gpt-4.1-mini",
  messages: [
    { role: "system", content: "You explain SQL query results in simple, human-friendly English." },
    { role: "user", content: `Query: ${prompt}\nSQL: ${sql}\nResult: ${JSON.stringify(result)}` }
  ],
  max_output_tokens: 150  // <-- limit explanation length
});


const answer = explanationAI.choices[0].message.content.trim();

// Respond with explanation
res.json({ sql,
   answerText: result.length === 0 ? "No matching data." : null,
  answerTable: result.length > 0 ? result : null
 });


    } catch (error) {
        console.log("🚀 ~ runQuery ~ error:", error)
        
    }

}
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
