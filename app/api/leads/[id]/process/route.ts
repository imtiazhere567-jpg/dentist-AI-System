import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthed } from "@/lib/auth";
import { processLead } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST — (re)run AI triage + reply draft for one lead. */
async function _POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const analysis = await processLead(id);
    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withDb(_POST);
