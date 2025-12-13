export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: true,
      note:
        "Pipeline endpoint temporarily stubbed to keep dev server stable. Restore logic later.",
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      note:
        "Pipeline endpoint temporarily stubbed to keep dev server stable. Use POST later.",
    },
    { status: 200 }
  );
}