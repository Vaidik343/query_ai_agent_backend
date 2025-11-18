const {FoodReport} = require('../models/index');
const OpenAI = require("openai")


const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const runQuery = async (req, res) => {
    try {
        const {labId, prompt} = req.body;

        if (!labId || !prompt) {
      return res.status(400).json({
        error: "labId and prompt are required",
      });

      
         }
   const schema = `
You convert natural language to SQL for PostgreSQL.
Table: FoodReports
Columns:
- lab_id INT
- protein FLOAT
- fat FLOAT
- weight FLOAT
- expiry DATE
- created_at TIMESTAMP

Rules:
- Always filter by lab_id = ${labId}
- Return only SQL.
- No explanation.
    `;

    const ai = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: schema },
        { role: "user", content: prompt },
      ],
    });

    const sql = ai.choices[0].message.content.trim();

    // Basic safety filter
    if (/drop|delete|update|insert|alter/i.test(sql)) {
      return res.status(400).json({
        error: "Unsafe SQL detected",
        sql,
      });
    }

    const result = await sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
    });

    res.json({ sql, result });

    } catch (error) {
        console.log("🚀 ~ runQuery ~ error:", error)
        
    }

}