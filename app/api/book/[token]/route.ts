import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findLeadByToken, appointmentsForLead } from "@/lib/db";
import { getFreeSlots } from "@/lib/slots";
import { getSettings } from "@/lib/settings";
import { bookLead } from "@/lib/leads";
import { leadName } from "@/lib/types";
import { SERVICE_OPTIONS } from "@/lib/site-content";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

/** GET — public: who is booking + open slots for the next 7 days. */
async function _GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const lead = findLeadByToken(token);
  if (!lead || lead.status === "spam") return NextResponse.json({ error: "This booking link is not valid." }, { status: 404 });
  const settings = await getSettings();
  const existing = appointmentsForLead(lead.id).filter((a) => a.status === "scheduled" && new Date(a.starts_at) > new Date());
  const slots = existing.length ? [] : await getFreeSlots(7, settings.slot_minutes);
  return NextResponse.json({
    name: lead.first_name ?? leadName(lead),
    service: lead.service,
    urgent: lead.priority === "urgent",
    clinic: { name: settings.clinic_name, phone: settings.phone, address: settings.address, hours: settings.hours },
    services: SERVICE_OPTIONS,
    slotMinutes: settings.slot_minutes,
    existing: existing[0] ?? null,
    slots,
  });
}

const Schema = z.object({ start: z.string().datetime(), service: z.string().optional(), notes: z.string().max(500).optional() });

/** POST — public: the patient books a slot from their link. */
async function _POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const lead = findLeadByToken(token);
  if (!lead || lead.status === "spam") return NextResponse.json({ error: "This booking link is not valid." }, { status: 404 });
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Please pick a time." }, { status: 400 });
  const start = new Date(parsed.data.start);
  if (start.getTime() < Date.now()) return NextResponse.json({ error: "That time has already passed." }, { status: 400 });
  try {
    const appt = await bookLead(lead.id, { start, service: parsed.data.service, notes: parsed.data.notes, via: "patient_link" });
    return NextResponse.json({ ok: true, appointment: appt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("taken") ? 409 : 500 });
  }
}

export const GET = withDb(_GET);
export const POST = withDb(_POST);
