import { readSettings, writeSettings } from "./db";
import { clinic } from "./site-content";
import type { ClinicSettings } from "./types";

/** Defaults come straight from the website content so both describe the same business. */
export const DEFAULT_SETTINGS: ClinicSettings = {
  id: 1,
  clinic_name: clinic.name,
  clinic_email: null,
  phone: clinic.phone,
  address: clinic.address,
  hours: clinic.hours,
  services: clinic.services,
  pricing_notes: clinic.pricing_notes,
  insurance: clinic.insurance,
  tone: clinic.tone,
  booking_link: null,
  auto_reply: false,
  emergency_auto_reply: true,
  auto_book: true,
  slot_minutes: 45,
  followup_minutes: 10,
  google_client_id: null,
  google_client_secret: null,
  daily_summary_email: null,
  updated_at: new Date().toISOString(),
};

export async function getSettings(): Promise<ClinicSettings> {
  return { ...DEFAULT_SETTINGS, ...(readSettings() ?? {}) };
}

/** Synchronous variant for places that can't await (Google client setup). */
export function getSettingsSync(): ClinicSettings {
  return { ...DEFAULT_SETTINGS, ...(readSettings() ?? {}) };
}

export async function saveSettings(patch: Partial<ClinicSettings>) {
  writeSettings(patch, DEFAULT_SETTINGS);
}
