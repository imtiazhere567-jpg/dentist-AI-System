import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthed } from "@/lib/auth";
import { updateAppointment } from "@/lib/db";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

const Schema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().max(2000).optional(),
});

async function _PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const a = updateAppointment(id, parsed.data);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, appointment: a });
}

export const PATCH = withDb(_PATCH);
