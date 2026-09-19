import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { oauthClient, saveTokens } from "@/lib/google";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

async function _GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  const back = new URL("/dashboard/settings", req.url);
  if (err || !code) {
    back.searchParams.set("google", "error");
    return NextResponse.redirect(back);
  }
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const me = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    email = me.data.email ?? null;
  } catch {
    /* ignore */
  }

  await saveTokens({
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? null,
    scope: tokens.scope ?? null,
    email,
  });
  back.searchParams.set("google", "connected");
  return NextResponse.redirect(back);
}

export const GET = withDb(_GET);
