import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/auth";
import { listEvents, isGoogleConnected, saveTokens } from "@/lib/google";
import * as db from "@/lib/db";
import type { ApptStatus } from "@/lib/types";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET — mirror Google Calendar events (past 30d → next 60d) into local appointments. */
async function _GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGoogleConnected())) return NextResponse.json({ ok: false, reason: "Google not connected" });

  const from = new Date(Date.now() - 30 * 86400_000);
  const to = new Date(Date.now() + 60 * 86400_000);
  const events = await listEvents(from, to);
  const keep = new Set<string>();
  let synced = 0;

  for (const e of events) {
    if (!e.id || !e.start?.dateTime || !e.end?.dateTime) continue;
    keep.add(e.id);
    const attendee = e.attendees?.find((a) => !a.self && !a.organizer);
    const summary = e.summary ?? "Appointment";
    const [service, name] = summary.includes(" — ") ? summary.split(" — ") : [summary, attendee?.displayName ?? ""];
    const ended = new Date(e.end.dateTime) < new Date();
    let status: ApptStatus = e.status === "cancelled" ? "cancelled" : ended ? "completed" : "scheduled";
    // keep manually-set statuses
    const existing = db.listAppointments(new Date(e.start.dateTime), new Date(new Date(e.start.dateTime).getTime() + 1)).find((a) => a.calendar_event_id === e.id);
    if (existing && (existing.status === "no_show" || existing.status === "cancelled")) status = existing.status;

    db.upsertAppointment({
      calendar_event_id: e.id,
      title: summary,
      patient_name: name || attendee?.displayName || null,
      patient_email: attendee?.email ?? null,
      service: service || null,
      starts_at: new Date(e.start.dateTime).toISOString(),
      ends_at: new Date(e.end.dateTime).toISOString(),
      status,
    });
    synced++;
  }

  db.markMissingAppointmentsCancelled(from, to, keep);
  await saveTokens({ last_calendar_sync: new Date().toISOString() });
  return NextResponse.json({ ok: true, synced });
}

export const GET = withDb(_GET);
