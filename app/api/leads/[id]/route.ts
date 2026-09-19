import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateLead } from "@/lib/db";
import { isDashboardAuthed } from "@/lib/auth";
import { getLead } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

const PatchSchema = z.object({
  status: z.enum(["new", "contacted", "booked", "lost", "spam"]).optional(),
  priority: z.enum(["urgent", "normal", "low"]).optional(),
  ai_reply: z.string().optional(),
  phone: z.string().optional(),
  service: z.string().optional(),
});

async function _GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getLead(id);
  if (!data.lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

async function _PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const updated = updateLead(id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const GET = withDb(_GET);
export const PATCH = withDb(_PATCH);
