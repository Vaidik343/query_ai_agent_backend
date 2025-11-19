const express = require("express");
const router = express.Router();

const { runQuery, getAllData ,getDataByLab} = require("../controllers/queryController");

// POST /api/query
router.post("/query", runQuery);

// GET /api/all-data
router.get("/all-data", getAllData);

router.get("/data/:labId", getDataByLab);


module.exports = router;
