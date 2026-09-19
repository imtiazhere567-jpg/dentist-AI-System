"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncButtons() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function sync() {
    setBusy(true);
    setMsg("");
    try {
      const [g, c] = await Promise.all([fetch("/api/sync/gmail").then((r) => r.json()), fetch("/api/sync/calendar").then((r) => r.json())]);
      const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (g.reason || c.reason) setMsg(`Up to date · ${t}`);
      else setMsg(`${g.created ?? 0} new lead${g.created === 1 ? "" : "s"} · ${c.synced ?? 0} calendar events · ${t}`);
      router.refresh();
    } catch {
      setMsg("Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-purple-ink shadow-sm ring-1 ring-purple/15 transition hover:bg-purple-soft disabled:opacity-50"
      >
        <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> Sync now
      </button>
    </div>
  );
}
