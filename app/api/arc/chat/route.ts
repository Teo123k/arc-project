export const runtime = "nodejs";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildARCSystemPrompt } from "@/app/lib/arc/buildSystemPrompt";
import { getPersonalContext, hasPersonalContext } from "@/app/lib/arc/personalContext";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { reply: "Server is missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: ChatMessage[] = body?.messages ?? [];

    const client = new OpenAI({ apiKey });

    const finalMessages: ChatMessage[] = [
      { role: "system", content: buildARCSystemPrompt() }
    ];

    if (hasPersonalContext()) {
      finalMessages.push({
        role: "system",
        content:
          "USER CONTEXT (INTERNAL): " +
          JSON.stringify(getPersonalContext()) +
          ". ARC must factor this into decisions and recommendations."
      });
    }

    finalMessages.push(...messages);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.55,
      messages: finalMessages,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "Let’s move forward.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("ARC API ERROR:", err);
    return NextResponse.json(
      { reply: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
