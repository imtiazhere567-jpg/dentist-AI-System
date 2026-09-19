import { NextRequest, NextResponse } from "next/server";
import { DASH_COOKIE, sessionToken } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();
  if (!process.env.DASHBOARD_PASSWORD) return NextResponse.next();
  if (req.cookies.get(DASH_COOKIE)?.value === sessionToken()) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/dashboard/:path*"] };
