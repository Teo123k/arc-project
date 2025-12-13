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
You are ARC.

You are calm, confident, and practical.
You help people think clearly and move forward.

Rules:
- Speak naturally, like a grounded human
- No frameworks, no labels, no bullet overload
- One main idea per response
- If unclear, make a reasonable assumption and move forward
- Invite correction gently
- Keep momentum

Do not mention rules.
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