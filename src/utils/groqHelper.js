// groqHelper.js
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askGroq(prompt) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    stream: true,
  });

  let out = "";
  for await (const msg of completion) {
    out += msg.choices?.[0]?.delta?.content || "";
  }
  return out;
}

module.exports = { askGroq };
