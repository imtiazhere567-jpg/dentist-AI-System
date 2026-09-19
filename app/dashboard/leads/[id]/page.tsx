import Link from "next/link";
import { ensureDb } from "@/lib/db";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Clock, Stethoscope } from "lucide-react";
import { getLead, bookingUrl } from "@/lib/leads";
import { leadName } from "@/lib/types";
import { Card, StatusBadge, PriorityBadge, SourceBadge, Avatar, fmtDate, intentLabel } from "@/components/dashboard/ui";
import { LeadActions } from "@/components/dashboard/LeadActions";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const { id } = await params;
  const { lead, messages, appointments } = await getLead(id);
  if (!lead) notFound();
  const name = leadName(lead);

  return (
    <div>
      <Link href="/dashboard/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-purple hover:underline">
        <ArrowLeft size={16} /> Back to leads
      </Link>

      {/* header */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[36px] leading-none text-purple-ink">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SourceBadge source={lead.source} />
            <StatusBadge status={lead.status} />
            <PriorityBadge priority={lead.priority} />
            {lead.intent && <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-purple-ink ring-1 ring-purple/10">{intentLabel[lead.intent]}</span>}
            <span className="text-xs text-muted">· received {fmtDate(lead.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        {/* left: contact + conversation */}
        <div className="space-y-6">
          {lead.ai_summary && (
            <div className="rounded-3xl bg-purple-ink p-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">AI summary</p>
              <p className="mt-1.5 text-[15px] leading-relaxed">{lead.ai_summary}</p>
            </div>
          )}

          {lead.followup_due_at && new Date(lead.followup_due_at) > new Date() && (
            <div className="flex items-start gap-3 rounded-3xl border border-gold/40 bg-gold/15 px-5 py-4 text-sm text-yellow-900">
              <span className="text-lg">⏳</span>
              <p>
                <b>Waiting for the patient to self-book</b> — they saw a &quot;Pick a time&quot; button on the website.
                If they haven&apos;t booked by <b>{fmtDate(lead.followup_due_at)}</b>, the AI will{" "}
                {lead.priority === "urgent" ? "email them the earliest openings automatically (emergency)" : "leave this draft here for you to approve"}.
                You can also send it now.
              </p>
            </div>
          )}
          {lead.booking_token && lead.status !== "spam" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(86,73,155,0.06),0_12px_32px_-16px_rgba(86,73,155,0.18)]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Patient&apos;s self-booking link</p>
                <p className="truncate font-mono text-xs text-purple">{bookingUrl(lead)}</p>
              </div>
              <a href={bookingUrl(lead)} target="_blank" className="rounded-full bg-purple-soft px-4 py-2 text-xs font-semibold text-purple-ink hover:bg-purple/30">Open →</a>
            </div>
          )}

          <Card title="Contact">
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <Info icon={<Mail size={15} />} label="Email">{lead.email ? <a href={`mailto:${lead.email}`} className="text-purple hover:underline">{lead.email}</a> : "—"}</Info>
              <Info icon={<Phone size={15} />} label="Phone">{lead.phone ? <a href={`tel:${lead.phone}`} className="text-purple hover:underline">{lead.phone}</a> : "—"}</Info>
              <Info icon={<Stethoscope size={15} />} label="Service">{lead.service ?? "—"}</Info>
              <Info icon={<Clock size={15} />} label="First reply">
                {lead.first_reply_at ? `${Math.max(1, Math.round((new Date(lead.first_reply_at).getTime() - new Date(lead.created_at).getTime()) / 60000))} min after` : "not yet"}
              </Info>
            </ul>
          </Card>

          <Card title={`Conversation · ${messages.length} message${messages.length === 1 ? "" : "s"}`}>
            <ul className="space-y-4">
              {messages.map((m, i) => {
                const inbound = m.direction === "inbound";
                const replyTo = inbound ? null : [...messages.slice(0, i)].reverse().find((x) => x.direction === "inbound");
                return (
                  <li key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${inbound ? "rounded-tl-sm bg-[#F6F3FF]" : "rounded-tr-sm bg-purple text-white"}`}>
                      {replyTo && (
                        <p className="mb-1.5 truncate rounded-lg bg-white/15 px-2 py-1 text-[11px] text-white/80">↩ replying to: “{replyTo.body.replace(/\s+/g, " ").slice(0, 70)}{replyTo.body.length > 70 ? "…" : ""}”</p>
                      )}
                      <div className={`mb-1 flex items-center justify-between gap-4 text-[11px] ${inbound ? "text-muted" : "text-white/70"}`}>
                        <span className="font-semibold">
                          {inbound ? name : m.sent_by === "ai" ? "Swish · ✨ AI (sent automatically)" : "Swish · staff"}
                          {m.subject ? ` · ${m.subject}` : ""}
                          
                        </span>
                        <span>{fmtDate(m.sent_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {appointments.length > 0 && (
            <Card title="Appointments">
              <ul className="space-y-2">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-2xl bg-[#F6F3FF] px-4 py-3 text-sm">
                    <span className="font-medium text-ink">{a.service ?? a.title}</span>
                    <span className="font-semibold text-purple">{fmtDate(a.starts_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* right: AI reply + actions */}
        <div className="xl:sticky xl:top-8 xl:self-start">
          <LeadActions lead={lead} />
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-soft text-purple-ink">{icon}</span>
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className="block text-ink">{children}</span>
      </span>
    </li>
  );
}
