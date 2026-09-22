/**
 * Sample data for the dashboard — realistic Swish leads with full email threads and appointments,
 * dated relative to "now" so it always looks current. Loaded automatically when the database is
 * empty (local AND live); Settings → Data can reload or clear it.
 */
import * as db from "./db";
import { appUrl } from "./url";
import type { LeadIntent, LeadPriority, LeadSource, LeadStatus, ApptStatus } from "./types";

const SIGN = "\n\nWarmly,\nSwish\n1-825-540-7183";
const base = () => appUrl();

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};
/** shift weekends to the next Monday so sample bookings land on working days */
const workday = (dayOffset: number, hour: number, minute = 0) => {
  const d = at(dayOffset, hour, minute);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  return d;
};
const dayLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const timeLabel = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

type Msg = { dir: "in" | "out"; ago: number; body: string; subject?: string; auto?: boolean };
type SeedLead = {
  first: string; last: string; email: string; phone?: string; source: LeadSource; status: LeadStatus;
  service: string; intent: LeadIntent; priority?: LeadPriority; summary: string;
  /** the whole thread, oldest first. `ago` = hours ago. */
  thread: Msg[];
  /** draft waiting for approval (only when status = new) */
  draft?: string;
  /** appointment to create for this lead */
  appt?: { day: number; hour: number; minute?: number; mins?: number; via: "dashboard" | "patient_link" | "ai"; notes?: string; status?: ApptStatus }[];
};

// appointment times referenced inside the conversations
const MARCUS_APPT = workday(1, 14);
const PRIYA_APPT = workday(3, 9);
const DANIEL_APPT = workday(2, 15);

