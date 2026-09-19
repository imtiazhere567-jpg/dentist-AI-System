import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ClinicSettings, Lead, Message } from "./types";
import { SERVICE_OPTIONS } from "./site-content";

const MODEL = "claude-opus-5";

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export function hasAnthropic() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// ---------- schema the model must return ----------
export const LeadAnalysisSchema = z.object({
  is_lead: z
    .boolean()
    .describe("false if this is spam, a newsletter, an invoice, a vendor pitch, or otherwise not a patient inquiry"),
  intent: z.enum([
    "new_patient",
    "emergency",
    "cleaning",
    "price_inquiry",
    "insurance",
    "reschedule",
    "cancel",
    "kids",
    "invisalign",
    "dental_work",
    "general",
    "spam",
  ]),
  priority: z.enum(["urgent", "normal", "low"]),
  service: z
    .enum(SERVICE_OPTIONS)
    .describe("Which of the clinic's services this is about. Use 'Other' if unclear."),
  preferred_time: z
    .string()
    .describe("Any day/time preference the patient mentioned, verbatim-ish. Empty string if none."),
  summary: z.string().describe("One sentence for the front desk: who, what they want, anything urgent."),
  reply: z.string().describe("The full email reply to send to the patient. Plain text, no subject line, sign off with the clinic name."),
  safe_to_auto_send: z
    .boolean()
    .describe("true only for simple, low-risk questions (hours, location, insurance accepted, general info) where the reply needs no human check"),
  book_slot_iso: z
    .string()
    .describe(
      "If the patient's LATEST message clearly confirms or asks for one specific time that appears in the open slots list (e.g. '2 PM works', 'is 11:45 still open? I'll take it', 'Monday at 2'), return that slot's exact ISO value. Empty string if they didn't pick a specific available time.",
    ),
});
export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

function systemPrompt(s: ClinicSettings) {
  return `You are the front-desk assistant for ${s.clinic_name}, a dental clinic.
You triage incoming patient inquiries (from the website contact form and the clinic inbox) and draft replies.

Clinic facts (use these; never invent prices, hours, or policies not listed):
- Phone: ${s.phone ?? "n/a"}
- Address: ${s.address ?? "n/a"}
- Hours: ${s.hours ?? "n/a"}
- Services offered (map every inquiry to one of: ${SERVICE_OPTIONS.join(", ")}):
${s.services ?? "n/a"}
- Pricing notes: ${s.pricing_notes ?? "n/a"}
- Insurance accepted: ${s.insurance ?? "n/a"}
- Online booking link: ${s.booking_link ?? "none — offer to book by reply"}

Tone: ${s.tone ?? "Warm, friendly, concise."}

Rules:
- You are not a dentist. Never diagnose or give treatment advice beyond generic comfort tips (e.g. avoid chewing on that side, OTC pain relief as directed).
- Emergencies (pain, swelling, broken tooth, bleeding, knocked-out tooth) are priority "urgent" and the reply should offer a same-day visit and the phone number.
- Always end the reply with a clear next step: a question to confirm a time, or the booking link.
- Keep replies short: 3–6 sentences. Address the patient by first name if known.
- If the message is not a patient inquiry (spam, vendor, newsletter, invoice, job application), set is_lead=false and intent="spam".`;
}

