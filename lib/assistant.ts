/**
 * Front-desk AI assistant for the dashboard ("How many appointments today?", "Any urgent leads?").
 *
 * Two engines, same behaviour:
 *  - built-in (no API key): trained rules over live clinic data — greetings, small talk, stats,
 *    clinic info, patient lookup; anything else is politely declined.
 *  - Claude (ANTHROPIC_API_KEY set): same scope rules in the system prompt, live data as context.
 */
import Anthropic from "@anthropic-ai/sdk";
import { dashboardStats } from "./leads";
import { getSettings } from "./settings";
import * as db from "./db";
import { hasAnthropic } from "./ai";
import { leadName, type Appointment, type Lead } from "./types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Answer {
  reply: string;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = ["How many appointments today?", "Any urgent leads?", "How many leads are waiting for a reply?", "What's booked tomorrow?"];

// ---------------- helpers ----------------

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const startOfDay = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function apptsBetween(from: Date, to: Date) {
  return db.listAppointments(from, to).filter((a) => a.status !== "cancelled");
}

function listAppts(list: Appointment[], withDay = false) {
  if (!list.length) return "";
  return list
    .map((a) => `• ${withDay ? new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " " : ""}${fmtTime(a.starts_at)} — ${a.patient_name ?? a.title} (${a.service ?? "visit"})${a.status === "completed" ? " ✓" : ""}`)
    .join("\n");
}

function listLeads(list: Lead[]) {
  return list.map((l) => `• ${leadName(l)}${l.priority === "urgent" ? " 🚨" : ""} — ${l.ai_summary ?? l.message?.slice(0, 70) ?? ""} [${l.status}]`).join("\n");
}

// ---------------- lead lookup + conversation summary ----------------

