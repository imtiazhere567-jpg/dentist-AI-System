import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthed } from "@/lib/auth";
import { appendInbound, processLead, getLead } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({ body: z.string().trim().min(1).max(4000) });

/**
 * POST — record an incoming patient message on this lead and let the AI act on it.
 * Used by the dashboard's "reply as the patient" tester (the same path a real Gmail reply takes).
 */
async function _POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Message required" }, { status: 400 });
  const { lead } = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await appendInbound(id, { body: parsed.data.body, sent_at: new Date() });
  const a = await processLead(id);
  return NextResponse.json({
    ok: true,
    autoBooked: a.autoBooked ? { starts_at: a.autoBooked.starts_at, service: a.autoBooked.service } : null,
    autoSent: a.autoSent,
    draft: a.reply,
    summary: a.summary,
  });
}

export const POST = withDb(_POST);
