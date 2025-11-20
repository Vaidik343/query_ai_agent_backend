// rateLimit.js
let lastCall = 0;
const MIN_DELAY = 1500; // 1.5s between calls

function canCall() {
  const now = Date.now();
  if (now - lastCall < MIN_DELAY) return false;
  lastCall = now;
  return true;
}

module.exports = { canCall };
