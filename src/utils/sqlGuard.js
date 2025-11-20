// sqlGuard.js
module.exports = {
  isUnsafe(sql) {
    return /(drop|delete|insert|alter|update)/i.test(sql);
  },

  isValidSQL(sql) {
    return /^select/i.test(sql);
  }
};
