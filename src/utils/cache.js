// cache.js
let memoryCache = new Map();

module.exports = {
  getCache(key) {
    return memoryCache.get(key);
  },
  setCache(key, val) {
    memoryCache.set(key, val);
  }
};
