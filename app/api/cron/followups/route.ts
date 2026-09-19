import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/auth";
import { runDueFollowups } from "@/lib/leads";
import { withDb } from "@/lib/with-db";

export const runtime = "nodejs";

/** GET — send instant replies for website leads whose self-booking wait has expired. Cron: every minute. */
async function _GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runDueFollowups();
  return NextResponse.json({ ok: true, processed: Object.keys(results).length, results });
}

export const GET = withDb(_GET);