const LEADS: SeedLead[] = [
  // ── 1. Emergency by email → AI auto-replied instantly → back-and-forth → booked ──
  {
    first: "Marcus", last: "Lee", email: "marcus.lee88@gmail.com", phone: "403-555-0199", source: "email", status: "booked",
    service: "Emergency / Pain", intent: "emergency", priority: "urgent",
    summary: "Cracked molar with pain. AI replied in under a minute; patient confirmed 2:00 PM by email; AI booked it automatically.",
    thread: [
      { dir: "in", ago: 27, subject: "Tooth pain — can I come in today?", body: "Hi, my back tooth cracked last night and it hurts a lot when I bite. Can anyone see me today or tomorrow?\n\nMarcus" },
      { dir: "out", ago: 26.98, auto: true, body: `Hi Marcus,\n\nI'm so sorry to hear that — a cracked tooth with pain is something we want to see right away. Our earliest opening is ${dayLabel(workday(1, 11))} at 11:00 AM, and we'll do our best to squeeze you in sooner if anything frees up. Please call us at 1-825-540-7183 if it can't wait.\n\nIn the meantime, avoid chewing on that side and take over-the-counter pain relief as directed.${SIGN}\n\nEarliest openings: ${dayLabel(workday(1, 11))} 11:00 AM · 11:45 AM · 2:00 PM.\nPick a time that suits you here (takes 10 seconds): {{LINK}}` },
      { dir: "in", ago: 25.5, body: "Thanks for the quick reply! I have work in the morning — 2:00 PM works for me, please book that. The pain is manageable with Advil for now." },
      { dir: "out", ago: 25.49, auto: true, body: `Hi Marcus,\n\nYou're booked! Emergency / Pain on ${dayLabel(MARCUS_APPT)} at 2:00 PM at Swish, 3928 University Ave NW Calgary, AB T3B 6N7.\n\nIf you need to change it, just reply to this email.\n\nSee you soon,\nSwish` },
      { dir: "in", ago: 24.9, body: "Perfect, thank you so much. See you then." },
    ],
    appt: [{ day: 1, hour: 14, mins: 60, via: "ai", notes: "Cracked lower-right molar, pain on biting. Managing with Advil." }],
  },

  // ── 2. Email question → AI draft waiting for approval (shows the approve flow) ──
  {
    first: "Daniel", last: "Okafor", email: "daniel.okafor@outlook.com", phone: "403-555-0177", source: "email", status: "new",
    service: "Dental Work", intent: "dental_work",
    summary: "Lost crown, no pain — wants it looked at this week. Draft ready for approval.",
    thread: [
      { dir: "in", ago: 1.2, subject: "Crown came off", body: "Hello,\n\nMy old crown on the upper left came off while eating yesterday. It doesn't hurt but I'd like it looked at this week if possible. Do I need to bring the old crown with me?\n\nThanks,\nDaniel" },
    ],
    draft: `Hi Daniel,\n\nThanks for letting us know — a lost crown is worth seeing soon even without pain, so the tooth stays protected. Yes, please bring the old crown along; sometimes it can be re-cemented, and if not we'll plan a replacement in the same visit with an exam and imaging.\n\nWe have openings this week — pick whatever suits you below.${SIGN}`,
  },

  // ── 3. Website new patient → AI draft waiting (visitor didn't self-book yet) ──
  {
    first: "Emily", last: "Carter", email: "emily.carter@gmail.com", phone: "403-555-0142", source: "website", status: "new",
    service: "The Essentials", intent: "new_patient",
    summary: "New patient near University District, asks about direct billing, wants The Essentials.",
    thread: [
      { dir: "in", ago: 2.5, body: "Hi, I just moved to the University District and need a new dentist. Do you do direct billing with insurance? Would love a cleaning soon." },
    ],
    draft: `Hi Emily,\n\nWelcome to the neighbourhood! Yes, we bill most insurance plans directly. We'd love to get you in for The Essentials — a comprehensive exam, cleaning and x-rays — and we have openings this week at University District. Would a morning or afternoon work better for you?${SIGN}`,
  },

  // ── 4. Pricing question → replied → patient came back with a follow-up → new draft ──
  {
    first: "Sofia", last: "Nguyen", email: "sofia.nguyen21@gmail.com", source: "website", status: "new",
    service: "Invisalign", intent: "price_inquiry",
    summary: "Asked Invisalign cost; we offered a free consult; she now wants Thursday afternoon. Draft ready.",
    thread: [
      { dir: "in", ago: 50, body: "How much is Invisalign roughly? And do you offer payment plans?" },
      { dir: "out", ago: 49.6, body: `Hi Sofia,\n\nThanks for reaching out! Invisalign pricing depends on the length of treatment, and we offer flexible payment plans. The best next step is a free consultation with a digital smile scan so we can give you an exact quote. Would you like me to book one for you?${SIGN}` },
      { dir: "in", ago: 3, body: "Yes please! Do you have anything Thursday afternoon? Also — does the consultation cost anything?" },
    ],
    draft: `Hi Sofia,\n\nGreat — the consultation is completely free, including the digital scan. Thursday afternoon works: we have 1:15 PM, 2:45 PM and 3:30 PM open. Pick whichever suits you below and we'll get you set up.${SIGN}`,
  },

  // ── 5. Kids (twins) → replied → parent confirmed → two appointments booked ──
  {
    first: "Priya", last: "Sharma", email: "priya.sharma@yahoo.ca", phone: "403-555-0164", source: "website", status: "booked",
    service: "Kids Dentistry", intent: "kids",
    summary: "First visit for 5-year-old twins; booked back-to-back on " + dayLabel(PRIYA_APPT) + " at 9:00 and 9:45 AM.",
    thread: [
      { dir: "in", ago: 75, body: "Looking for a gentle dentist for my twins (age 5). They've never been before — do you do first visits?" },
      { dir: "out", ago: 74.7, body: `Hi Priya,\n\nWe'd love to meet the twins! First visits at Swish are gentle and fun — a look around, a gentle checkup and a cleaning if they're comfortable. We can book both of them back-to-back so it's one trip for you. Which day works best?${SIGN}` },
      { dir: "in", ago: 70, body: "That sounds perfect. Mornings are best for them — anything early next week?" },
      { dir: "out", ago: 69.5, body: `Hi Priya,\n\nDone — ${dayLabel(PRIYA_APPT)} at 9:00 AM and 9:45 AM, one after the other. You'll get two calendar invites. Tip: let them bring a favourite toy, and we'll take it slow.${SIGN}` },
      { dir: "in", ago: 69, body: "Amazing, thank you! See you then 😊" },
    ],
    appt: [
      { day: 3, hour: 9, via: "dashboard", notes: "Twin 1 — first visit, age 5" },
      { day: 3, hour: 9, minute: 45, via: "dashboard", notes: "Twin 2 — first visit, age 5" },
    ],
  },

  // ── 6. Website → patient self-booked from the link (no staff work at all) ──
  {
    first: "Anna", last: "Roberts", email: "anna.roberts@shaw.ca", source: "website", status: "booked",
    service: "The Essentials", intent: "cleaning",
    summary: "Returning patient wanted a cleaning; self-booked from her link within 3 minutes.",
    thread: [
      { dir: "in", ago: 96, body: "Hi! It's been about a year since my last cleaning. Do you have anything this week?" },
      { dir: "out", ago: 95.95, body: `Hi Anna,\n\nYou're booked! The Essentials on ${dayLabel(at(0, 11))} at 11:00 AM at Swish, 3928 University Ave NW Calgary, AB T3B 6N7.\n\nIf you need to change it, just reply to this email.\n\nSee you soon,\nSwish` },
    ],
    appt: [{ day: 0, hour: 11, mins: 60, via: "patient_link" }],
  },

  // ── 7. Insurance question by email → auto-answered (safe question) ──
  {
    first: "Hannah", last: "Weiss", email: "hannah.weiss@telus.net", source: "email", status: "contacted",
    service: "The Essentials", intent: "insurance",
    summary: "Asked if we accept Sun Life; answered automatically.",
    thread: [
      { dir: "in", ago: 8, subject: "Insurance question", body: "Hi there, do you accept Sun Life insurance? And do I pay upfront or do you bill them directly?" },
      { dir: "out", ago: 7.98, auto: true, body: `Hi Hannah,\n\nThanks for reaching out! Most major dental insurance plans are accepted, including Sun Life, and we bill directly — you only pay any portion your plan doesn't cover. Just bring your insurance card to your first visit and we'll take care of the rest.\n\nWould you like me to book you in?${SIGN}\n\nPick a time that suits you here (takes 10 seconds): {{LINK}}` },
    ],
  },

  // ── 8. Chipped tooth → booked → visit completed ──
  {
    first: "Tom", last: "Baker", email: "tom.baker@icloud.com", phone: "403-555-0133", source: "website", status: "booked",
    service: "Dental Work", intent: "dental_work",
    summary: "Chipped front tooth from hockey; bonded yesterday.",
    thread: [
      { dir: "in", ago: 120, body: "I have a chipped front tooth from a hockey game. Can this be fixed? It's not painful, just looks bad." },
      { dir: "out", ago: 119.5, body: `Hi Tom,\n\nAbsolutely — a chipped front tooth can usually be bonded in a single visit and it'll look like nothing happened. Book a Dental Work visit below and we'll take care of it.${SIGN}` },
    ],
    appt: [{ day: -1, hour: 15, mins: 60, via: "patient_link", status: "completed", notes: "Chipped #8 — composite bonding done" }],
  },

  // ── 9. Invisalign consult done ──
  {
    first: "Lena", last: "Ortiz", email: "lena.ortiz@gmail.com", source: "website", status: "booked",
    service: "Invisalign", intent: "invisalign",
    summary: "Invisalign consultation completed; scan done, treatment plan pending.",
    thread: [
      { dir: "in", ago: 150, body: "I'd like to start Invisalign. Can I book a consultation?" },
      { dir: "out", ago: 149.5, body: `Hi Lena,\n\nExciting! The consultation is free and includes a digital smile scan. Pick a time below and we'll walk you through the plan and pricing.${SIGN}` },
    ],
    appt: [{ day: -4, hour: 14, via: "patient_link", status: "completed", notes: "Consult + iTero scan. Plan to follow." }],
  },

  // ── 10. Price shopper → lost ──
  {
    first: "Chloe", last: "Bennett", email: "chloe.bennett@outlook.com", source: "email", status: "lost",
    service: "Invisalign", intent: "price_inquiry",
    summary: "Wanted an emailed Invisalign quote to compare clinics; went elsewhere.",
    thread: [
      { dir: "in", ago: 240, subject: "Invisalign quote", body: "Can you send me a quote for Invisalign by email? I'm comparing a few clinics." },
      { dir: "out", ago: 239.5, body: `Hi Chloe,\n\nHappy to help! Invisalign pricing depends on your case, so the fairest way to quote is a free consultation with a digital scan — it takes 20 minutes and you'll leave with an exact number and payment options.${SIGN}` },
      { dir: "in", ago: 200, body: "Thanks, but I found a clinic that could quote me over email. All the best." },
    ],
  },

  // ── 11. Missed / no-show ──
  {
    first: "Noah", last: "Patel", email: "noah.patel@gmail.com", source: "website", status: "booked",
    service: "Kids Dentistry", intent: "kids",
    summary: "Booked a kids checkup; no-show on the day.",
    thread: [
      { dir: "in", ago: 110, body: "Need a checkup for my daughter (8)." },
      { dir: "out", ago: 109.9, body: `Hi Noah,\n\nYou're booked! Kids Dentistry on ${dayLabel(workday(-3, 10))} at 10:00 AM.\n\nSee you soon,\nSwish` },
    ],
    appt: [{ day: -3, hour: 10, via: "patient_link", status: "no_show" }],
  },

  // ── 12. Spam filtered ──
  {
    first: "SEO", last: "Growth Team", email: "growth@rankboost-media.co", source: "email", status: "spam",
    service: "Other", intent: "spam",
    summary: "Not a patient inquiry.",
    thread: [{ dir: "in", ago: 40, subject: "Rank #1 on Google for 'dentist Calgary'", body: "We help dental clinics get more patients with our proven SEO packages. Reply to claim your free audit! Unsubscribe here." }],
  },
];

