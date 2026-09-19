import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthed } from "@/lib/auth";
import { oauthClient, GOOGLE_SCOPES, hasGoogleEnv } from "@/lib/google";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

/** GET — redirect to Google consent screen (Gmail + Calendar). */
async function _GET(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.redirect(new URL("/login", req.url));
  if (!hasGoogleEnv()) return NextResponse.json({ error: "GOOGLE_CLIENT_ID / SECRET not set" }, { status: 500 });
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token every time
    scope: GOOGLE_SCOPES,
  });
  return NextResponse.redirect(url);
}

export const GET = withDb(_GET);
