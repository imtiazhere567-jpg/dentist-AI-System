/**
 * Document-style database with two backends, same API everywhere:
 *  - local:  ./data/db.json  (no services needed — default)
 *  - live:   Postgres (Supabase / Neon / any) when DATABASE_URL is set — the whole document is
 *            stored in one row and hydrated at the start of every request (see ensureDb / flushDb).
 * Reads are synchronous from memory; writes update memory immediately and persist behind the scenes.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import postgres from "postgres";
import type { Lead, Message, Appointment, ClinicSettings, GoogleTokens } from "./types";

interface DB {
  leads: Lead[];
  messages: Message[];
  appointments: Appointment[];
  settings: ClinicSettings | null;
  google_tokens: GoogleTokens | null;
}

const FILE = path.join(process.cwd(), "data", "db.json");
const EMPTY: DB = { leads: [], messages: [], appointments: [], settings: null, google_tokens: null };
const REMOTE = process.env.DATABASE_URL || "";
const DOC_KEY = "swish";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * All remote queries go through one lock: exactly one query in flight per instance.
 * Concurrent/pipelined queries on a single connection through Supabase's transaction pooler
 * were observed to never return (function hung until the 300s limit).
 */
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
  const run = lock.then(() => withTimeout(fn(), ms, label));
  lock = run.catch(() => {});
  return run;
}

declare global {
  // eslint-disable-next-line no-var
  var __localdb: DB | undefined;
  // eslint-disable-next-line no-var
  var __dbLoadedAt: number | undefined;
  // eslint-disable-next-line no-var
  var __dbPending: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __dbReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __dbWarned: boolean | undefined;
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __dbDirty: boolean | undefined;
  // eslint-disable-next-line no-var
  var __dbLastSaveError: string | null | undefined;
  // eslint-disable-next-line no-var
  var __dbLoading: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __lastLayoutError: string | null | undefined;
  // eslint-disable-next-line no-var
  var __layoutTimings: Record<string, number> | undefined;
}

/** Record how long a layout step took / whether it failed (surfaced by /api/health). */
export async function traced<T>(label: string, p: Promise<T>, ms: number, fallback: T): Promise<T> {
  const t0 = Date.now();
  try {
    const v = await withTimeout(p, ms, label);
    (global.__layoutTimings ??= {})[label] = Date.now() - t0;
    return v;
  } catch (e) {
    (global.__layoutTimings ??= {})[label] = Date.now() - t0;
    global.__lastLayoutError = `${label}: ${(e as Error).message}`;
    console.error("[layout]", global.__lastLayoutError);
    return fallback;
  }
}

/** One client per instance. `prepare:false` + `fetch_types:false` are required for Supabase's transaction pooler. */
function sql() {
  return (global.__pgClient ??= postgres(REMOTE, {
    prepare: false,
    fetch_types: false,
    max: 1,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}, // "relation already exists" notices are expected
  }));
}

/** Connectivity + counts, for /api/health. */
export async function dbHealth() {
  const doc = global.__localdb;
  const base = {
    mode: REMOTE ? "postgres" : "file",
    host: REMOTE ? REMOTE.replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0] : null,
    leads: doc?.leads.length ?? 0,
    appointments: doc?.appointments.length ?? 0,
    lastSaveError: global.__dbLastSaveError ?? null,
    lastLayoutError: global.__lastLayoutError ?? null,
    layoutTimings: global.__layoutTimings ?? null,
  };
  if (!REMOTE) return { ...base, ok: true };
  const t0 = Date.now();
  try {
    await ensureTable();
    const rows = await withLock(
      () => sql()`select jsonb_typeof(value) as type, jsonb_array_length(case when jsonb_typeof(value) = 'object' then value->'leads' else '[]'::jsonb end) as leads, jsonb_array_length(case when jsonb_typeof(value) = 'object' then value->'appointments' else '[]'::jsonb end) as appointments, updated_at from app_documents where key = ${DOC_KEY}`,
      10_000,
      "health query",
    );
    return { ...base, ok: true, ms: Date.now() - t0, stored: rows[0] ?? null };
  } catch (e) {
    return { ...base, ok: false, ms: Date.now() - t0, error: (e as Error).message };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __dbReadyP: Promise<void> | undefined;
}
/** Create the table once per instance (concurrent callers share the same promise). */
function ensureTable() {
  if (global.__dbReady) return Promise.resolve();
  return (global.__dbReadyP ??= withLock(
    () => sql()`create table if not exists app_documents (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`,
    10_000,
    "create table",
  ).then(() => { global.__dbReady = true; }).finally(() => { global.__dbReadyP = undefined; }));
}

