export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runARC } from "@/app/lib/arc/arcAgent";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message ?? "I want to start a business";

    const result = await runARC([
      { role: "user", content: message },
    ]);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("ARC TEST ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "ARC test failed" },
      { status: 500 }
    );
  }
}