"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui";

export function DataTools() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function run(action: "reset" | "clear") {
    const ok = confirm(action === "clear" ? "Delete ALL leads, messages and appointments? This can't be undone." : "Replace all current data with the example records?");
    if (!ok) return;
    setBusy(action); setMsg("");
    try {
      const r = await fetch("/api/admin/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setMsg(action === "clear" ? "All data cleared." : "Example data loaded.");
      router.refresh();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(""); }
  }

  return (
    <Card title="Workspace data">
      <p className="mb-4 text-xs text-muted">Example records are loaded automatically when the workspace is empty. Clear them once real patients start coming in.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run("reset")} disabled={!!busy} className="rounded-full bg-purple-soft px-4 py-2 text-xs font-semibold text-purple-ink hover:bg-purple/30 disabled:opacity-50">
          {busy === "reset" ? "Loading…" : "Load example data"}
        </button>
        <button onClick={() => run("clear")} disabled={!!busy} className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
          {busy === "clear" ? "Clearing…" : "Clear all data"}
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </Card>
  );
}