/**
 * Hydrate memory from the remote store. Call at the top of every request handler / page.
 * No-op on the local file backend. Skips the round-trip if we loaded within the last 1.5s
 * (layout + page render in the same request).
 */
export async function ensureDb() {
  if (!REMOTE) return;
  if (global.__localdb && global.__dbLoadedAt && Date.now() - global.__dbLoadedAt < 1500) return;
  // one in-flight hydration per instance (layout + page + API can all call this at once)
  if (global.__dbLoading) return global.__dbLoading;
  global.__dbLoading = (async () => {
    try {
      await withTimeout(hydrate(), 12_000, "db load");
    } finally {
      global.__dbLoading = undefined;
    }
  })();
  return global.__dbLoading;
}

async function hydrate() {
  await ensureTable();
  const rows = await withLock(() => sql()`select value from app_documents where key = ${DOC_KEY}`, 10_000, "load document");
  let raw: unknown = rows[0]?.value;
  // tolerate a row that was stored as a JSON string
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  const doc = (raw && typeof raw === "object" ? raw : {}) as Partial<DB>;
  global.__localdb = { ...EMPTY, ...doc };
  global.__dbLoadedAt = Date.now();
}

/** Wait for queued remote writes (bounded — a stuck write never blocks a page). */
export async function flushDb() {
  if (!global.__dbPending) return;
  try {
    await withTimeout(global.__dbPending, 20_000, "db flush");
  } catch (e) {
    global.__dbLastSaveError = (e as Error).message;
    console.error("[db]", (e as Error).message);
  }
}

export function hasPendingWrites() {
  return Boolean(global.__dbPending);
}

/** Force a write now and report what happened (used by /api/health?write=1). */
export async function dbWriteTest() {
  const t0 = Date.now();
  save();
  await flushDb();
  return { ms: Date.now() - t0, error: global.__dbLastSaveError ?? null };
}

export function isRemoteDb() {
  return Boolean(REMOTE);
}

function load(): DB {
  if (global.__localdb) return global.__localdb;
  if (REMOTE) {
    // ensureDb() wasn't awaited first — start empty rather than crash; the next request hydrates.
    global.__localdb = structuredClone(EMPTY);
    return global.__localdb;
  }
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    global.__localdb = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    global.__localdb = structuredClone(EMPTY);
  }
  return global.__localdb!;
}

/** Persist the current in-memory document. Remote writes are coalesced: many saves in a row = one write. */
function save() {
  const doc = load();
  if (REMOTE) {
    global.__dbDirty = true;
    if (!global.__dbPending) {
      global.__dbPending = (async () => {
        try {
          while (global.__dbDirty) {
            global.__dbDirty = false;
            const snapshot = JSON.stringify(load()); // detached plain copy
            await ensureTable();
            // bind as TEXT first (so the driver never JSON-encodes the string), then cast to jsonb
            await withLock(
              () => sql()`insert into app_documents (key, value, updated_at) values (${DOC_KEY}, (${snapshot}::text)::jsonb, now())
                          on conflict (key) do update set value = excluded.value, updated_at = now()`,
              15_000,
              "db write",
            );
            global.__dbLastSaveError = null;
          }
        } catch (e) {
          global.__dbLastSaveError = (e as Error).message;
          console.error("[db] remote save failed", e);
        } finally {
          global.__dbPending = undefined;
        }
      })();
    }
    return;
  }
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(doc, null, 2));
  } catch (e) {
    // read-only filesystem (e.g. serverless without DATABASE_URL) — keep going in memory
    if (!global.__dbWarned) { global.__dbWarned = true; console.warn("[db] cannot write data/db.json — set DATABASE_URL for persistence", (e as Error).message); }
  }
}

const now = () => new Date().toISOString();

// ---------------- leads ----------------

export function insertLead(l: Partial<Lead>): Lead {
  const db = load();
  const lead: Lead = {
    id: randomUUID(),
    first_name: null, last_name: null, email: null, phone: null,
    source: "website", status: "new", message: null, service: null,
    intent: null, priority: "normal", ai_summary: null, ai_reply: null, ai_processed_at: null,
    gmail_thread_id: null, first_reply_at: null,
    booking_token: randomUUID().replace(/-/g, ""),
    ai_safe_auto: null, followup_due_at: null,
    created_at: now(), updated_at: now(),
    ...l,
  };
  db.leads.push(lead);
  save();
  return lead;
}

export function leadsWithDueFollowup() {
  const t = now();
  return load().leads.filter((l) => l.followup_due_at && l.followup_due_at <= t);
}

export function findLeadByToken(token: string) {
  return load().leads.find((l) => l.booking_token === token) ?? null;
}

