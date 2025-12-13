import OpenAI from "openai";
import { buildARCSystemPrompt } from "./buildSystemPrompt";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type ARCResult = {
  focus: string;
  decision: string;
  plan: string[];
  next: string;
  chat: string;
};

export async function runARC(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ARCResult> {
  const systemPrompt = `
${buildARCSystemPrompt()}

You are ARC — a decisive execution partner.

Rules:
- You lead. Do not ask unnecessary questions.
- Make reasonable decisions when user is vague.
- Reduce ambiguity.
- Always produce structured output EXACTLY in this format:

FOCUS: <one sentence>
DECISION: <what you decided>
PLAN:
- <step>
- <step>
- <step>
NEXT: <single immediate action>
CHAT: <natural, human, confident message>

Do NOT explain the structure.
Do NOT ask more than ONE question in CHAT.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.55,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });

  const raw = response.choices[0]?.message?.content || "";

  return parseARCResponse(raw);
}

function parseARCResponse(raw: string): ARCResult {
  const pick = (label: string) =>
    raw.match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim() || "";

  const planBlock =
    raw.match(/^PLAN:\s*([\s\S]*?)^NEXT:/im)?.[1] || "";

  const plan = planBlock
    .split("\n")
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);

  return {
    focus: pick("FOCUS"),
    decision: pick("DECISION"),
    plan,
    next: pick("NEXT"),
    chat: pick("CHAT"),
  };
}