function conversationText(lead: Lead, messages: Message[]) {
  const lines: string[] = [];
  lines.push(`Lead source: ${lead.source}`);
  if (lead.first_name || lead.last_name) lines.push(`Name: ${[lead.first_name, lead.last_name].filter(Boolean).join(" ")}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.phone) lines.push(`Phone: ${lead.phone}`);
  if (lead.service) lines.push(`Service selected on form: ${lead.service}`);
  lines.push("");
  if (messages.length === 0 && lead.message) {
    lines.push(`--- Patient message ---\n${lead.message}`);
  } else {
    for (const m of messages) {
      const who = m.direction === "inbound" ? "PATIENT" : "CLINIC";
      lines.push(`--- ${who} (${new Date(m.sent_at).toLocaleString("en-US")}) ---`);
      if (m.subject) lines.push(`Subject: ${m.subject}`);
      lines.push(m.body.trim());
      lines.push("");
    }
  }
  return lines.join("\n");
}

/**
 * Analyze one lead (with its conversation so far) and produce triage + a reply draft.
 * `openSlots` — optional list of human-readable free calendar slots to offer.
 */
export interface OpenSlot {
  iso: string;
  label: string;
}

export async function analyzeLead(
  lead: Lead,
  messages: Message[],
  settings: ClinicSettings,
  openSlots: OpenSlot[] = [],
): Promise<LeadAnalysis> {
  if (!hasAnthropic()) return demoAnalyze(lead, messages, settings, openSlots);

  const slotNote =
    openSlots.length > 0
      ? `\n\nOpen appointment slots (offer 2–3 that fit their preference; if they confirm one, return its ISO in book_slot_iso):\n${openSlots.map((s) => `- ${s.label}  [${s.iso}]`).join("\n")}`
      : "";

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: zodOutputFormat(LeadAnalysisSchema),
    },
    system: [{ type: "text", text: systemPrompt(settings), cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Triage this inquiry and draft the reply to the latest patient message.\n\n${conversationText(lead, messages)}${slotNote}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model refused to process this lead");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Model returned unparseable output");
  return parsed;
}

/**
 * DEMO MODE — used only when ANTHROPIC_API_KEY is missing. Keyword rules + templates so the
 * full lead → reply → booking flow can be seen locally. Replace by adding the real key.
 */
/**
 * Built-in time matcher: does the patient's latest message pick one of the open slots?
 * Understands "2 PM", "2:00", "at 11", "Monday at 2", "tomorrow 9:30", "the 11:45 one".
 */
export function matchConfirmedSlot(text: string, slots: OpenSlot[], isReply: boolean): string {
  if (!slots.length) return "";
  const t = text.toLowerCase();
  const intent = /\b(yes|yeah|yep|sure|ok(ay)?|perfect|works|good|great|book|take|confirm|fine|let'?s do|i'?ll come|see you|that one|please|still open|available)\b/.test(t);
  if (!intent && !isReply) return "";

  // time: "2 pm", "2:00 pm", "14:00", "at 2", "11:45"
  const m = t.match(/\b(?:at|around|for)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/) ?? t.match(/\b(\d{1,2}):(\d{2})\b/) ?? t.match(/\bat\s+(\d{1,2})\b/);
  if (!m) return "";
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ap = (m[3] ?? "").replace(/\./g, "");
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  if (!ap && hour >= 1 && hour <= 6) hour += 12; // "at 2" → 2 PM in a dental clinic
  if (hour > 23 || minute > 59) return "";

  // day: weekday name, tomorrow, today
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIdx = days.findIndex((d) => t.includes(d) || t.includes(d.slice(0, 3) + " ") || t.includes(d.slice(0, 3) + ","));
  const tomorrow = /\btomorrow|tmrw|tmr\b/.test(t);
  const today = /\btoday\b/.test(t);

  const candidates = slots.filter((sl) => {
    const d = new Date(sl.iso);
    if (d.getHours() !== hour || d.getMinutes() !== minute) return false;
    if (dayIdx >= 0 && d.getDay() !== dayIdx) return false;
    if (tomorrow) { const tm = new Date(); tm.setDate(tm.getDate() + 1); if (d.toDateString() !== tm.toDateString()) return false; }
    if (today && d.toDateString() !== new Date().toDateString()) return false;
    return true;
  });
  return candidates[0]?.iso ?? "";
}

function demoAnalyze(lead: Lead, messages: Message[], s: ClinicSettings, slots: OpenSlot[]): LeadAnalysis {
  const lastMsg = [...messages].reverse().find((m) => m.direction === "inbound");
  const last = lastMsg?.body ?? lead.message ?? "";
  const isReply = messages.some((m) => m.direction === "outbound");
  const t = `${lead.service ?? ""} ${last}`.toLowerCase();
  const name = lead.first_name ? `Hi ${lead.first_name},` : "Hello,";
  const sign = `\n\nWarmly,\n${s.clinic_name}${s.phone ? `\n${s.phone}` : ""}`;
  const labels = slots.map((x) => x.label);
  const slotLine = labels.length ? ` We currently have openings ${labels.slice(0, 3).join(", ")}.` : "";
  const bookLine = s.booking_link ? ` You can also book online here: ${s.booking_link}` : "";

  // patient confirmed a specific open time → book it (processLead handles the booking + confirmation)
  const confirmed = matchConfirmedSlot(last, slots, isReply);
  if (confirmed) {
    const when = new Date(confirmed).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
    return {
      is_lead: true,
      intent: lead.intent && lead.intent !== "spam" ? lead.intent : "general",
      priority: lead.priority ?? "normal",
      service: (SERVICE_OPTIONS as readonly string[]).includes(lead.service ?? "") ? (lead.service as LeadAnalysis["service"]) : "Other",
      preferred_time: when,
      summary: `Patient confirmed ${when} — booked automatically.`,
      reply: `${name}\n\nYou're booked for ${when}. See you then!${sign}`,
      safe_to_auto_send: true,
      book_slot_iso: confirmed,
    };
  }

  // service the patient picked on the form wins; otherwise infer from the message
  const picked = (SERVICE_OPTIONS as readonly string[]).includes(lead.service ?? "") ? (lead.service as LeadAnalysis["service"]) : null;
  const svc = (fallback: LeadAnalysis["service"]) => picked ?? fallback;

  if (/unsubscribe|newsletter|invoice|receipt|webinar|seo services|guest post/.test(t)) {
    return { is_lead: false, intent: "spam", priority: "low", service: "Other", preferred_time: "", summary: "Not a patient inquiry.", reply: "", safe_to_auto_send: false, book_slot_iso: "" };
  }
  const out = (intent: LeadAnalysis["intent"], priority: LeadAnalysis["priority"], service: LeadAnalysis["service"], summary: string, body: string, safe = false): LeadAnalysis => ({
    is_lead: true, intent, priority, service, preferred_time: "", summary, reply: `${name}\n\n${body}${sign}`, safe_to_auto_send: safe, book_slot_iso: "",
  });

  // a follow-up reply that talks about timing but doesn't match an open slot → offer alternatives
  if (isReply && /\b(am|pm|o'?clock|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|tomorrow|next week|this week)\b/.test(t) && !/price|cost|insurance|cancel/.test(t)) {
    return out(lead.intent && lead.intent !== "spam" ? lead.intent : "general", lead.priority ?? "normal",
      (SERVICE_OPTIONS as readonly string[]).includes(lead.service ?? "") ? (lead.service as LeadAnalysis["service"]) : "Other",
      "Patient is discussing a time — the exact slot isn't available.",
      `Thanks for getting back to us! That exact time isn't open, but here's what we have close to it:${slotLine ? slotLine.replace(" We currently have openings", "") : " please see the link below"} Reply with the one you'd like, or pick it yourself using the link below and it's yours.`);
  }
  const first = slots[0]?.label;

  if (/pain|hurt|crack|broke|swell|bleed|emergency|knocked|abscess|urgent/.test(t)) {
    const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const soonest = first
      ? first.startsWith(todayLabel)
        ? `We can fit you in today — our earliest opening is ${first}.`
        : `Our earliest opening is ${first}, and we'll do our best to squeeze you in sooner if anything frees up.`
      : "We'll get you in as soon as possible.";
    return out("emergency", "urgent", "Emergency / Pain", "Patient reports dental pain/damage — needs a same-day visit.",
      `I'm so sorry to hear that — this is something we want to see right away. ${soonest} Please call us${s.phone ? ` at ${s.phone}` : ""} if it can't wait, or book the earliest time using the link below and we'll hold it for you.\n\nIn the meantime, avoid chewing on that side and take over-the-counter pain relief as directed.`);
  }
  if (/invisalign|aligner|straight|braces/.test(t))
    return out("invisalign", "normal", "Invisalign", "Interested in Invisalign / straightening.",
      `Thanks for reaching out about Invisalign! Treatment cost depends on how long your plan needs to be, and we offer flexible payment options. The best next step is a free consultation with a digital smile scan so we can give you an exact quote.${slotLine} Which day works best for you?${bookLine}`);
  if (/price|cost|how much|fee|payment|afford/.test(t))
    return out("price_inquiry", "normal", svc("Other"), "Asking about pricing.",
      `Thanks for your message! ${s.pricing_notes ?? "We're happy to go over pricing with you."} We'd love to get you in for a visit so we can give you an exact quote.${slotLine} Would you like me to book a time for you?${bookLine}`);
  if (/insurance|coverage|direct billing|benefits/.test(t))
    return out("insurance", "normal", svc("The Essentials"), "Asking whether their insurance is accepted.",
      `Thanks for reaching out! ${s.insurance ?? "We accept most major insurance plans."} Just bring your insurance card to your first visit and we'll take care of the rest.${slotLine} Would you like me to book you in?${bookLine}`, true);
  if (/hours|open|location|address|where are you|parking/.test(t))
    return out("general", "low", svc("Other"), "Asking about hours / location.",
      `Thanks for your message! We're open ${s.hours ?? "weekdays"} and located at ${s.address ?? "our clinic"}. Let us know if you'd like to book a visit — we'd love to see you.${bookLine}`, true);
  if (/resched|move my|change my appointment|different time/.test(t))
    return out("reschedule", "normal", svc("Other"), "Wants to reschedule an appointment.",
      `No problem at all — we can move your appointment.${slotLine} Reply with a time that suits you and we'll update it right away.`);
  if (/cancel/.test(t))
    return out("cancel", "normal", svc("Other"), "Wants to cancel an appointment.",
      `Thanks for letting us know — we've noted your cancellation. Whenever you're ready to rebook, just reply here and we'll find you a time.`);
  if (/kid|child|son|daughter|year old/.test(t))
    return out("kids", "normal", "Kids Dentistry", "Parent booking for a child.",
      `We'd love to see your little one! Our Kids Dentistry visits are gentle and fun, with a checkup and cleaning.${slotLine} Which day works best for you?${bookLine}`);
  if (/crown|filling|root canal|implant|bridge|veneer|restor|chipped/.test(t))
    return out("dental_work", "normal", "Dental Work", "Needs restorative dental work.",
      `Thanks for reaching out! Our Dental Work visits cover fillings, crowns and restorative care. The best first step is an exam with imaging so we can plan the right treatment.${slotLine} Which day works best for you?${bookLine}`);
  if (/clean|checkup|check-up|exam|hygien|whiten|x-ray/.test(t))
    return out("cleaning", "normal", "The Essentials", "Wants a cleaning / checkup.",
      `Thanks for reaching out! We'd be happy to get you in for The Essentials — a comprehensive exam, cleaning and x-rays.${slotLine} Would a morning or afternoon work better for you?${bookLine}`);
  if (/new patient|moved|looking for a dentist|new dentist/.test(t))
    return out("new_patient", "normal", "The Essentials", "New patient looking for a dentist.",
      `Welcome! We'd love to have you as a new patient. Your first visit is The Essentials: a comprehensive exam, cleaning and x-rays.${slotLine} Which day works best for you?${bookLine}`);
  return out("general", "normal", svc("Other"), "General inquiry.",
    `Thanks for getting in touch! We'd be happy to help.${slotLine} Would you like to book a visit, or is there anything else we can answer first?${bookLine}`);
}