export function updateLead(id: string, patch: Partial<Lead>): Lead | null {
  const db = load();
  const l = db.leads.find((x) => x.id === id);
  if (!l) return null;
  Object.assign(l, patch, { updated_at: now() });
  save();
  return l;
}

export function getLeadById(id: string) {
  return load().leads.find((l) => l.id === id) ?? null;
}

export function findLeadByThread(threadId: string) {
  return load().leads.find((l) => l.gmail_thread_id === threadId) ?? null;
}

export function findLatestLeadByEmail(email: string) {
  return [...load().leads]
    .filter((l) => l.email?.toLowerCase() === email.toLowerCase())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function listLeadsDb(opts: { status?: string; limit?: number } = {}) {
  let rows = [...load().leads].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (opts.status && opts.status !== "all") rows = rows.filter((l) => l.status === opts.status);
  return rows.slice(0, opts.limit ?? 200);
}

// ---------------- messages ----------------

export function insertMessage(m: Partial<Message> & { lead_id: string; direction: Message["direction"]; body: string }): Message {
  const db = load();
  if (m.gmail_message_id && db.messages.some((x) => x.gmail_message_id === m.gmail_message_id)) {
    return db.messages.find((x) => x.gmail_message_id === m.gmail_message_id)!;
  }
  const msg: Message = {
    id: randomUUID(),
    channel: "email",
    subject: null,
    gmail_message_id: null,
    sent_at: now(),
    created_at: now(),
    ...m,
  };
  db.messages.push(msg);
  save();
  return msg;
}

export function messagesForLead(leadId: string) {
  return load().messages.filter((m) => m.lead_id === leadId).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
}

export function hasGmailMessage(gmailId: string) {
  return load().messages.some((m) => m.gmail_message_id === gmailId);
}

// ---------------- appointments ----------------

export function upsertAppointment(a: Partial<Appointment> & { starts_at: string; ends_at: string }): Appointment {
  const db = load();
  let row = a.calendar_event_id ? db.appointments.find((x) => x.calendar_event_id === a.calendar_event_id) : undefined;
  if (row) {
    Object.assign(row, a, { updated_at: now() });
  } else {
    row = {
      id: randomUUID(),
      lead_id: null, calendar_event_id: null, title: null, patient_name: null, patient_email: null,
      service: null, status: "scheduled", notes: null, calendar_link: null, booked_via: null,
      created_at: now(), updated_at: now(),
      ...a,
    };
    db.appointments.push(row);
  }
  save();
  return row;
}

export function getAppointment(id: string) {
  return load().appointments.find((a) => a.id === id) ?? null;
}

export function updateAppointment(id: string, patch: Partial<Appointment>) {
  const db = load();
  const a = db.appointments.find((x) => x.id === id);
  if (!a) return null;
  Object.assign(a, patch, { updated_at: now() });
  save();
  return a;
}

export function searchAppointmentsByName(q: string) {
  const s = q.toLowerCase();
  return load()
    .appointments.filter((a) => (a.patient_name ?? "").toLowerCase().includes(s) || (a.title ?? "").toLowerCase().includes(s))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function listAppointments(from: Date, to: Date) {
  return load()
    .appointments.filter((a) => a.starts_at >= from.toISOString() && a.starts_at < to.toISOString())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function appointmentsForLead(leadId: string) {
  return load().appointments.filter((a) => a.lead_id === leadId).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function markMissingAppointmentsCancelled(from: Date, to: Date, keepEventIds: Set<string>) {
  const db = load();
  for (const a of db.appointments) {
    if (a.calendar_event_id && a.starts_at >= from.toISOString() && a.starts_at <= to.toISOString() && !keepEventIds.has(a.calendar_event_id)) {
      a.status = "cancelled";
    }
  }
  save();
}

// ---------------- settings / tokens ----------------

export function readSettings() {
  return load().settings;
}
export function writeSettings(patch: Partial<ClinicSettings>, defaults: ClinicSettings) {
  const db = load();
  db.settings = { ...defaults, ...(db.settings ?? {}), ...patch, updated_at: now() };
  save();
  return db.settings;
}

/** Wipe leads, messages and appointments (keeps settings and Google tokens). */
export function clearData() {
  const db = load();
  db.leads = [];
  db.messages = [];
  db.appointments = [];
  save();
}

export function readTokens() {
  return load().google_tokens;
}
export function writeTokens(patch: Partial<GoogleTokens>) {
  const db = load();
  db.google_tokens = {
    id: 1, access_token: null, refresh_token: null, expiry_date: null, scope: null, email: null,
    gmail_history_id: null, last_gmail_sync: null, last_calendar_sync: null,
    ...(db.google_tokens ?? {}),
    ...patch,
  };
  save();
  return db.google_tokens;
}
