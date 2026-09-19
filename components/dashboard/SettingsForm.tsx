"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClinicSettings } from "@/lib/types";
import { Card } from "./ui";

type Field = { key: keyof ClinicSettings; label: string; type?: "text" | "textarea" | "email"; hint?: string };

const groups: { title: string; fields: Field[] }[] = [
  {
    title: "Clinic",
    fields: [
      { key: "clinic_name", label: "Clinic name" },
      { key: "clinic_email", label: "Clinic email", type: "email", hint: "Inbox that receives patient emails (the Google account you connect)." },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "hours", label: "Hours" },
    ],
  },
  {
    title: "What the AI may say",
    fields: [
      { key: "services", label: "Services", type: "textarea" },
      { key: "pricing_notes", label: "Pricing notes", type: "textarea", hint: "Only what the AI is allowed to quote." },
      { key: "insurance", label: "Insurance accepted", type: "textarea" },
      { key: "tone", label: "Reply tone", type: "textarea" },
      { key: "booking_link", label: "Online booking link (optional)" },
    ],
  },
  {
    title: "Notifications",
    fields: [{ key: "daily_summary_email", label: "Daily summary email", type: "email", hint: "Where the 8am summary goes." }],
  },
];

function Toggle({ checked, onChange, title, desc }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label className="flex items-start gap-3">
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-gray-200 transition peer-checked:bg-purple" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
      <span className="text-sm">
        <span className="font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: ClinicSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<ClinicSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const { id: _id, updated_at: _u, ...payload } = form;
      void _id; void _u;
      const body = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v ?? ""]));
      body.slot_minutes = Number(body.slot_minutes) || 45;
      body.followup_minutes = Number(body.followup_minutes) || 10;
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setMsg("Saved ✔");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {groups.map((g) => (
        <Card key={g.title} title={g.title}>
          <div className="space-y-4">
            {g.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-xs font-semibold text-muted">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea rows={2} className="dash-input" value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <input type={f.type ?? "text"} className="dash-input" value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
                {f.hint && <p className="mt-1 text-[11px] text-muted">{f.hint}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card title="Automation">
        <div className="space-y-5">
          <Toggle
            checked={form.emergency_auto_reply}
            onChange={(v) => setForm({ ...form, emergency_auto_reply: v })}
            title="Instant reply for emergencies"
            desc="When AI detects pain / a broken tooth / an urgent case, it immediately emails the patient the earliest openings and their personal booking link — day or night, no approval needed."
          />
          <Toggle
            checked={form.auto_book}
            onChange={(v) => setForm({ ...form, auto_book: v })}
            title="AI books when the patient confirms a time"
            desc='When a patient replies by email confirming one of the offered openings (e.g. "2 PM works"), AI creates the appointment and sends the confirmation — no staff action. Staff can still book manually from the lead.'
          />
          <Toggle
            checked={form.auto_reply}
            onChange={(v) => setForm({ ...form, auto_reply: v })}
            title="Auto-reply to simple questions"
            desc="Hours / location / insurance questions are answered automatically. Everything else waits for approval."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Appointment length (minutes)</label>
              <input type="number" min={15} max={180} step={15} className="dash-input" value={form.slot_minutes} onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })} />
              <p className="mt-1 text-[11px] text-muted">Used for the open-slot list patients see on their booking link.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Wait for website visitors (minutes)</label>
              <input type="number" min={1} max={120} className="dash-input" value={form.followup_minutes} onChange={(e) => setForm({ ...form, followup_minutes: Number(e.target.value) })} />
              <p className="mt-1 text-[11px] text-muted">After the form, visitors see a &quot;Pick a time&quot; button. AI waits this long for them to self-book before emailing.</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-full bg-purple px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple/30 transition hover:bg-purple-deep disabled:opacity-50">
          {busy ? "Saving…" : "Save settings"}
        </button>
        {msg && <span className="text-xs font-medium text-muted">{msg}</span>}
      </div>
    </form>
  );
}
