async function queryOllama(prompt, maxTokens = 200, retries = 3) {
  while (retries > 0) {
    try {
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          model: "llama3.2:1b",
          prompt,
          stream: false,
          max_tokens: maxTokens
        })
      });

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.status}`);
      }

      const data = await res.json();
      return data.response;
    } 
    catch (err) {
      console.warn(`⚠ Ollama request failed: ${err.message}`);

      retries--;

      if (retries === 0) {
        return "Error: Local LLM failed after multiple attempts.";
      }

      // Slow hardware? Give it time before retry
      await new Promise(r => setTimeout(r, 800));
      console.log("🔄 Retrying...");
    }
  }
}

module.exports = { queryOllama };
