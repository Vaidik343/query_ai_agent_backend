// logger.js
module.exports = {
  logSQL(sql) {
    console.log("\n🔵 SQL:", sql);
  },
  logLLM(title, txt) {
    console.log(`\n🟣 ${title}:\n${txt}\n`);
  }
};
