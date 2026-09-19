import { google, gmail_v1, calendar_v3 } from "googleapis";
import { readTokens, writeTokens } from "./db";
import { getSettingsSync } from "./settings";
import { appUrl } from "./url";
import type { GoogleTokens } from "./types";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

/** OAuth app credentials: env vars first, otherwise what the clinic pasted into Settings. */
export function googleCreds() {
  const s = getSettingsSync();
  const id = process.env.GOOGLE_CLIENT_ID || s.google_client_id || "";
  const secret = process.env.GOOGLE_CLIENT_SECRET || s.google_client_secret || "";
  return { id: id.trim(), secret: secret.trim(), fromEnv: Boolean(process.env.GOOGLE_CLIENT_ID) };
}

export function hasGoogleEnv() {
  const c = googleCreds();
  return Boolean(c.id && c.secret);
}

export function redirectUri() {
  return `${appUrl()}/api/auth/google/callback`;
}

export function oauthClient() {
  const c = googleCreds();
  return new google.auth.OAuth2(c.id, c.secret, redirectUri());
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  return readTokens();
}

export async function saveTokens(patch: Partial<GoogleTokens>) {
  writeTokens(patch);
}

/** True when Gmail/Calendar are actually usable. */
export async function isGoogleConnected() {
  return Boolean(hasGoogleEnv() && readTokens()?.refresh_token);
}

/** Authorized OAuth2 client (auto-refreshes and persists new access tokens). Returns null if Google isn't connected. */
export async function authedClient() {
  if (!hasGoogleEnv()) return null;
  const t = await loadTokens();
  if (!t?.refresh_token) return null;
  const c = oauthClient();
  c.setCredentials({
    access_token: t.access_token ?? undefined,
    refresh_token: t.refresh_token,
    expiry_date: t.expiry_date ?? undefined,
    scope: t.scope ?? undefined,
  });
  c.on("tokens", (tok) => {
    void saveTokens({
      access_token: tok.access_token ?? undefined,
      expiry_date: tok.expiry_date ?? undefined,
      ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
    });
  });
  return c;
}

// ---------------- Gmail ----------------

export interface InboundEmail {
  id: string;
  threadId: string;
  from: string; // "Name <addr>"
  fromEmail: string;
  fromName: string;
  subject: string;
  body: string;
  date: Date;
}

function header(msg: gmail_v1.Schema$Message, name: string) {
  return msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeB64(data?: string | null) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(part?: gmail_v1.Schema$MessagePart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeB64(part.body.data);
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeB64(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export function parseAddress(raw: string) {
  const m = raw.match(/^(.*?)<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

/** Fetch inbox messages received after `since` (skips sent mail, promos, social). */
export async function fetchInboundEmails(since: Date, max = 30): Promise<InboundEmail[]> {
  const auth = await authedClient();
  if (!auth) return [];
  const gmail = google.gmail({ version: "v1", auth });
  const after = Math.floor(since.getTime() / 1000);
  const q = `in:inbox -category:promotions -category:social -from:me after:${after}`;
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: max });
  const ids = list.data.messages ?? [];
  const out: InboundEmail[] = [];
  for (const { id } of ids) {
    if (!id) continue;
    const full = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const msg = full.data;
    const from = header(msg, "From");
    const { name, email } = parseAddress(from);
    out.push({
      id: msg.id!,
      threadId: msg.threadId!,
      from,
      fromEmail: email,
      fromName: name,
      subject: header(msg, "Subject"),
      body: extractBody(msg.payload).trim(),
      date: new Date(Number(msg.internalDate ?? Date.now())),
    });
  }
  return out;
}

function encodeMime(raw: string) {
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Send a plain-text email. If threadId + inReplyTo are given, it lands in the same Gmail thread. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyToMessageId?: string | null;
}) {
  const auth = await authedClient();
  if (!auth) throw new Error("Google not connected");
  const gmail = google.gmail({ version: "v1", auth });

  let references = "";
  if (opts.inReplyToMessageId) {
    // Fetch RFC Message-ID header of the message we're replying to for proper threading
    const orig = await gmail.users.messages.get({
      userId: "me",
      id: opts.inReplyToMessageId,
      format: "metadata",
      metadataHeaders: ["Message-ID"],
    });
    const mid = header(orig.data, "Message-ID");
    if (mid) references = `In-Reply-To: ${mid}\r\nReferences: ${mid}\r\n`;
  }

  const subject = opts.threadId && !/^re:/i.test(opts.subject) ? `Re: ${opts.subject}` : opts.subject;
  const raw =
    `To: ${opts.to}\r\n` +
    `Subject: ${subject}\r\n` +
    references +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `MIME-Version: 1.0\r\n\r\n` +
    opts.body;

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodeMime(raw), threadId: opts.threadId ?? undefined },
  });
  return res.data;
}

// ---------------- Calendar ----------------

function calendarId() {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

export async function listEvents(timeMin: Date, timeMax: Date): Promise<calendar_v3.Schema$Event[]> {
  const auth = await authedClient();
  if (!auth) return [];
  const cal = google.calendar({ version: "v3", auth });
  const res = await cal.events.list({
    calendarId: calendarId(),
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 500,
  });
  return res.data.items ?? [];
}

export async function createEvent(opts: {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string | null;
}) {
  const auth = await authedClient();
  if (!auth) throw new Error("Google not connected");
  const cal = google.calendar({ version: "v3", auth });
  const res = await cal.events.insert({
    calendarId: calendarId(),
    sendUpdates: opts.attendeeEmail ? "all" : "none",
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.start.toISOString() },
      end: { dateTime: opts.end.toISOString() },
      attendees: opts.attendeeEmail ? [{ email: opts.attendeeEmail }] : undefined,
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 24 * 60 }] },
    },
  });
  return res.data;
}

/**
 * Compute free slots for the next `days` days inside clinic hours (default 9–17, Mon–Fri, 45-min slots).
 * Returns human-readable strings for the AI plus ISO starts for the UI.
 */
export async function freeSlots(days = 5, slotMinutes = 45, openHour = 9, closeHour = 17) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400_000);
  const events = await listEvents(now, end);
  const busy = events
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({ s: new Date(e.start!.dateTime!).getTime(), e: new Date(e.end!.dateTime!).getTime() }));

  const slots: { iso: string; label: string }[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);
  while (cursor < end && slots.length < 40) {
    const dow = cursor.getDay();
    const h = cursor.getHours();
    if (dow >= 1 && dow <= 5 && h >= openHour && h + slotMinutes / 60 <= closeHour) {
      const s = cursor.getTime();
      const e = s + slotMinutes * 60_000;
      const clash = busy.some((b) => s < b.e && e > b.s);
      if (!clash) {
        slots.push({
          iso: cursor.toISOString(),
          label: cursor.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        });
      }
    }
    cursor.setTime(cursor.getTime() + slotMinutes * 60_000);
  }
  return slots;
}
