import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";

// Load .env from project root
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

// Fail fast on missing env
if (!process.env.REVIEW_API_KEY) {
  throw new Error("REVIEW_API_KEY is NOT loaded");
}
if (!process.env.REVIEW_BASE_URL) {
  throw new Error("REVIEW_BASE_URL is NOT loaded");
}
if (!process.env.REVIEW_MODEL) {
  throw new Error("REVIEW_MODEL is NOT loaded");
}

console.log("Reviewer script started");

// Init client
const client = new OpenAI({
  apiKey: process.env.REVIEW_API_KEY,
  baseURL: process.env.REVIEW_BASE_URL,
});

// Read stdin
const input = fs.readFileSync(0, "utf8").trim();
if (!input) {
  throw new Error("No input provided to reviewer");
}

// Read repo map
const repoMap = fs.readFileSync("arc/dev/REPO_MAP.json", "utf8");

// Call model
const response = await client.responses.create({
  model: process.env.REVIEW_MODEL,
  input: [
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

The system defines three change zones:

ZONE_CORE (Protected):
- Planning, decision, safety, and intent logic.
- Changes are NOT allowed without explicit override.

ZONE_OUTPUT (Permitted):
- User-facing phrasing, tone, formatting, and natural language adjustments.
- Changes are allowed if they do not alter intent, logic, or structure.

ZONE_DEV (Experimental):
- Dev-only tools, scripts, and layers not used in production.

The reviewer may approve changes in ZONE_OUTPUT and ZONE_DEV without treating them as production code modifications.

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
      content:
        "REPO_MAP.json:\n" +
        repoMap +
        "\n\nCONTENT TO REVIEW:\n" +
        input
    }
  ]
});

// Output safely
const output =
  response.output_text ??
  response.output?.map(o => o.content?.[0]?.text).join("\n") ??
  "NO OUTPUT";

console.log(output);