/** Find a lead whose first or last name (or full name) appears in the question. Longest match wins. */
function findMentionedLead(q: string): Lead | null {
  const leads = db.listLeadsDb({ status: "all", limit: 10000 }).filter((l) => l.status !== "spam");
  const words = q.replace(/[^a-z' ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
  let best: { lead: Lead; score: number } | null = null;
  for (const l of leads) {
    const first = (l.first_name ?? "").toLowerCase();
    const last = (l.last_name ?? "").toLowerCase();
    const full = `${first} ${last}`.trim();
    let score = 0;
    if (full && q.includes(full)) score = 3;
    else if (first && words.includes(first)) score = 2;
    else if (last && words.includes(last)) score = 1;
    if (score && (!best || score > best.score || (score === best.score && l.created_at > best.lead.created_at))) best = { lead: l, score };
  }
  return best?.lead ?? null;
}

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const snippet = (s: string, n = 110) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/** Human-readable recap of everything that happened with one patient. */
function conversationSummary(lead: Lead): string {
  const name = leadName(lead);
  const msgs = db.messagesForLead(lead.id);
  const appts = db.appointmentsForLead(lead.id).filter((a) => a.status !== "cancelled");
  const inbound = msgs.filter((m) => m.direction === "inbound");
  const outbound = msgs.filter((m) => m.direction === "outbound");
  const firstReplyMin = lead.first_reply_at ? Math.max(1, Math.round((new Date(lead.first_reply_at).getTime() - new Date(lead.created_at).getTime()) / 60000)) : null;
  const aiSent = outbound.filter((m) => m.sent_by === "ai").length;

  // one-paragraph "in short"
  const parts: string[] = [];
  parts.push(`${name} reached out by ${lead.source === "email" ? "email" : "the website form"} on ${fmtWhen(lead.created_at)} about ${lead.service ?? "a visit"}${lead.priority === "urgent" ? " (flagged urgent 🚨)" : ""}.`);
  if (lead.ai_summary) parts.push(lead.ai_summary);
  if (outbound.length) {
    parts.push(`We replied ${firstReplyMin != null ? `within ${firstReplyMin} min` : "soon after"}${aiSent ? ` (${aiSent === outbound.length ? "all" : aiSent} sent automatically by the AI)` : ""}; ${inbound.length > 1 ? `${name.split(" ")[0]} wrote back ${inbound.length - 1} more time${inbound.length > 2 ? "s" : ""}` : "no reply from them yet"}.`);
  } else {
    parts.push("No reply has been sent yet.");
  }
  if (appts.length) {
    const upcoming = appts.filter((a) => new Date(a.starts_at) >= new Date());
    const done = appts.filter((a) => a.status === "completed");
    const noShow = appts.filter((a) => a.status === "no_show");
    if (upcoming.length) parts.push(`Outcome: booked — ${upcoming.map((a) => `${a.service ?? "visit"} on ${fmtWhen(a.starts_at)}`).join(" and ")}${upcoming[0].booked_via === "patient_link" ? " (self-booked from their link)" : ""}.`);
    if (done.length) parts.push(`Visit completed on ${fmtWhen(done[done.length - 1].starts_at)}${done[done.length - 1].notes ? ` — ${done[done.length - 1].notes}` : ""}.`);
    if (noShow.length) parts.push(`⚠️ No-show on ${fmtWhen(noShow[0].starts_at)}.`);
  } else if (lead.status === "lost") {
    parts.push("Outcome: lost — they didn't go ahead.");
  } else if (lead.status === "new") {
    parts.push(lead.ai_reply ? "Next step: an AI draft is waiting for approval in Leads → New." : "Next step: needs a reply.");
  } else if (lead.status === "contacted") {
    parts.push("Next step: waiting to hear back from them.");
  }

  // timeline
  const timeline = msgs.map((m) => {
    const who = m.direction === "inbound" ? name.split(" ")[0] : m.sent_by === "ai" ? "Swish (AI, auto)" : "Swish (staff)";
    return `• ${fmtWhen(m.sent_at)} — ${who}: ${snippet(m.body.split("\n\nWarmly")[0].split("\n\nEarliest openings")[0])}`;
  });

  return `${parts.join(" ")}\n\nTimeline (${msgs.length} message${msgs.length === 1 ? "" : "s"}):\n${timeline.join("\n")}`;
}

// ---------------- built-in engine ----------------

export async function answerLocally(question: string, history: ChatTurn[] = []): Promise<Answer> {
  const q = question.toLowerCase().trim();
  const settings = await getSettings();
  const s = await dashboardStats();
  const clinic = settings.clinic_name;
  const say = (reply: string, suggestions?: string[]): Answer => ({ reply, suggestions: suggestions ?? DEFAULT_SUGGESTIONS });

  // ---- small talk ----
  if (/^(hi|hii+|hello|hey|yo|hola|salam|assalam[\s-]*o[\s-]*alaikum|good\s*(morning|afternoon|evening|day))\b[!. ]*$/.test(q) || /^(hi|hello|hey)\b/.test(q) && q.length < 25) {
    const hour = new Date().getHours();
    const g = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return say(`${g}! 👋 I'm the ${clinic} front-desk assistant. I can tell you about today's appointments, leads waiting for a reply, urgent cases, bookings and clinic details. What would you like to know?`);
  }
  if (/how (are|r) (you|u)|how's it going|how are things|how do you do|kaise ho|kya haal/.test(q)) {
    return say("I'm doing good, thank you! How are you? 😊 How can I help you today — appointments, leads, or something about the clinic?");
  }
  if (/^(i'?m|i am) (good|fine|great|ok|okay|well)/.test(q) || /^(good|fine|great|not bad|all good)[!. ]*$/.test(q)) {
    return say("Glad to hear it! What can I check for you?");
  }
  if (/thank|thx|shukriya|appreciate/.test(q)) return say("You're welcome! Anything else I can look up?");
  if (/^(bye|goodbye|see you|good night|ok bye|later)\b/.test(q)) return say("Bye! I'll be here whenever you need a quick update. 👋");
  if (/who are you|what are you|your name|what can you do|help me|^help$|what do you know/.test(q)) {
    return say(`I'm the ${clinic} front-desk assistant. I only answer questions about this clinic's data:\n\n• Appointments — today, tomorrow, this week, next appointment, a specific patient\n• Leads — new, waiting for a reply, urgent, where they come from\n• Bookings & conversion — how many booked, response speed\n• Clinic info — hours, address, phone, services, insurance, pricing notes\n\nTry one of the suggestions below.`);
  }

  // ---- conversation history: "what happened with Marcus", "summary of Marcus", "what did Sofia say" ----
  const mentioned = findMentionedLead(q);
  const wantsHistory = /convers|chat|talk|said|say|discuss|histor|record|summar|happen|went|going on|update|status|story|thread|messages?|email(s|ed)?|what.*about|tell me about|details? (on|of|about)|regarding/.test(q);
  if (mentioned && (wantsHistory || !/appointment|booking|booked|when is|find|look ?up|search/.test(q))) {
    return say(conversationSummary(mentioned), ["When is " + (mentioned.first_name ?? "they") + " booked?", "Any urgent leads?", "How many appointments today?"]);
  }

  // ---- patient lookup: "when is Sara booked", "appointment for Marcus", "do we have Lee" ----
  const nameMatch = q.match(/(?:when is|when's|appointment (?:for|of)|booking (?:for|of)|find|look ?up|search|do we have|is)\s+([a-z][a-z' -]{1,40}?)(?:'s)?(?:\s+(?:booked|appointment|coming|scheduled|in|here))?[?.!]*$/);
  if (nameMatch && !/today|tomorrow|week|month|lead|appointment[s]? (today|tomorrow)/.test(nameMatch[1])) {
    const name = nameMatch[1].trim();
    const hits = db.searchAppointmentsByName(name).filter((a) => a.status !== "cancelled");
    const leads = db.listLeadsDb({ status: "all", limit: 10000 }).filter((l) => leadName(l).toLowerCase().includes(name));
    if (hits.length) {
      const upcoming = hits.filter((a) => new Date(a.starts_at) >= new Date());
      const show = upcoming.length ? upcoming : hits;
      return say(`${upcoming.length ? "Upcoming" : "Past"} appointment${show.length > 1 ? "s" : ""} for "${name}":\n${listAppts(show, true)}`);
    }
    if (leads.length) return say(`No appointment for "${name}" yet, but I found ${plural(leads.length, "lead")}:\n${listLeads(leads.slice(0, 5))}`);
    if (/^[a-z]+( [a-z]+)?$/.test(name) && !/appointment|lead|booking|patient/.test(name)) return say(`I couldn't find anyone named "${name}" in appointments or leads.`);
  }

  // ---- time words ----
  const today = /\btoday|to-day|this morning|this afternoon|tonight|now\b/.test(q);
  const tomorrow = /\btomorrow|tmrw|tmr\b/.test(q);
  const yesterday = /\byesterday\b/.test(q);
  const week = /\b(this|next|coming) week|7 days|week\b/.test(q);
  const month = /\b(this|last) month|30 days|month\b/.test(q);

  const aboutAppts = /appointment|booking|booked|schedule|calendar|visit|patients? (coming|today|tomorrow)|who('s| is) (coming|next|booked)|next (patient|appointment)|slots?|busy|free/.test(q);
  const aboutLeads = /\blead|inquir|enquir|request|message|contact|form|email|reply|respond|pending|waiting|unanswered|urgent|emergenc/.test(q);

  // ---- appointments ----
  if (aboutAppts && !aboutLeads) {
    if (/next (patient|appointment|one)|who('s| is) next|who is coming next|upcoming/.test(q) && !week && !tomorrow) {
      const next = apptsBetween(new Date(), startOfDay(60)).filter((a) => new Date(a.starts_at) >= new Date());
      if (!next.length) return say("Nothing scheduled — the calendar is clear.");
      const n = next[0];
      return say(`Next up: ${n.patient_name ?? n.title} for ${n.service ?? "a visit"} on ${new Date(n.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${fmtTime(n.starts_at)}.${next.length > 1 ? `\n\nAfter that:\n${listAppts(next.slice(1, 4), true)}` : ""}`);
    }
    if (/free|slot|availab|opening|gap/.test(q)) {
      const { getFreeSlots } = await import("./slots");
      const slots = await getFreeSlots(tomorrow ? 2 : 7, settings.slot_minutes);
      const filtered = tomorrow ? slots.filter((x) => new Date(x.iso) >= startOfDay(1) && new Date(x.iso) < startOfDay(2)) : today ? slots.filter((x) => new Date(x.iso) < startOfDay(1)) : slots;
      if (!filtered.length) return say(`No open slots ${tomorrow ? "tomorrow" : today ? "for the rest of today" : "in the next 7 days"}.`);
      return say(`${filtered.length} open slot${filtered.length > 1 ? "s" : ""} ${tomorrow ? "tomorrow" : today ? "today" : "in the next 7 days"}. First few:\n${filtered.slice(0, 6).map((x) => `• ${x.label}`).join("\n")}`);
    }
    if (tomorrow) {
      const list = apptsBetween(startOfDay(1), startOfDay(2));
      return say(list.length ? `Tomorrow (${fmtDay(startOfDay(1))}) you have ${plural(list.length, "appointment")}:\n${listAppts(list)}` : `Nothing booked for tomorrow (${fmtDay(startOfDay(1))}).`);
    }
    if (yesterday) {
      const list = apptsBetween(startOfDay(-1), startOfDay(0));
      return say(list.length ? `Yesterday had ${plural(list.length, "appointment")}:\n${listAppts(list)}` : "There were no appointments yesterday.");
    }
    if (week) {
      const list = apptsBetween(startOfDay(0), startOfDay(7));
      return say(list.length ? `${plural(list.length, "appointment")} in the next 7 days:\n${listAppts(list, true)}` : "The next 7 days are clear — no appointments booked.");
    }
    if (month) {
      const list = apptsBetween(startOfDay(0), startOfDay(30));
      return say(`${plural(list.length, "appointment")} in the next 30 days.${list.length ? `\n\nNext few:\n${listAppts(list.slice(0, 6), true)}` : ""}`);
    }
    // default: today
    const list = apptsBetween(startOfDay(0), startOfDay(1));
    const remaining = list.filter((a) => new Date(a.ends_at) > new Date() && a.status === "scheduled");
    if (!list.length) return say(`No appointments today (${fmtDay(startOfDay(0))}). ${s.apptsWeek ? `${s.apptsWeek === 1 ? "There is 1" : `There are ${s.apptsWeek}`} in the next 7 days.` : ""}`.trim());
    return say(`You have ${plural(list.length, "appointment")} today${remaining.length && remaining.length !== list.length ? ` (${remaining.length} still to come)` : ""}:\n${listAppts(list)}`);
  }

  // ---- leads ----
  if (aboutLeads) {
    if (/urgent|emergenc|priority|attention/.test(q)) {
      return say(s.urgentLeads.length ? `🚨 ${plural(s.urgentLeads.length, "urgent lead")} waiting:\n${listLeads(s.urgentLeads)}\n\nOpen Leads → New to send the reply.` : "No urgent leads right now. 👍");
    }
    if (/pending|waiting|unanswered|not (yet )?replied|need(s)? (a )?reply|no reply|open/.test(q) || /how many .*new/.test(q)) {
      const pending = db.listLeadsDb({ status: "new" });
      return say(pending.length ? `${plural(pending.length, "lead")} waiting for a reply${s.urgent ? ` (${s.urgent} urgent)` : ""}:\n${listLeads(pending.slice(0, 8))}` : "All caught up — no leads waiting for a reply. 🎉");
    }
    if (/where|source|come from|website|email|channel/.test(q)) {
      const rows = Object.entries(s.bySource);
      return say(rows.length ? `Leads by source (last 30 days):\n${rows.map(([k, v]) => `• ${k}: ${v}`).join("\n")}` : "No leads in the last 30 days yet.");
    }
    if (/recent|latest|last few|newest/.test(q)) {
      return say(s.recentLeads.length ? `Most recent leads:\n${listLeads(s.recentLeads.slice(0, 6))}` : "No leads yet.");
    }
    if (/booked|convert|conversion|won|closed/.test(q)) {
      return say(`In the last 30 days ${s.bookedMonth} of ${s.leadsMonth} leads booked an appointment — a ${s.conversion}% conversion rate.`);
    }
    if (/spam/.test(q)) {
      const spam = db.listLeadsDb({ status: "spam" });
      return say(`${plural(spam.length, "message")} filtered as spam.`);
    }
    if (today) return say(`${plural(s.leadsToday, "new lead")} came in today${s.pendingReplies ? `, ${s.pendingReplies} waiting for a reply` : ""}.`);
    if (week) return say(`${plural(s.leadsWeek, "lead")} this week (${s.leadsToday} today). ${s.pendingReplies ? `${s.pendingReplies} still need a reply.` : "All replied."}`);
    if (month) return say(`${plural(s.leadsMonth, "lead")} in the last 30 days, ${s.bookedMonth} booked (${s.conversion}%).`);
    // generic lead question → overview
    return say(`Leads overview:\n• Today: ${s.leadsToday}\n• This week: ${s.leadsWeek}\n• Last 30 days: ${s.leadsMonth}\n• Waiting for a reply: ${s.pendingReplies}${s.urgent ? ` (${s.urgent} urgent 🚨)` : ""}\n• Booked (30d): ${s.bookedMonth} → ${s.conversion}% conversion`);
  }

  // ---- performance ----
  if (/response time|reply time|how fast|how quick|speed/.test(q)) {
    return say(s.avgReplyMin == null ? "No replies sent yet, so there's no average response time." : `Average time to first reply is ${s.avgReplyMin < 1 ? "under a minute" : `${s.avgReplyMin} minutes`} (last 30 days).${s.avgReplyMin > 5 ? " Under 5 minutes converts best — the AI drafts help you get there." : " Excellent — under 5 minutes converts best."}`);
  }
  if (/conversion|convert|how many booked|bookings? (this|last) month|booked/.test(q)) {
    return say(`${s.bookedMonth} of ${s.leadsMonth} leads booked in the last 30 days (${s.conversion}% conversion).`);
  }
  if (/summary|overview|how('s| is) (business|it going|the clinic)|status|report|dashboard|numbers/.test(q)) {
    return say(`Here's today's snapshot:\n• Appointments today: ${s.apptsToday} (${s.apptsWeek} in the next 7 days)\n• New leads this week: ${s.leadsWeek}\n• Waiting for a reply: ${s.pendingReplies}${s.urgent ? ` (${s.urgent} urgent 🚨)` : ""}\n• Lead → booking: ${s.conversion}%\n• Avg first reply: ${s.avgReplyMin == null ? "—" : s.avgReplyMin < 1 ? "under a minute" : `${s.avgReplyMin} min`}`);
  }

  // ---- clinic info ----
  if (/hour|open|close|timing|what time|when (are|do) (you|we)/.test(q)) return say(`${clinic} hours: ${settings.hours ?? "not set — add them in Settings"}.`);
  if (/address|location|where (are|is)|directions|map/.test(q)) return say(`${clinic} is at ${settings.address ?? "an address not set yet (Settings)"}.`);
  if (/phone|number|call|contact/.test(q)) return say(`Clinic phone: ${settings.phone ?? "not set"}${settings.clinic_email ? ` · email: ${settings.clinic_email}` : ""}.`);
  if (/service|offer|treatment|what do (you|we) do|invisalign|cleaning|kids|dental work/.test(q)) return say(`Services at ${clinic}:\n${(settings.services ?? "").split("\n").map((x) => `• ${x}`).join("\n")}`);
  if (/insurance|coverage|billing/.test(q)) return say(`Insurance: ${settings.insurance ?? "not set"}.`);
  if (/price|cost|fee|how much|pricing|payment|financ/.test(q)) return say(`Pricing notes: ${settings.pricing_notes ?? "not set"}.`);

  // ---- bare "how many" without a subject → guess from history ----
  if (/how many|count|total/.test(q)) {
    const last = [...history].reverse().find((h) => h.role === "user")?.content.toLowerCase() ?? "";
    if (/appointment|booking/.test(last)) return answerLocally(`${question} appointments`, []);
    if (/lead/.test(last)) return answerLocally(`${question} leads`, []);
    return say(`Do you mean appointments or leads? Right now: ${s.apptsToday} appointments today and ${s.pendingReplies} leads waiting for a reply.`);
  }

  // ---- out of scope ----
  return say(
    `Sorry, I can't help with that — I only answer questions about ${clinic}'s appointments, leads, bookings and clinic details.\n\nYou could ask me:\n• "How many appointments today?"\n• "Any urgent leads?"\n• "When is Emily booked?"\n• "What are our hours?"`,
  );
}

// ---------------- Claude engine ----------------

async function buildContext() {
  const settings = await getSettings();
  const s = await dashboardStats();
  const week = apptsBetween(startOfDay(0), startOfDay(7));
  const pending = db.listLeadsDb({ status: "new" });
  return { settings, snapshot: { ...s, recentLeads: s.recentLeads.map((l) => ({ name: leadName(l), status: l.status, priority: l.priority, summary: l.ai_summary, created_at: l.created_at })), upcoming: undefined, urgentLeads: undefined }, weekAppointments: week.map((a) => ({ when: a.starts_at, patient: a.patient_name, service: a.service, status: a.status })), pendingLeads: pending.map((l) => ({ name: leadName(l), priority: l.priority, summary: l.ai_summary, service: l.service })) };
}

export async function answerWithClaude(question: string, history: ChatTurn[]): Promise<Answer> {
  const client = new Anthropic();
  const ctx = await buildContext();
  const today = fmtDay(new Date());
  // if a patient is mentioned, give Claude their full thread
  const mentioned = findMentionedLead(question.toLowerCase());
  const threadCtx = mentioned
    ? `\n\nFull record for ${leadName(mentioned)} (status ${mentioned.status}, service ${mentioned.service}, priority ${mentioned.priority}):\n${db.messagesForLead(mentioned.id).map((m) => `[${fmtWhen(m.sent_at)}] ${m.direction === "inbound" ? leadName(mentioned) : m.sent_by === "ai" ? "Swish (AI auto)" : "Swish (staff)"}: ${m.body}`).join("\n---\n")}\nAppointments: ${JSON.stringify(db.appointmentsForLead(mentioned.id).map((a) => ({ when: a.starts_at, service: a.service, status: a.status, booked_via: a.booked_via, notes: a.notes })))}`
    : "";
  const system = `You are the front-desk assistant inside the ${ctx.settings.clinic_name} dashboard, talking to clinic staff or the dentist.

Today is ${today}. Answer ONLY using the live data below. Keep answers short and friendly, use bullet lists for multiple items, times like "10:00 AM".

Scope rules:
- Greetings / small talk: respond warmly and briefly (e.g. "I'm doing good, thank you! How are you? How can I help?") then offer help.
- Questions about appointments, leads, bookings, conversion, response time, or clinic details (hours, address, phone, services, insurance, pricing): answer from the data.
- Anything else (general knowledge, medical advice, other businesses, writing tasks): politely say you can only answer questions about ${ctx.settings.clinic_name}'s appointments, leads, bookings and clinic details, and suggest an example question.
- Never invent patients, times or numbers. If the data doesn't contain it, say so.

Clinic settings: ${JSON.stringify({ name: ctx.settings.clinic_name, hours: ctx.settings.hours, address: ctx.settings.address, phone: ctx.settings.phone, services: ctx.settings.services, insurance: ctx.settings.insurance, pricing_notes: ctx.settings.pricing_notes })}
Stats snapshot: ${JSON.stringify(ctx.snapshot)}
Appointments next 7 days: ${JSON.stringify(ctx.weekAppointments)}
Leads waiting for a reply: ${JSON.stringify(ctx.pendingLeads)}${threadCtx}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
    { role: "user", content: question },
  ];
  const res = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system,
    messages,
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  return { reply: text || "Sorry, I couldn't come up with an answer.", suggestions: DEFAULT_SUGGESTIONS };
}

export async function answer(question: string, history: ChatTurn[] = []): Promise<Answer & { engine: "claude" | "built-in" }> {
  if (hasAnthropic()) {
    try {
      return { ...(await answerWithClaude(question, history)), engine: "claude" };
    } catch (e) {
      console.error("[assistant] claude failed, using built-in", e);
    }
  }
  return { ...(await answerLocally(question, history)), engine: "built-in" };
}
