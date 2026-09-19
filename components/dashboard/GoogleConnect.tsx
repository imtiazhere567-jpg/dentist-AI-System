"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui";

type Props = {
  clientId: string;
  hasSecret: boolean;
  fromEnv: boolean;
  connected: boolean;
  email: string | null;
  lastSync: string | null;
  redirectUri: string;
  clinicName: string;
  status?: string;
};

export function GoogleConnect(p: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(p.clientId);
  const [secret, setSecret] = useState(p.hasSecret ? "••••••••" : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const hasCreds = p.fromEnv || (clientId.trim() && secret.trim());
  const savedCreds = p.fromEnv || (p.clientId && p.hasSecret);

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ google_client_id: clientId.trim(), google_client_secret: secret.trim() }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      setMsg("Saved ✔ Now click Connect Google.");
      router.refresh();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Card title="Connect Google (Gmail + Calendar)">
      <ul className="mb-4 space-y-3 text-sm">
        <Step ok={Boolean(savedCreds)} n={1} label="Credentials" hint={p.fromEnv ? "Configured on the server" : savedCreds ? "Saved" : "Paste the Client ID and secret below, then save"} />
        <Step ok={p.connected} n={2} label="Sign in" hint={p.connected ? `Connected as ${p.email ?? "Google account"}${p.lastSync ? ` · last sync ${new Date(p.lastSync).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}` : "Click Connect Google and approve access"} />
      </ul>

      {!p.fromEnv && (
        <div className="mb-4 space-y-3 rounded-2xl bg-[#F6F3FF] p-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Client ID</label>
            <input className="dash-input font-mono text-xs" placeholder="xxxx.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Client secret</label>
            <input type="password" className="dash-input font-mono text-xs" placeholder="GOCSPX-…" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy || !clientId.trim() || !secret.trim()} className="rounded-full bg-purple-soft px-4 py-2 text-xs font-semibold text-purple-ink hover:bg-purple/30 disabled:opacity-50">
              {busy ? "Saving…" : "Save credentials"}
            </button>
            {msg && <span className="text-xs text-muted">{msg}</span>}
          </div>
        </div>
      )}

      {p.status === "connected" && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Google connected ✔ Emails now send from your Gmail and bookings sync to Calendar.</p>}
      {p.status === "error" && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">Google connection failed — check the credentials and the redirect URI, then try again.</p>}

      <a
        href={savedCreds ? "/api/auth/google" : undefined}
        aria-disabled={!savedCreds}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition ${savedCreds ? "bg-purple text-white shadow-purple/30 hover:bg-purple-deep" : "cursor-not-allowed bg-gray-200 text-gray-500 shadow-none"}`}
      >
        <GoogleG /> {p.connected ? "Reconnect Google" : "Connect Google"}
      </a>
      {!savedCreds && hasCreds && <p className="mt-2 text-[11px] text-muted">Save the credentials first.</p>}

      <details className="mt-5 rounded-2xl bg-[#F6F3FF] p-4 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-purple-ink">How to get the Client ID &amp; secret (5 min)</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-4">
          <li>Go to <b>console.cloud.google.com</b> → create a project (e.g. &quot;{p.clinicName} Front Desk&quot;).</li>
          <li><b>APIs &amp; Services → Library</b>: enable <b>Gmail API</b> and <b>Google Calendar API</b>.</li>
          <li><b>OAuth consent screen</b>: External → add your clinic Gmail as a test user.</li>
          <li><b>Credentials → Create → OAuth client ID → Web application</b>. Add this redirect URI:
            <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-purple">{p.redirectUri}</code>
          </li>
          <li>Copy the Client ID and secret above → <b>Save credentials</b> → <b>Connect Google</b>.</li>
        </ol>
      </details>
    </Card>
  );
}

function Step({ ok, n, label, hint }: { ok: boolean; n: number; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ok ? "bg-emerald-500 text-white" : "bg-purple-soft text-purple-ink"}`}>{ok ? "✓" : n}</span>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </li>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
