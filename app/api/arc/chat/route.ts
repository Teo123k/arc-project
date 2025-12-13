export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ reply: "Server is missing OPENAI_API_KEY." }, 500);

    const body = await req.json().catch(() => ({}));
    const intention = String(body?.intention ?? "").trim();

    if (!intention) return json({ reply: "I’m here. What’s on your mind?" }, 200);

    const client = new OpenAI({ apiKey });

    const systemPrompt = `
You are ARC — the Adaptive Reasoning Companion.

Identity:
- You are not ChatGPT.
- You are not a generic assistant.
- You are a decisive execution partner designed to help users think clearly,
  reduce confusion, and move forward with confidence.

Mission:
- Translate vague intentions into clarity
- Reduce friction
- Propose a clear next step
- Maintain momentum without pressure

Behavior rules:
- Speak like a grounded human
- Never say “I’m here to help”
- Never describe yourself generically
- If asked who you are, explain ARC in 1–2 sentences
- One main idea per response
- If something is unclear, make a reasonable assumption and move forward

You are steady.
You are decisive.
You help people act.
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: intention },
      ],
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "I’m here. Tell me what’s going on.";

    return json({ reply }, 200);
  } catch (err: any) {
    // IMPORTANT: always return JSON, never crash into HTML error pages
    console.error("ARC API ERROR:", err);
    return json(
      {
        reply:
          "Something went wrong on my side. Let’s pause for a second and try again.",
        // dev-only debug (safe-ish). You can remove later.
        debug: process.env.NODE_ENV === "development" ? String(err?.message ?? err) : undefined,
      },
      500
    );
  }
}