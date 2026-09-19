import * as db from "./db";
import { analyzeLead } from "./ai";
import { getSettings } from "./settings";
import { sendEmail, isGoogleConnected, createEvent, listEvents } from "./google";
import { getFreeSlots } from "./slots";
import { appUrl } from "./url";
import { leadName, type Lead, type Message, type LeadSource, type Appointment } from "./types";

/** Public self-serve booking page for this lead. */
export function bookingUrl(lead: Pick<Lead, "booking_token">) {
  return `${appUrl()}/book/${lead.booking_token}`;
}

// ---------- create ----------

export async function createLead(input: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  message: string;
  service?: string;
  source: LeadSource;
  gmail_thread_id?: string;
  gmail_message_id?: string;
  subject?: string;
  sent_at?: Date;
}): Promise<Lead> {
  const at = (input.sent_at ?? new Date()).toISOString();
  const lead = db.insertLead({
    first_name: input.first_name || null,
    last_name: input.last_name || null,
    email: input.email?.toLowerCase() || null,
    phone: input.phone || null,
    message: input.message,
    service: input.service || null,
    source: input.source,
    gmail_thread_id: input.gmail_thread_id || null,
    created_at: at,
  });
  db.insertMessage({
    lead_id: lead.id,
    direction: "inbound",
    channel: input.source === "email" ? "email" : "website",
    subject: input.subject ?? null,
    body: input.message,
    gmail_message_id: input.gmail_message_id ?? null,
    sent_at: at,
  });
  return lead;
}

export async function appendInbound(leadId: string, m: { body: string; subject?: string; gmail_message_id?: string; sent_at: Date }) {
  db.insertMessage({
    lead_id: leadId,
    direction: "inbound",
    channel: "email",
    subject: m.subject ?? null,
    body: m.body,
    gmail_message_id: m.gmail_message_id ?? null,
    sent_at: m.sent_at.toISOString(),
  });
  // Reopen the lead if it was closed
  const lead = db.getLeadById(leadId);
  if (lead && (lead.status === "contacted" || lead.status === "lost")) {
    db.updateLead(leadId, { status: "new", ai_reply: null, ai_processed_at: null });
  }
}

// ---------- read ----------

export async function getLead(id: string) {
  return {
    lead: db.getLeadById(id),
    messages: db.messagesForLead(id),
    appointments: db.appointmentsForLead(id),
  };
}

export async function listLeads(opts: { status?: string; limit?: number } = {}) {
  return db.listLeadsDb(opts);
}

// ---------- AI ----------

/**
 * Analyze a lead and decide what to do.
 *  - deferAutoSend (website form): the visitor just saw a "Pick a time" button, so the AI waits
 *    `followup_minutes` for them to self-book. If they don't, runFollowup() sends the instant reply
 *    (emergency / safe question) or leaves the draft for the team.
 *  - otherwise (email leads): act immediately.
 */