const EmailClassSchema = z.object({
  is_patient_inquiry: z.boolean(),
  first_name: z.string().describe("Best guess at sender's first name, empty if unknown"),
  last_name: z.string(),
  phone: z.string().describe("Phone number if present in the email, else empty"),
});

/** Cheap pre-filter for inbox emails: decide if this is a patient inquiry worth creating a lead for. */
export async function classifyEmail(
  from: string,
  subject: string,
  body: string,
  settings: ClinicSettings,
): Promise<z.infer<typeof EmailClassSchema>> {
  if (!hasAnthropic()) {
    const text = `${subject} ${body}`.toLowerCase();
    const spam = /unsubscribe|newsletter|invoice|receipt|webinar|promo|% off/.test(text);
    return { is_patient_inquiry: !spam, first_name: "", last_name: "", phone: "" };
  }
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(EmailClassSchema) },
    system: `You screen the inbox of ${settings.clinic_name}, a dental clinic. Decide whether an email is a real patient/prospective-patient inquiry (appointment, question about services, pain, insurance, pricing, reschedule, etc.). Newsletters, vendors, invoices, receipts, automated notifications, job applications and marketing are NOT patient inquiries.`,
    messages: [
      {
        role: "user",
        content: `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`,
      },
    ],
  });
  if (!response.parsed_output) throw new Error("Model returned unparseable output");
  return response.parsed_output;
}
