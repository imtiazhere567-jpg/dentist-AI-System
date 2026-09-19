import { NextRequest, NextResponse } from "next/server";
import { DASH_COOKIE, sessionToken } from "@/lib/auth";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

async function _POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!process.env.DASHBOARD_PASSWORD || password === process.env.DASHBOARD_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(DASH_COOKIE, sessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}

async function _DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DASH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export const POST = withDb(_POST);
export const DELETE = withDb(_DELETE);
