import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/auth";
import { fetchInboundEmails, loadTokens, saveTokens, isGoogleConnected } from "@/lib/google";
import { classifyEmail } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import * as db from "@/lib/db";
import { createLead, appendInbound, processLead } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET — pull new inbox emails, turn patient inquiries into leads (or append to existing threads),
 * then run AI triage. Called by cron every few minutes, or manually from the dashboard.
 */
async function _GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGoogleConnected())) return NextResponse.json({ ok: false, reason: "Google not connected" });

  const tokens = await loadTokens();
  const since = tokens?.last_gmail_sync ? new Date(tokens.last_gmail_sync) : new Date(Date.now() - 24 * 3600_000);
  const settings = await getSettings();
  const clinicEmail = (tokens?.email ?? settings.clinic_email ?? "").toLowerCase();

  const emails = await fetchInboundEmails(new Date(since.getTime() - 5 * 60_000)); // small overlap
  const result = { seen: emails.length, created: 0, appended: 0, skipped: 0 };
  const toProcess: string[] = [];

  for (const em of emails) {
    if (!em.body || (clinicEmail && em.fromEmail === clinicEmail)) { result.skipped++; continue; }
    if (db.hasGmailMessage(em.id)) { result.skipped++; continue; }

    // existing thread → append
    const byThread = db.findLeadByThread(em.threadId);
    if (byThread) {
      await appendInbound(byThread.id, { body: em.body, subject: em.subject, gmail_message_id: em.id, sent_at: em.date });
      result.appended++;
      toProcess.push(byThread.id);
      continue;
    }

    // known email address (e.g. website lead now replying by email) → link thread + append
    const byEmail = db.findLatestLeadByEmail(em.fromEmail);
    if (byEmail && !byEmail.gmail_thread_id) {
      db.updateLead(byEmail.id, { gmail_thread_id: em.threadId });
      await appendInbound(byEmail.id, { body: em.body, subject: em.subject, gmail_message_id: em.id, sent_at: em.date });
      result.appended++;
      toProcess.push(byEmail.id);
      continue;
    }

    // new sender → ask AI whether it's a patient inquiry
    let isInquiry = true;
    let first = em.fromName.split(" ")[0] ?? "";
    let last = em.fromName.split(" ").slice(1).join(" ");
    let phone = "";
    try {
      const c = await classifyEmail(em.from, em.subject, em.body, settings);
      isInquiry = c.is_patient_inquiry;
      first = c.first_name || first;
      last = c.last_name || last;
      phone = c.phone;
    } catch (e) {
      console.error("[gmail] classify failed", e);
    }
    if (!isInquiry) { result.skipped++; continue; }

    const lead = await createLead({
      first_name: first, last_name: last, email: em.fromEmail, phone,
      message: em.body, subject: em.subject, source: "email",
      gmail_thread_id: em.threadId, gmail_message_id: em.id, sent_at: em.date,
    });
    result.created++;
    toProcess.push(lead.id);
  }

  await saveTokens({ last_gmail_sync: new Date().toISOString() });

  for (const id of [...new Set(toProcess)]) {
    try { await processLead(id); } catch (e) { console.error("[ai] processLead", id, e); }
  }
  return NextResponse.json({ ok: true, ...result });
}

export const GET = withDb(_GET);
