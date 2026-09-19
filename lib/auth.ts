import { NextRequest } from "next/server";

export const DASH_COOKIE = "dash_session";

/** Value stored in the dashboard cookie — a simple hash of the password so the raw password never sits in the cookie. */
export function sessionToken() {
  const pw = process.env.DASHBOARD_PASSWORD ?? "";
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) >>> 0;
  return `s_${h.toString(16)}_${pw.length}`;
}

export function isDashboardAuthed(req: NextRequest) {
  if (!process.env.DASHBOARD_PASSWORD) return true; // no password configured => open (dev)
  return req.cookies.get(DASH_COOKIE)?.value === sessionToken();
}

/** Cron/sync endpoints accept either the dashboard cookie or `Authorization: Bearer CRON_SECRET`. */
export function isCronAuthed(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  return isDashboardAuthed(req);
}
