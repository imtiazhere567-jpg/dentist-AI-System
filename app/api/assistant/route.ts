import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthed } from "@/lib/auth";
import { answer } from "@/lib/assistant";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).optional().default([]),
});

async function _POST(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Message required" }, { status: 400 });
  const res = await answer(parsed.data.message, parsed.data.history);
  return NextResponse.json(res);
}

export const POST = withDb(_POST);
