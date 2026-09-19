import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/auth";
import { dashboardStats } from "@/lib/leads";
import { getSettings } from "@/lib/settings";
import { sendEmail, isGoogleConnected } from "@/lib/google";
import { leadName } from "@/lib/types";
import { withDb } from "@/lib/with-db";
import { appUrl as appUrlOf } from "@/lib/url";

export const runtime = "nodejs";

/** GET — email the dentist a morning summary. Cron: 8am daily. */
async function _GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getSettings();
  const to = settings.daily_summary_email || settings.clinic_email;
  const s = await dashboardStats();
  const appUrl = appUrlOf();
  const fmt = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const lines = [
    `Good morning! Here's your ${settings.clinic_name} summary for ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.`,
    ``,
    `📅 Appointments today: ${s.apptsToday}`,
    ...s.upcoming.slice(0, 10).map((a) => `   • ${fmt(a.starts_at)} — ${a.title ?? a.patient_name ?? "Appointment"}`),
    ``,
    `📩 New leads (last 7 days): ${s.leadsWeek}`,
    `⏳ Waiting for a reply: ${s.pendingReplies}${s.urgent ? `  (🚨 ${s.urgent} urgent)` : ""}`,
    `✅ Booked this month: ${s.bookedMonth} of ${s.leadsMonth} leads (${s.conversion}%)`,
    s.avgReplyMin != null ? `⚡ Avg first-reply time: ${s.avgReplyMin} min` : ``,
    ``,
    `Recent leads:`,
    ...s.recentLeads.slice(0, 6).map((l) => `   • ${leadName(l)} — ${l.ai_summary ?? l.message?.slice(0, 80) ?? ""} [${l.status}]`),
    ``,
    appUrl ? `Open dashboard: ${appUrl}/dashboard` : ``,
  ].filter((l) => l !== undefined);

  const subject = `Daily summary — ${s.apptsToday} appointments, ${s.pendingReplies} leads waiting`;
  const body = lines.join("\n");

  // Demo mode: return the summary instead of emailing it
  if (!to || !(await isGoogleConnected())) {
    return NextResponse.json({ ok: true, delivered: false, reason: !to ? "No daily_summary_email set" : "Google not connected", subject, body });
  }
  await sendEmail({ to, subject, body });
  return NextResponse.json({ ok: true, delivered: true, to });
}

export const GET = withDb(_GET);
