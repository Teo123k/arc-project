export const runtime = "nodejs";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildARCSystemPrompt } from "@/app/lib/arc/buildSystemPrompt";

export async function POST(req: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { reply: "Server is missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const intention = String(body?.intention ?? "").trim();

    const systemPrompt = buildARCSystemPrompt();

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: intention || "I'm here." },
        ],
      },
      { signal: controller.signal }
    );

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "I’m here. Let’s keep going.";

    return NextResponse.json({ reply });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        {
          reply:
            "I’m here. That took longer than expected. Try sending that again.",
        },
        { status: 504 }
      );
    }

    console.error("ARC API ERROR:", err);

    return NextResponse.json(
      {
        reply:
          "Something went wrong on my side. Let’s pause for a moment and try again.",
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
