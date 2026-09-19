"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, MapPin, Phone, AlertTriangle } from "lucide-react";

type Slot = { iso: string; label: string; day: string; time: string };
type Info = {
  name: string;
  service: string | null;
  urgent: boolean;
  clinic: { name: string; phone: string | null; address: string | null; hours: string | null };
  services: readonly string[];
  slotMinutes: number;
  existing: { starts_at: string; service: string | null } | null;
  slots: Slot[];
};

/** Patient-facing self-serve booking (opened from the link in the AI's reply). */
export function BookingPicker({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [service, setService] = useState("");
  const [picked, setPicked] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ starts_at: string; service: string | null } | null>(null);

  useEffect(() => {
    fetch(`/api/book/${token}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j as Info; })
      .then((j) => { setInfo(j); setService(j.service ?? ""); })
      .catch((e) => setError(e.message));
  }, [token]);

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of info?.slots ?? []) m.set(s.day, [...(m.get(s.day) ?? []), s]);
    return [...m.entries()];
  }, [info]);

  async function confirm() {
    if (!picked) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/book/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: picked.iso, service, notes }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDone(j.appointment);
    } catch (e) {
      setError((e as Error).message);
      // refresh slots in case ours was taken
      fetch(`/api/book/${token}`).then((r) => r.json()).then(setInfo).catch(() => {});
    } finally { setBusy(false); }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (error && !info) return <Card><p className="text-center text-[18px] text-muted">{error}</p></Card>;
  if (!info) return <Card><p className="text-center text-[18px] text-muted">Loading available times…</p></Card>;

  const booked = done ?? info.existing;
  if (booked) {
    return (
      <Card>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={32} /></div>
        <h1 className="mt-6 text-center font-serif text-[40px] leading-tight text-purple">You&apos;re booked, {info.name}!</h1>
        <p className="mt-3 text-center text-[20px] text-ink">{booked.service ?? "Appointment"} · {fmt(booked.starts_at)}</p>
        <div className="mx-auto mt-8 max-w-md space-y-2 text-[16px] text-muted">
          {info.clinic.address && <p className="flex items-center gap-2"><MapPin size={16} className="text-purple" /> {info.clinic.address}</p>}
          {info.clinic.phone && <p className="flex items-center gap-2"><Phone size={16} className="text-purple" /> Need to change it? Call {info.clinic.phone} or reply to our email.</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {info.urgent && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-red-50 px-5 py-4 text-red-700">
          <AlertTriangle size={20} />
          <p className="text-[16px]">This sounds urgent — grab the earliest time below, or call us right now{info.clinic.phone ? ` at ${info.clinic.phone}` : ""}.</p>
        </div>
      )}
      <h1 className="font-serif text-[40px] leading-tight text-purple md:text-[48px]">Hi {info.name}, pick a time</h1>
      <p className="mt-2 text-[18px] text-muted">{info.slotMinutes}-minute visit at {info.clinic.name}{info.clinic.address ? `, ${info.clinic.address}` : ""}.</p>

      <div className="mt-8">
        <label className="label">What is the visit for?</label>
        <div className="flex flex-wrap gap-2">
          {info.services.map((s) => (
            <button key={s} type="button" onClick={() => setService(s)} className={`rounded-full px-5 py-2.5 text-[15px] font-medium transition ${service === s ? "bg-purple text-white" : "bg-purple-soft text-purple-ink hover:bg-purple/30"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <label className="label">Available times</label>
        {byDay.length === 0 ? (
          <p className="text-[16px] text-muted">No open times in the next 7 days — please call us{info.clinic.phone ? ` at ${info.clinic.phone}` : ""}.</p>
        ) : (
          <div className="space-y-5">
            {byDay.map(([day, slots]) => (
              <div key={day}>
                <p className="mb-2 text-[15px] font-semibold text-purple-ink">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button key={s.iso} type="button" onClick={() => setPicked(s)} className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[15px] transition ${picked?.iso === s.iso ? "border-purple bg-purple text-white" : "border-purple/20 bg-white text-ink hover:border-purple hover:text-purple"}`}>
                      <Clock size={14} /> {s.time}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <label className="label" htmlFor="notes">Anything we should know? (optional)</label>
        <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" placeholder="e.g. pain on the lower left side" />
      </div>

      {error && <p className="mt-4 text-[15px] text-red-600">{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={!picked || !service || busy}
        className="mt-8 w-full rounded-[10px] border-2 border-purple-light bg-purple-light py-5 text-[22px] font-semibold text-white transition-all duration-[400ms] hover:bg-white hover:text-purple-light disabled:opacity-50 disabled:hover:bg-purple-light disabled:hover:text-white"
      >
        {busy ? "Booking…" : picked ? `Confirm ${picked.label}` : "Pick a time above"}
      </button>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[800px] rounded-[14px] border-t-[6px] border-purple bg-white px-6 py-10 font-jost shadow-[0_30px_80px_-30px_rgba(129,110,231,0.45)] sm:px-12">{children}</div>;
}
