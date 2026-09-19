import { listAppointments } from "./db";
import { freeSlots as googleFreeSlots, isGoogleConnected } from "./google";

export interface Slot {
  iso: string;
  label: string;
  day: string;
  time: string;
}

export function labelSlot(iso: string): Slot {
  const d = new Date(iso);
  return {
    iso,
    label: d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    day: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

/**
 * Free slots for the next `days` days. Uses Google Calendar when connected,
 * otherwise the local appointments table. Mon–Sat, 9am–5pm.
 */
export async function getFreeSlots(days = 7, slotMinutes = 45): Promise<Slot[]> {
  if (await isGoogleConnected()) {
    try {
      return (await googleFreeSlots(days, slotMinutes)).map((s) => labelSlot(s.iso));
    } catch (e) {
      console.error("[slots] google failed, falling back to local", e);
    }
  }
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400_000);
  const busy = listAppointments(now, end)
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({ s: new Date(a.starts_at).getTime(), e: new Date(a.ends_at).getTime() }));

  const slots: Slot[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);
  while (cursor < end && slots.length < 60) {
    const dow = cursor.getDay();
    const h = cursor.getHours();
    if (dow >= 1 && dow <= 6 && h >= 9 && h + slotMinutes / 60 <= 17) {
      const s = cursor.getTime();
      const e = s + slotMinutes * 60_000;
      if (!busy.some((b) => s < b.e && e > b.s)) slots.push(labelSlot(cursor.toISOString()));
    }
    cursor.setTime(cursor.getTime() + slotMinutes * 60_000);
  }
  return slots;
}
