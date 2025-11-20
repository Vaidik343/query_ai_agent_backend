// src/utils/cache.js

const Redis = require("ioredis");

let redis = null;
let memoryCache = new Map();

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 2000,
  });

  redis.on("connect", () => console.log("🔌 Redis connected"));
  redis.on("error", () => {
    // console.log("⚠️ Redis connection failed → using in-memory cache");
    redis = null;
  });

} catch (err) {
  console.log("⚠️ Redis init failed → fallback to in-memory cache");
  redis = null;
}

module.exports = {
  async get(key) {
    if (redis) {
      try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.log("⚠️ Redis GET failed, fallback");
        return memoryCache.get(key) || null;
      }
    }
    return memoryCache.get(key) || null;
  },

  async set(key, value, ttl = 30) {
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(value), "EX", ttl);
        return;
      } catch (err) {
        console.log("⚠️ Redis SET failed, writing to memory cache");
        memoryCache.set(key, value);
        return;
      }
    }
    memoryCache.set(key, value);
  },

  async del(key) {
    if (redis) {
      try {
        return await redis.del(key);
      } catch {
        memoryCache.delete(key);
      }
    }
    memoryCache.delete(key);
  }
};
