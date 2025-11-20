const { FoodReport } = require('../models/index');
const { sequelize } = require("../models");
const { parseAndBuild } = require('../utils/queryParser');
const Cache = require("../utils/cache");

const runQuery = async (req, res) => {
  try {
    const { labId, prompt } = req.body;
    if (!labId || !prompt) {
      return res.status(400).json({ error: "labId and prompt required" });
    }

    console.log("🔥 parser run:", { labId, prompt });

    // -----------------------------
    // 1️⃣ PARSE QUERY
    // -----------------------------
    const built = parseAndBuild(labId, prompt);
    if (!built || !built.success) {
      return res.status(400).json({ error: built.error || "Prompt parsing failed" });
    }

    // -----------------------------
    // 2️⃣ Embed replacements for logging/display
    // -----------------------------
    const sqlEmbedded = built.sql.replace(/:(\w+)/g, (_, key) => {
      if (built.replacements[key] === undefined) return `:${key}`;
      const val = built.replacements[key];
      return typeof val === "string" ? `'${val}'` : val;
    });

    console.log("🟣 SQL (with embedded values):", sqlEmbedded);
    console.log("🔁 Replacements:", built.replacements);

    // -----------------------------
    // 3️⃣ CACHE CHECK
    // -----------------------------
    const cacheKey = `sql:${sqlEmbedded}`;
    const cached = await Cache.get(cacheKey);
    if (cached) {
      console.log("⚡ CACHE HIT");
      return res.json({ cached: true, ...cached });
    }

    console.log("🐌 CACHE MISS → querying DB...");

    // -----------------------------
    // 4️⃣ EXECUTE QUERY
    // -----------------------------
    const rows = await sequelize.query(built.sql, {
      type: sequelize.QueryTypes.SELECT,
      replacements: built.replacements
    });

    // -----------------------------
    // 5️⃣ HUMAN-READABLE ANSWER
    // -----------------------------
    let answerText = `Returned ${rows.length} rows.`;
    if (/count\(/i.test(built.sql)) {
      const cnt = rows[0] ? Object.values(rows[0])[0] : 0;
      answerText = `Count: ${cnt}`;
    }
    if (/avg\(/i.test(built.sql)) {
      const val = rows[0] ? rows[0].value ?? Object.values(rows[0])[0] : null;
      answerText = val === null ? "No data" : `Average: ${val}`;
    }

    // -----------------------------
    // 6️⃣ RESPONSE OBJECT
    // -----------------------------
    const responseData = {
      sql: sqlEmbedded, // log/display with actual values
      answerText,
      answerTable: rows
    };

    // -----------------------------
    // 7️⃣ SAVE TO CACHE
    // -----------------------------
    await Cache.set(cacheKey, responseData, 30);

    // -----------------------------
    // 8️⃣ SEND RESPONSE
    // -----------------------------
    return res.json({ cached: false, ...responseData });

  } catch (error) {
    console.error("runQuery parser error:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

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
    const data = await FoodReport.findAll({ where: { lab_id: labId } });
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lab data" });
  }
};

module.exports = { runQuery, getAllData, getDataByLab };
