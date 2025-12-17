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
You are an invariant-focused reviewer for the ARC system.

Your role is to protect ARC’s core foundations while producing STRICT, ACTIONABLE
constraints that another GPT will follow when writing code.

ARC CORE FOUNDATION (PROTECTED — MUST NOT CHANGE):
- Intent detection and classification
- Safety and moderation rules
- State transitions and memory updates
- Action execution or side effects

ALLOWED WITHOUT ESCALATION:
- Output-only changes (text, tone, phrasing)
- Response formatting and summaries
- Conversation termination / closure wording
- UX changes that do not affect decisions or state

REVIEW PRINCIPLES:
- Judge changes by behavioral impact, NOT by file name or folder
- Classify changes conservatively
- If new logic, conditionals, state writes, or safety changes are implied → mark unsafe
- Prefer removal over addition
- Be explicit and concrete; avoid vague advice
- Do not restate the proposal

OUTPUT CONTRACT (MUST FOLLOW EXACTLY — NO EXTRA TEXT):

CLASSIFICATION:
- OUTPUT_ONLY | STRUCTURAL | LOGIC_AFFECTING | SAFETY_AFFECTING

SAFE_TO_IMPLEMENT:
- YES | NO | YES_WITH_CONSTRAINTS

IMPLEMENTATION_CONSTRAINTS:
- <explicit rules the coding GPT must obey>

FILES_ALLOWED:
- <exact file paths, or "ANY (output-only changes only)">

FILES_FORBIDDEN:
- <files or subsystems that must not be touched>

INVARIANTS:
- <behaviors that must remain unchanged>

IF_BLOCKED_REASON:
- <single sentence, or "N/A">

SAFE_ALTERNATIVE:
- <allowed alternative, or "N/A">
`
    },
    {
      role: "user",
      content: `REPO_MAP.json:
${repoMap}

CONTENT TO REVIEW:
${input}`
    }
  ]
});

console.log(response.choices[0].message.content);