type SeedAppt = { name: string; email: string; service: string; day: number; hour: number; minute?: number; mins?: number; status?: ApptStatus; via?: "dashboard" | "patient_link"; notes?: string };

/** extra appointments for patients who didn't come through a lead (walk-ins, recalls) */
const EXTRA_APPOINTMENTS: SeedAppt[] = [
  { name: "Hassan Malik", email: "hassan.malik@gmail.com", service: "The Essentials", day: -6, hour: 9, mins: 60, status: "completed", via: "dashboard" },
  { name: "Grace Kim", email: "grace.kim@hotmail.com", service: "The Essentials", day: -5, hour: 11, status: "completed", via: "dashboard" },
  { name: "Olivia Chen", email: "olivia.chen@gmail.com", service: "Dental Work", day: -2, hour: 13, mins: 90, status: "completed", via: "dashboard", notes: "Filling, lower right" },
  { name: "Jake Morrison (child)", email: "jake.morrison@shaw.ca", service: "Kids Dentistry", day: 0, hour: 10, via: "dashboard" },
  { name: "Ethan Brooks", email: "ethan.brooks@gmail.com", service: "The Essentials", day: 0, hour: 14, via: "dashboard" },
  { name: "Mia Fischer", email: "mia.fischer@outlook.com", service: "Invisalign", day: 0, hour: 16, via: "dashboard", notes: "Aligner check-in" },
  { name: "Liam Hughes", email: "liam.hughes@telus.net", service: "Dental Work", day: 1, hour: 9, mins: 90, via: "dashboard", notes: "Crown prep" },
  { name: "Zara Ahmed", email: "zara.ahmed@gmail.com", service: "The Essentials", day: 1, hour: 11, via: "dashboard" },
  { name: "Ben Carter (child)", email: "ben.carter@yahoo.ca", service: "Kids Dentistry", day: 2, hour: 10, via: "dashboard" },
  { name: "Isabella Rossi", email: "isabella.rossi@gmail.com", service: "Invisalign", day: 3, hour: 11, via: "patient_link" },
  { name: "Owen Murphy", email: "owen.murphy@icloud.com", service: "The Essentials", day: 4, hour: 15, via: "dashboard" },
  { name: "Ava Thompson", email: "ava.thompson@gmail.com", service: "Dental Work", day: 6, hour: 9, mins: 60, via: "patient_link" },
];

