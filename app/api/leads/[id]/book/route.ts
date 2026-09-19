import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthed } from "@/lib/auth";
import { bookLead } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

const Schema = z.object({
  start: z.string().datetime(),
  minutes: z.number().int().min(15).max(240).optional(),
  service: z.string().optional(),
  notes: z.string().optional(),
});

/** POST — book this lead from the dashboard (Google Calendar event when connected, else local). */
async function _POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "start (ISO) required" }, { status: 400 });
  try {
    const appt = await bookLead(id, { start: new Date(parsed.data.start), minutes: parsed.data.minutes, service: parsed.data.service, notes: parsed.data.notes, via: "dashboard" });
    return NextResponse.json({ ok: true, appointment: appt, htmlLink: appt.calendar_link, local: !appt.calendar_event_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("taken") ? 409 : 500 });
  }
}

export const POST = withDb(_POST);
