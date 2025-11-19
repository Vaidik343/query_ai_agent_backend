// openaiHelper.js
async function safeOpenAIRequest(client, payload, maxRetries = 5) {
  let attempt = 0;
  let waitTime = 2000; // initial wait 2s

  while (true) {
    try {
      return await client.chat.completions.create(payload);
    } catch (err) {
      if (err.status === 429) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error(
            `Rate limit exceeded after ${maxRetries} retries. Please try later.`
          );
        }

        // Use API-provided retry-after if available, otherwise exponential backoff
        const retryAfter =
          parseInt(err.headers.get("retry-after-ms")) ||
          (parseInt(err.headers.get("retry-after")) * 1000) ||
          waitTime;

        console.warn(
          `⚠ Rate limited. Retry #${attempt} after ${retryAfter} ms...`
        );

        await new Promise((res) => setTimeout(res, retryAfter));

        // Exponential backoff: double the wait time for next attempt
        waitTime *= 2;
      } else {
        throw err; // Other errors bubble up
      }
    }
  }
}

module.exports = { safeOpenAIRequest };