export async function processLead(leadId: string, opts: { deferAutoSend?: boolean } = {}) {
  const { lead, messages } = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const settings = await getSettings();

  let allSlots: { iso: string; label: string }[] = [];
  try {
    allSlots = (await getFreeSlots(7, settings.slot_minutes)).map((s) => ({ iso: s.iso, label: s.label }));
  } catch {
    // slots optional
  }
  // the model sees the whole week (so it can recognise any time the patient names); drafts mention the first few
  const slots = allSlots.slice(0, 6).map((s) => s.label);

  const a = await analyzeLead(lead, messages as Message[], settings, allSlots);
  const alreadyBooked = lead.status === "booked";
  const isEmergency = a.intent === "emergency" || a.priority === "urgent";

  // ---- patient confirmed one of the offered times → AI books it and sends the confirmation ----
  if (a.is_lead && a.book_slot_iso && settings.auto_book && !alreadyBooked && lead.email) {
    try {
      db.updateLead(leadId, {
        intent: a.intent, priority: a.priority, ai_summary: a.summary, ai_safe_auto: true,
        service: lead.service || a.service || null, ai_processed_at: new Date().toISOString(), followup_due_at: null,
      });
      const appt = await bookLead(leadId, { start: new Date(a.book_slot_iso), service: lead.service || a.service, via: "ai" });
      return { ...a, reply: "", autoSent: true, autoBooked: appt, deferredUntil: null, isEmergency, bookingUrl: bookingUrl(lead) };
    } catch (e) {
      console.error("[ai] auto-book failed, falling back to draft", e);
      // slot taken meanwhile → continue below and offer alternatives in the draft
    }
  }

  // Every draft ends with the patient's personal booking link (unless the model already used one)
  let reply = a.reply;
  if (a.is_lead && !alreadyBooked && !reply.includes("/book/")) {
    const link = bookingUrl(lead);
    const opening = slots.length ? `Earliest openings: ${slots.slice(0, 3).join(" · ")}.` : "";
    reply = `${reply.trimEnd()}\n\n${opening ? opening + "\n" : ""}Pick a time that suits you here (takes 10 seconds): ${link}`;
  }
  const patch: Partial<Lead> = {
    intent: a.intent,
    priority: a.priority,
    ai_summary: a.summary,
    ai_reply: a.is_lead ? reply : null,
    ai_safe_auto: a.safe_to_auto_send,
    service: lead.service || a.service || null,
    ai_processed_at: new Date().toISOString(),
    followup_due_at: null,
  };
  if (!a.is_lead) patch.status = "spam";

  // Instant replies, no approval needed:
  //  - emergencies (when emergency_auto_reply is on) — patient gets the booking link right away
  //  - simple questions the model marks safe (when auto_reply is on)
  const wantsAutoSend =
    a.is_lead && !!lead.email && lead.status === "new" && !alreadyBooked &&
    ((isEmergency && settings.emergency_auto_reply) || (settings.auto_reply && a.safe_to_auto_send));

  let autoSent = false;
  let deferredUntil: string | null = null;

  if (wantsAutoSend && opts.deferAutoSend) {
    // give the visitor a few minutes to use the "Pick a time" button first
    deferredUntil = new Date(Date.now() + settings.followup_minutes * 60_000).toISOString();
    patch.followup_due_at = deferredUntil;
    db.updateLead(leadId, patch);
    scheduleFollowup(leadId, settings.followup_minutes * 60_000);
  } else {
    db.updateLead(leadId, patch);
    if (wantsAutoSend) {
      try {
        await sendReply(leadId, reply);
        autoSent = true;
      } catch (e) {
        console.error("auto-reply failed", e);
      }
    }
  }
  return { ...a, reply, autoSent, autoBooked: null as Appointment | null, deferredUntil, isEmergency, bookingUrl: bookingUrl(lead) };
}

// ---------- deferred follow-ups (website leads that didn't self-book) ----------

declare global {
  // eslint-disable-next-line no-var
  var __followupTimers: Map<string, NodeJS.Timeout> | undefined;
}
const timers = () => (global.__followupTimers ??= new Map());

/** Best-effort in-process timer (dev / long-running server). Cron + dashboard loads cover the rest. */
function scheduleFollowup(leadId: string, ms: number) {
  const existing = timers().get(leadId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    timers().delete(leadId);
    runFollowup(leadId).catch((e) => console.error("[followup]", e));
  }, ms + 1000);
  t.unref?.();
  timers().set(leadId, t);
}

/** The wait is over: patient didn't self-book → send the instant reply, or leave the draft for the team. */
export async function runFollowup(leadId: string): Promise<"sent" | "left_for_team" | "skipped"> {
  const lead = db.getLeadById(leadId);
  if (!lead || !lead.followup_due_at) return "skipped";
  if (new Date(lead.followup_due_at) > new Date()) return "skipped"; // not yet
  db.updateLead(leadId, { followup_due_at: null });

  // booked / contacted / spam meanwhile → nothing to do
  if (lead.status !== "new" || !lead.email || !lead.ai_reply) return "skipped";

  const settings = await getSettings();
  const isEmergency = lead.intent === "emergency" || lead.priority === "urgent";
  const send = (isEmergency && settings.emergency_auto_reply) || (settings.auto_reply && lead.ai_safe_auto);
  if (!send) return "left_for_team";
  await sendReply(leadId, lead.ai_reply);
  return "sent";
}

/** Process every lead whose wait has expired (called from cron and on dashboard loads). */
export async function runDueFollowups() {
  const due = db.leadsWithDueFollowup();
  const results: Record<string, string> = {};
  for (const l of due) {
    try { results[l.id] = await runFollowup(l.id); } catch (e) { results[l.id] = `error: ${(e as Error).message}`; }
  }
  return results;
}

