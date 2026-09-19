import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthed } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings";
import type { ClinicSettings } from "@/lib/types";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

const Schema = z.object({
  clinic_name: z.string().min(1).optional(),
  clinic_email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  services: z.string().optional(),
  pricing_notes: z.string().optional(),
  insurance: z.string().optional(),
  tone: z.string().optional(),
  booking_link: z.string().optional(),
  auto_reply: z.boolean().optional(),
  emergency_auto_reply: z.boolean().optional(),
  auto_book: z.boolean().optional(),
  slot_minutes: z.number().int().min(15).max(180).optional(),
  followup_minutes: z.number().int().min(1).max(120).optional(),
  google_client_id: z.string().optional(),
  google_client_secret: z.string().optional(),
  daily_summary_email: z.string().email().or(z.literal("")).optional(),
});

async function _GET(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await getSettings();
  return NextResponse.json({ ...s, google_client_secret: s.google_client_secret ? "••••••••" : null });
}

async function _PUT(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const patch = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v])) as Partial<ClinicSettings>;
  // masked secret echoed back from the form → keep the stored one
  if (patch.google_client_secret === "••••••••") delete patch.google_client_secret;
  await saveSettings(patch);
  return NextResponse.json({ ok: true });
}

export const GET = withDb(_GET);
export const PUT = withDb(_PUT);
