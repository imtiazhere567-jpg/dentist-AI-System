import { NextResponse } from "next/server";
import { dbHealth, ensureDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — database mode, connectivity and stored counts. */
export async function GET() {
  try {
    await ensureDb();
  } catch (e) {
    return NextResponse.json({ ok: false, stage: "ensureDb", error: (e as Error).message }, { status: 500 });
  }
  const h = await dbHealth();
  return NextResponse.json(h, { status: h.ok ? 200 : 500 });
}
