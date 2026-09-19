"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Appointment, ApptStatus } from "@/lib/types";
import { Card } from "./ui";

const statuses: { value: ApptStatus; label: string; cls: string }[] = [
  { value: "scheduled", label: "Scheduled", cls: "bg-purple-ink text-white" },
  { value: "completed", label: "Completed", cls: "bg-emerald-600 text-white" },
  { value: "no_show", label: "No-show", cls: "bg-red-600 text-white" },
  { value: "cancelled", label: "Cancelled", cls: "bg-gray-500 text-white" },
];

export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [msg, setMsg] = useState("");

  async function patch(body: Partial<Appointment>) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/appointments/${appointment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      setMsg("Saved ✔");
      router.refresh();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Card title="Status">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button key={s.value} onClick={() => patch({ status: s.value })} disabled={busy} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${appointment.status === s.value ? s.cls : "bg-[#F6F3FF] text-purple-ink hover:bg-purple-soft"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Internal notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="dash-input" placeholder="Anything the dentist should know before the visit…" />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => patch({ notes })} disabled={busy} className="rounded-full bg-purple px-5 py-2 text-xs font-semibold text-white hover:bg-purple-deep disabled:opacity-50">Save notes</button>
          {msg && <span className="text-xs text-muted">{msg}</span>}
        </div>
      </Card>
    </div>
  );
}