export function loadSampleData() {
  for (const L of LEADS) {
    const first = L.thread[0];
    const created = hoursAgo(first.ago);
    const firstOut = L.thread.find((m) => m.dir === "out");
    const lead = db.insertLead({
      first_name: L.first, last_name: L.last, email: L.email, phone: L.phone ?? null,
      source: L.source, status: L.status, service: L.service, intent: L.intent, priority: L.priority ?? "normal",
      message: first.body, ai_summary: L.summary,
      ai_reply: null, ai_safe_auto: L.intent === "insurance",
      ai_processed_at: created,
      first_reply_at: firstOut ? hoursAgo(firstOut.ago) : null,
      created_at: created,
    });
    const link = `${base()}/book/${lead.booking_token}`;

    for (const m of L.thread) {
      db.insertMessage({
        lead_id: lead.id,
        direction: m.dir === "in" ? "inbound" : "outbound",
        channel: m.dir === "in" ? (L.source === "email" ? "email" : "website") : "email",
        subject: m.subject ?? (m.dir === "out" && first.subject ? `Re: ${first.subject}` : null),
        body: m.body.replace("{{LINK}}", link),
        sent_by: m.dir === "out" ? (m.auto ? "ai" : "staff") : null,
        sent_at: hoursAgo(m.ago),
      });
    }
    if (L.status === "new" && L.draft) {
      db.updateLead(lead.id, { ai_reply: `${L.draft}\n\nPick a time that suits you here (takes 10 seconds): ${link}` });
    }
    for (const A of L.appt ?? []) {
      const start = A.day === 0 ? at(0, A.hour, A.minute) : workday(A.day, A.hour, A.minute);
      const end = new Date(start.getTime() + (A.mins ?? 45) * 60_000);
      db.upsertAppointment({
        lead_id: lead.id, patient_name: `${L.first} ${L.last}`, patient_email: L.email, service: L.service,
        title: `${L.service} — ${L.first} ${L.last}`, starts_at: start.toISOString(), ends_at: end.toISOString(),
        status: A.status ?? "scheduled", booked_via: A.via, notes: A.notes ?? null,
      });
    }
  }

  for (const A of EXTRA_APPOINTMENTS) {
    const start = A.day === 0 ? at(0, A.hour, A.minute) : workday(A.day, A.hour, A.minute);
    const end = new Date(start.getTime() + (A.mins ?? 45) * 60_000);
    db.upsertAppointment({
      lead_id: null, patient_name: A.name, patient_email: A.email, service: A.service, title: `${A.service} — ${A.name}`,
      starts_at: start.toISOString(), ends_at: end.toISOString(), status: A.status ?? "scheduled", booked_via: A.via ?? "dashboard", notes: A.notes ?? null,
    });
  }
}

/** Seed once when the database has no leads and no appointments. */
export function seedIfEmpty() {
  if (db.listLeadsDb({ status: "all", limit: 1 }).length > 0) return false;
  if (db.listAppointments(new Date(0), new Date(8.64e15)).length > 0) return false;
  loadSampleData();
  return true;
}

// keep referenced-but-unused helpers from tripping the linter
void timeLabel; void DANIEL_APPT;
