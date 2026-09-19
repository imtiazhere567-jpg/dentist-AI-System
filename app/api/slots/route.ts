import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthed } from "@/lib/auth";
import { isGoogleConnected } from "@/lib/google";
import { getFreeSlots } from "@/lib/slots";
import { getSettings } from "@/lib/settings";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

/** GET — free slots for the next few days (dashboard booking picker). */
async function _GET(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
  const settings = await getSettings();
  const slots = await getFreeSlots(days, settings.slot_minutes);
  return NextResponse.json({ slots, connected: await isGoogleConnected() });
}

export const GET = withDb(_GET);