// ---------- booking (shared by the dashboard and the patient's self-serve link) ----------

export async function bookLead(
  leadId: string,
  opts: { start: Date; minutes?: number; service?: string; notes?: string; via: Appointment["booked_via"] },
): Promise<Appointment> {
  const lead = db.getLeadById(leadId);
  if (!lead) throw new Error("Lead not found");
  const settings = await getSettings();
  const start = opts.start;
  const end = new Date(start.getTime() + (opts.minutes ?? settings.slot_minutes) * 60_000);
  const service = opts.service || lead.service || "Appointment";
  const name = leadName(lead);
  const title = `${service} — ${name}`;

  // double-booking guard (local + Google)
  const localClash = db
    .listAppointments(new Date(start.getTime() - 4 * 3600_000), end)
    .find((a) => a.status !== "cancelled" && new Date(a.starts_at) < end && new Date(a.ends_at) > start);
  if (localClash) throw new Error("That time was just taken — please pick another slot.");

  let eventId: string | null = null;
  let calendarLink: string | null = null;
  if (await isGoogleConnected()) {
    const clash = (await listEvents(start, end)).filter((e) => e.start?.dateTime && e.end?.dateTime);
    if (clash.length > 0) throw new Error("That time was just taken — please pick another slot.");
    const ev = await createEvent({
      summary: title,
      description: [lead.phone && `Phone: ${lead.phone}`, lead.email && `Email: ${lead.email}`, opts.notes].filter(Boolean).join("\n"),
      start,
      end,
      attendeeEmail: lead.email,
    });
    eventId = ev.id ?? null;
    calendarLink = ev.htmlLink ?? null;
  }

  const appt = db.upsertAppointment({
    lead_id: leadId,
    calendar_event_id: eventId,
    calendar_link: calendarLink,
    booked_via: opts.via,
    title,
    patient_name: name,
    patient_email: lead.email,
    service,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: "scheduled",
    notes: opts.notes ?? null,
  });
  // booked → cancel any pending AI follow-up and drop the now-pointless draft
  db.updateLead(leadId, { status: "booked", service, followup_due_at: null, ai_reply: null });
  const t = timers().get(leadId);
  if (t) { clearTimeout(t); timers().delete(leadId); }

  // confirmation goes into the conversation (and by email when Google is connected)
  const when = start.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const confirmation = `Hi ${lead.first_name ?? "there"},\n\nYou're booked! ${service} on ${when} at ${settings.clinic_name}${settings.address ? `, ${settings.address}` : ""}.\n\nIf you need to change it, just reply to this email.\n\nSee you soon,\n${settings.clinic_name}`;
  if (lead.email) {
    try {
      await sendReply(leadId, confirmation, `Your appointment is confirmed — ${when}`, opts.via === "dashboard" ? "staff" : "ai");
    } catch (e) {
      console.error("confirmation failed", e);
    }
  }
  return appt;
}

// ---------- reply ----------

/**
 * Send the reply by Gmail when connected; otherwise record it locally (demo mode)
 * so the whole flow can be exercised without Google.
 */
export async function sendReply(leadId: string, body: string, subjectOverride?: string, sentBy: "ai" | "staff" = "ai") {
  const { lead, messages } = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  if (!lead.email) throw new Error("Lead has no email address");
  const settings = await getSettings();

  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const subject = subjectOverride || lastInbound?.subject || `Your inquiry to ${settings.clinic_name}`;

  let gmailId: string | null = null;
  let threadId: string | null = lead.gmail_thread_id;
  let delivered = false;

  if (await isGoogleConnected()) {
    const sent = await sendEmail({
      to: lead.email,
      subject,
      body,
      threadId: lead.gmail_thread_id,
      inReplyToMessageId: lastInbound?.gmail_message_id ?? null,
    });
    gmailId = sent.id ?? null;
    threadId = threadId ?? sent.threadId ?? null;
    delivered = true;
  } else {
    console.log(`[demo] would email ${lead.email}\nSubject: ${subject}\n\n${body}`);
  }

  db.insertMessage({
    lead_id: leadId,
    direction: "outbound",
    channel: delivered ? "email" : "local",
    subject,
    body,
    gmail_message_id: gmailId,
    sent_by: sentBy,
    sent_at: new Date().toISOString(),
  });
  const patch: Partial<Lead> = { ai_reply: null, followup_due_at: null };
  if (lead.status === "new") patch.status = "contacted";
  if (lead.status === "booked") delete patch.ai_reply; // confirmation on a booked lead keeps the state
  if (!lead.first_reply_at) patch.first_reply_at = new Date().toISOString();
  if (threadId && !lead.gmail_thread_id) patch.gmail_thread_id = threadId;
  db.updateLead(leadId, patch);
  return { id: gmailId, delivered };
}

