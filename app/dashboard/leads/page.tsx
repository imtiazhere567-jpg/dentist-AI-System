import Link from "next/link";
import { ensureDb } from "@/lib/db";
import { Sparkles } from "lucide-react";
import { listLeads } from "@/lib/leads";
import { leadName } from "@/lib/types";
import { Card, PageTitle, StatusBadge, PriorityBadge, SourceBadge, Avatar, timeAgo, intentLabel } from "@/components/dashboard/ui";
import { DeleteLeadButton } from "@/components/dashboard/DeleteLeadButton";

export const dynamic = "force-dynamic";

const tabs = ["new", "contacted", "booked", "lost", "all", "spam"] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await ensureDb();
  const { status = "new" } = await searchParams;
  const [leads, all] = await Promise.all([listLeads({ status }), listLeads({ status: "all", limit: 10000 })]);
  const counts: Record<string, number> = { all: all.length };
  for (const l of all) counts[l.status] = (counts[l.status] ?? 0) + 1;

  return (
    <div>
      <PageTitle title="Leads" sub="Every inquiry from the website and inbox, triaged by AI." />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/dashboard/leads?status=${t}`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
              status === t ? "bg-purple-ink text-white shadow-md" : "bg-white text-purple-ink ring-1 ring-purple/10 hover:bg-purple-soft"
            }`}
          >
            {t}
            <span className={`rounded-full px-1.5 text-[11px] ${status === t ? "bg-white/20" : "bg-purple-soft"}`}>{counts[t] ?? 0}</span>
          </Link>
        ))}
      </div>

      <Card className="p-2">
        {leads.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">No {status === "all" ? "" : status} leads.</p>
        ) : (
          <ul className="divide-y divide-purple/10">
            {leads.map((l) => (
              <li key={l.id} className="group relative">
                <Link prefetch href={`/dashboard/leads/${l.id}`} className="flex items-center gap-4 rounded-2xl px-4 py-4 transition hover:bg-[#F6F3FF]">
                  <Avatar name={leadName(l)} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink">{leadName(l)}</span>
                      <StatusBadge status={l.status} />
                      <PriorityBadge priority={l.priority} />
                      {l.intent && <span className="rounded-full bg-[#F6F3FF] px-2.5 py-0.5 text-[11px] font-medium text-purple-ink">{intentLabel[l.intent]}</span>}
                      {l.followup_due_at && new Date(l.followup_due_at) > new Date() ? (
                        <span className="rounded-full bg-gold/25 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-800">⏳ patient may self-book</span>
                      ) : l.ai_reply && l.status === "new" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-800"><Sparkles size={11} /> reply ready</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{l.ai_summary ?? l.message}</p>
                    <p className="mt-1 text-xs text-muted/80">{l.email}{l.phone ? ` · ${l.phone}` : ""}{l.service ? ` · ${l.service}` : ""}</p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <SourceBadge source={l.source} />
                    <span className="text-[11px] text-muted">{timeAgo(l.created_at)}</span>
                  </div>
                  <span className="w-8 shrink-0" aria-hidden />
                </Link>
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  <DeleteLeadButton id={l.id} name={leadName(l)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
