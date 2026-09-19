import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthed } from "@/lib/auth";
import { sendReply } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

const Schema = z.object({ body: z.string().trim().min(1), subject: z.string().optional() });

/** POST — send an email reply to the lead (same Gmail thread when possible). */
async function _POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Reply body required" }, { status: 400 });
  try {
    const sent = await sendReply(id, parsed.data.body, parsed.data.subject, "staff");
    return NextResponse.json({ ok: true, messageId: sent.id, delivered: sent.delivered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withDb(_POST);
