import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLead, listLeads, processLead, bookingUrl } from "@/lib/leads";
import { isDashboardAuthed } from "@/lib/auth";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

const FormSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().default(""),
  service: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().min(2).max(4000),
  // honeypot — bots fill it, humans don't
  website: z.string().max(0).optional(),
});

/** POST — website contact form (public). */
async function _POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = FormSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const lead = await createLead({ ...parsed.data, source: "website" });

  // Run AI triage now; the visitor gets a "Pick a time" button, so any instant reply waits a few minutes
  // in case they book themselves (see runFollowup).
  try {
    const a = await processLead(lead.id, { deferAutoSend: true });
    return NextResponse.json({ ok: true, id: lead.id, bookingUrl: a.bookingUrl, urgent: a.isEmergency, autoReplied: a.autoSent, spam: !a.is_lead });
  } catch (e) {
    console.error("[ai] processLead failed", e);
    return NextResponse.json({ ok: true, id: lead.id, bookingUrl: bookingUrl(lead), urgent: false, autoReplied: false });
  }
}

/** GET — list leads (dashboard). */
async function _GET(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const leads = await listLeads({ status });
  return NextResponse.json({ leads });
}

export const POST = withDb(_POST);
export const GET = withDb(_GET);
