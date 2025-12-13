import { NextResponse } from "next/server";
import { runIntentionPipeline } from "@/app/arc-system/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runIntentionPipeline(body);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("ARC Pipeline Error:", error);
    return NextResponse.json({ success: false, error });
  }
}
