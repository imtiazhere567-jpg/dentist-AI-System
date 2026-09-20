import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthed } from "@/lib/auth";
import { clearData } from "@/lib/db";
import { loadSampleData } from "@/lib/seed";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

/** POST { action: "reset" | "clear" } — reload the sample data, or wipe everything. */
async function _POST(req: NextRequest) {
  if (!isDashboardAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = await req.json().catch(() => ({ action: "" }));
  if (action === "clear") { clearData(); return NextResponse.json({ ok: true, action }); }
  if (action === "reset") { clearData(); loadSampleData(); return NextResponse.json({ ok: true, action }); }
  return NextResponse.json({ error: "action must be reset or clear" }, { status: 400 });
}

export const POST = withDb(_POST);
