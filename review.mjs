import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({
  apiKey: process.env.REVIEW_API_KEY,
  baseURL: process.env.REVIEW_BASE_URL
});

const model = process.env.REVIEW_MODEL;

// Read input (plan or code) from stdin
const input = fs.readFileSync(0, "utf8");

// Read repo context
const repoMap = fs.readFileSync("arc/dev/REPO_MAP.json", "utf8");

const response = await client.chat.completions.create({
  model,
  temperature: 0.2,
  messages: [
    {
      role: "system",
      content: `
You are a strict senior software reviewer.

Rules:
- Enforce REPO_MAP.json strictly
- Prefer removing code over adding
- Identify root causes, not symptoms
- Flag scope creep immediately
- Be concise, no encouragement

Return EXACTLY this format:

SAFE: YES/NO
TOP_ISSUES:
- ...
MINIMAL_FIX:
- ...
RISKS:
- ...
`
    },
    {
      role: "user",
      content: \`REPO_MAP.json:
${repoMap}

CONTENT TO REVIEW:
${input}\`
    }
  ]
});

console.log(response.choices[0].message.content);