// ---------- stats ----------

export async function dashboardStats() {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86400_000);
  const weekAhead = new Date(startOfToday.getTime() + 7 * 86400_000);

  const leads = db.listLeadsDb({ status: "all", limit: 100000 }).filter((l) => l.status !== "spam");
  const since = (d: Date) => leads.filter((l) => new Date(l.created_at) >= d);
  const monthLeads = since(monthAgo);

  const apptsToday = db.listAppointments(startOfToday, endOfToday).filter((a) => a.status !== "cancelled");
  const apptsWeek = db.listAppointments(startOfToday, weekAhead).filter((a) => a.status !== "cancelled");
  const upcoming = db.listAppointments(startOfToday, new Date(startOfToday.getTime() + 60 * 86400_000)).filter((a) => a.status !== "cancelled").slice(0, 8);

  const replied = monthLeads.filter((l) => l.first_reply_at);
  const replyTimes = replied.map((l) => (new Date(l.first_reply_at!).getTime() - new Date(l.created_at).getTime()) / 60000);
  const avgReplyMin = replyTimes.length ? Math.round(replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length) : null;

  const bySource: Record<string, number> = {};
  for (const l of monthLeads) bySource[l.source] = (bySource[l.source] ?? 0) + 1;

  const pending = leads.filter((l) => l.status === "new");
  const bookedMonth = monthLeads.filter((l) => l.status === "booked").length;

  // leads per day, last 14 days (oldest → newest)
  const localKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const perDay: { date: string; label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 86400_000);
    const key = localKey(d);
    perDay.push({
      date: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: leads.filter((l) => localKey(new Date(l.created_at)) === key).length,
    });
  }

  const byIntent: Record<string, number> = {};
  for (const l of monthLeads) if (l.intent) byIntent[l.intent] = (byIntent[l.intent] ?? 0) + 1;

  // ---- to-do list for the front desk ----
  type Todo = { lead: Lead; kind: "urgent" | "replied" | "draft" | "needs_reply" | "waiting"; label: string; action: string };
  const todos: Todo[] = [];
  for (const l of pending) {
    const inboundCount = db.messagesForLead(l.id).filter((m) => m.direction === "inbound").length;
    const waiting = l.followup_due_at && new Date(l.followup_due_at) > now;
    if (l.priority === "urgent") todos.push({ lead: l, kind: "urgent", label: "Urgent — reply now", action: l.ai_reply ? "Review & send" : "Reply" });
    else if (waiting) todos.push({ lead: l, kind: "waiting", label: `Waiting for patient to self-book (until ${new Date(l.followup_due_at!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`, action: "Send now" });
    else if (l.ai_reply && inboundCount > 1) todos.push({ lead: l, kind: "replied", label: "Patient replied — new draft ready", action: "Review & send" });
    else if (l.ai_reply) todos.push({ lead: l, kind: "draft", label: "Draft ready for approval", action: "Review & send" });
    else todos.push({ lead: l, kind: "needs_reply", label: "Needs a reply", action: "Write reply" });
  }
  const order = { urgent: 0, replied: 1, draft: 2, needs_reply: 3, waiting: 4 };
  todos.sort((a, b) => order[a.kind] - order[b.kind] || b.lead.created_at.localeCompare(a.lead.created_at));

  return {
    todos,
    perDay,
    byIntent,
    urgentLeads: pending.filter((l) => l.priority === "urgent"),
    leadsToday: since(startOfToday).length,
    leadsWeek: since(weekAgo).length,
    leadsMonth: monthLeads.length,
    pendingReplies: pending.length,
    urgent: pending.filter((l) => l.priority === "urgent").length,
    bookedMonth,
    conversion: monthLeads.length ? Math.round((bookedMonth / monthLeads.length) * 100) : 0,
    apptsToday: apptsToday.length,
    apptsWeek: apptsWeek.length,
    avgReplyMin,
    bySource,
    recentLeads: leads.slice(0, 8),
    upcoming,
  };
}
