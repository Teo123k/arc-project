import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|arc-system/test|dashboard|api/arc/pipeline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
