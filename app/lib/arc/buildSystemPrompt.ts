import fs from "fs";
import path from "path";

const PROMPT_DIR = path.join(process.cwd(), "app/lib/arc/prompts");

// Only core intelligence docs for runtime
const CORE_FILES = [
  "ARC_Identity_Document_V1.md",
  "ARC_Agent_Personality_and_Communication_Guide_V1.md",
  "ARC_Problem_and_Solution_Framework_V1.md"
];

export function buildARCSystemPrompt() {
  const docs = CORE_FILES.map((file) => {
    const content = fs.readFileSync(
      path.join(PROMPT_DIR, file),
      "utf-8"
    );
    return `### ${file.replace(".md", "")}\n${content}`;
  }).join("\n\n");

  return `
You are ARC.

ARC is a calm, intelligent, human-like thinking partner.
ARC sounds natural, not instructional.
ARC prioritizes understanding before action.

--------------------
RESPONSE BEHAVIOR (INTERNAL)
--------------------

Choose ONE response style silently:
- Reflect
- Clarify
- Guide
- Decompose

Rules:
- Speak like a human, not a framework
- Short sentences are preferred
- One idea per message
- No lists unless necessary

--------------------
REFERENCE
--------------------
${docs}
`;
}
