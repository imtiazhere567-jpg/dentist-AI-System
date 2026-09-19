import { NextRequest, NextResponse } from "next/server";
import { dbHealth, dbWriteTest, ensureDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — database mode, connectivity and stored counts. Add ?write=1 to test a write. */
export async function GET(req: NextRequest) {
  try {
    await ensureDb();
  } catch (e) {
    return NextResponse.json({ ok: false, stage: "ensureDb", error: (e as Error).message }, { status: 500 });
  }
  const write = req.nextUrl.searchParams.get("write") ? await dbWriteTest() : undefined;
  const h = await dbHealth();
  return NextResponse.json({ ...h, write }, { status: h.ok ? 200 : 500 });
}
