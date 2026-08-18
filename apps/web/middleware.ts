import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (request.headers.get("host") !== "www.learnforge.fyi") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
