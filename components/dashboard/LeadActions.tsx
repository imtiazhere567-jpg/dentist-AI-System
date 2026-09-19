"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, CalendarPlus, Check } from "lucide-react";
import type { Lead, LeadStatus } from "@/lib/types";
import { SERVICE_OPTIONS } from "@/lib/site-content";
import { Card } from "./ui";

type Slot = { iso: string; label: string };

export function LeadActions({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [reply, setReply] = useState(lead.ai_reply ?? "");
  const [busy, setBusy] = useState<"" | "ai" | "send" | "book" | "status">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // booking
  const [slots, setSlots] = useState<Slot[]>([]);
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [service, setService] = useState((SERVICE_OPTIONS as readonly string[]).includes(lead.service ?? "") ? lead.service! : "");

  useEffect(() => {
    fetch("/api/slots?days=7")
      .then((r) => r.json())
      .then((j) => setSlots(j.slots ?? []))
      .catch(() => {});
  }, []);

  async function call(path: string, body?: unknown, method = "POST") {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function runAI() {
    setBusy("ai"); setMsg(null);
    try {
      const j = await call(`/api/leads/${lead.id}/process`);
      setReply(j.analysis?.reply ?? "");
      setMsg({ ok: true, text: "Draft ready — review and send." });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(""); }
  }

  async function send() {
    if (!reply.trim()) return;
    setBusy("send"); setMsg(null);
    try {
      await call(`/api/leads/${lead.id}/reply`, { body: reply });
      setMsg({ ok: true, text: "Reply sent ✔" });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(""); }
  }

  async function book() {
    if (!start) return;
    setBusy("book"); setMsg(null);
    try {
      const j = await call(`/api/leads/${lead.id}/book`, { start: new Date(start).toISOString(), minutes, service });
      setMsg({ ok: true, text: "Booked ✔ Confirmation sent to the patient." });
      if (j.htmlLink) window.open(j.htmlLink, "_blank");
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(""); }
  }

  async function setStatus(status: LeadStatus) {
    setBusy("status");
    try { await call(`/api/leads/${lead.id}`, { status }, "PATCH"); router.refresh(); } finally { setBusy(""); }
  }

  const placeholder =
    lead.status === "spam"
      ? "Marked as spam — no reply suggested."
      : lead.first_reply_at
        ? "Reply already sent. Click “Generate draft” if the patient writes back."
        : "Click “Generate draft” to let AI write a reply…";

  return (
    <div className="space-y-6">
      {/* AI reply */}
      <div className="rounded-3xl bg-gradient-to-br from-purple to-purple-ink p-[1.5px] shadow-[0_16px_40px_-20px_rgba(86,73,155,0.5)]">
        <div className="rounded-[22px] bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-soft text-purple"><Sparkles size={16} /></span>
              AI suggested reply
            </h2>
            <button onClick={runAI} disabled={busy !== ""} className="rounded-full bg-purple-soft px-3.5 py-1.5 text-xs font-semibold text-purple-ink transition hover:bg-purple/30 disabled:opacity-50">
              {busy === "ai" ? "Thinking…" : lead.ai_reply ? "Regenerate" : "Generate draft"}
            </button>
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={11}
            placeholder={placeholder}
            className="w-full resize-y rounded-2xl border border-purple/15 bg-[#FBFAFF] px-4 py-3 text-sm leading-relaxed text-ink outline-none transition placeholder:text-gray-400 focus:border-purple focus:ring-2 focus:ring-purple/20"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={send} disabled={busy !== "" || !reply.trim() || !lead.email} className="inline-flex items-center gap-2 rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple/30 transition hover:bg-purple-deep disabled:opacity-50 disabled:shadow-none">
              <Send size={15} /> {busy === "send" ? "Sending…" : "Approve & send"}
            </button>
            {!lead.email && <span className="text-xs text-muted">No email on this lead — reply by phone.</span>}
          </div>
          {msg && <p className={`mt-3 text-xs font-medium ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
        </div>
      </div>

      {/* booking */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CalendarPlus size={16} /></span>
          Book appointment
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-muted">Service</label>
            {/* same list as the website form */}
            <select value={service} onChange={(e) => setService(e.target.value)} className="dash-input">
              <option value="">Select a service</option>
              {SERVICE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Date & time</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="dash-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Duration (min)</label>
            <input type="number" min={15} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="dash-input" />
          </div>
        </div>
        {slots.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted">Open slots</p>
            <div className="flex flex-wrap gap-2">
              {slots.slice(0, 12).map((s) => {
                const v = toLocalInput(s.iso);
                return (
                  <button key={s.iso} onClick={() => setStart(v)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${start === v ? "bg-purple-ink text-white" : "bg-[#F6F3FF] text-purple-ink hover:bg-purple-soft"}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button onClick={book} disabled={busy !== "" || !start || !service} className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-50 disabled:shadow-none">
          <Check size={15} /> {busy === "book" ? "Booking…" : "Create appointment"}
        </button>
      </Card>

      {/* status */}
      <Card title="Status">
        <div className="flex flex-wrap gap-2">
          {(["new", "contacted", "booked", "lost", "spam"] as LeadStatus[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} disabled={busy !== ""} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition ${lead.status === s ? "bg-purple-ink text-white" : "bg-[#F6F3FF] text-purple-ink hover:bg-purple-soft"}`}>
              {s}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
