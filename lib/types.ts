export type LeadSource = "website" | "email" | "calendar" | "manual";
export type LeadStatus = "new" | "contacted" | "booked" | "lost" | "spam";
export type LeadIntent =
  | "new_patient"
  | "emergency"
  | "cleaning"
  | "price_inquiry"
  | "insurance"
  | "reschedule"
  | "cancel"
  | "kids"
  | "invisalign"
  | "dental_work"
  | "general"
  | "spam";
export type LeadPriority = "urgent" | "normal" | "low";
export type ApptStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  message: string | null;
  service: string | null;
  intent: LeadIntent | null;
  priority: LeadPriority | null;
  ai_summary: string | null;
  ai_reply: string | null;
  ai_processed_at: string | null;
  gmail_thread_id: string | null;
  first_reply_at: string | null;
  /** secret token for the patient's self-serve booking link (/book/<token>) */
  booking_token: string | null;
  /** model said this draft is safe to send without approval */
  ai_safe_auto: boolean | null;
  /** website leads: AI waits until this time for the patient to self-book before acting */
  followup_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  direction: "inbound" | "outbound";
  channel: string;
  subject: string | null;
  body: string;
  gmail_message_id: string | null;
  /** outbound only: who sent it */
  sent_by?: "ai" | "staff" | null;
  sent_at: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  lead_id: string | null;
  calendar_event_id: string | null;
  title: string | null;
  patient_name: string | null;
  patient_email: string | null;
  service: string | null;
  starts_at: string;
  ends_at: string;
  status: ApptStatus;
  notes: string | null;
  /** Google Calendar event page (when connected) */
  calendar_link: string | null;
  /** how the booking was made */
  booked_via: "dashboard" | "patient_link" | "calendar" | "ai" | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicSettings {
  id: number;
  clinic_name: string;
  clinic_email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
  services: string | null;
  pricing_notes: string | null;
  insurance: string | null;
  tone: string | null;
  booking_link: string | null;
  auto_reply: boolean;
  /** emergencies get an instant reply with the self-booking link, no approval needed */
  emergency_auto_reply: boolean;
  /** when a patient confirms one of the offered times by email, AI books it and sends the confirmation */
  auto_book: boolean;
  /** appointment slot length in minutes */
  slot_minutes: number;
  /** how long to give a website visitor to self-book before the AI replies (minutes) */
  followup_minutes: number;
  /** Google OAuth app credentials (alternative to env vars) */
  google_client_id: string | null;
  google_client_secret: string | null;
  daily_summary_email: string | null;
  updated_at: string;
}

export interface GoogleTokens {
  id: number;
  access_token: string | null;
  refresh_token: string | null;
  expiry_date: number | null;
  scope: string | null;
  email: string | null;
  gmail_history_id: string | null;
  last_gmail_sync: string | null;
  last_calendar_sync: string | null;
}

export function leadName(l: Pick<Lead, "first_name" | "last_name" | "email">) {
  const n = [l.first_name, l.last_name].filter(Boolean).join(" ").trim();
  return n || l.email || "Unknown";
}
