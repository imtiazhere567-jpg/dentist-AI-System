import Link from "next/link";
import { ensureDb } from "@/lib/db";
import { ArrowRight } from "lucide-react";
import { dashboardStats } from "@/lib/leads";
import { leadName } from "@/lib/types";
import { Card, PageTitle, Stat, SourceBadge, Avatar, timeAgo, fmtTime, intentLabel } from "@/components/dashboard/ui";
import { SyncButtons } from "@/components/dashboard/SyncButtons";
import { LeadsChart, Breakdown } from "@/components/dashboard/LeadsChart";

export const dynamic = "force-dynamic";

export default async function Overview() {
  await ensureDb();
  const s = await dashboardStats();
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageTitle
        title={`${greeting} 👋`}
        sub={today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        right={<SyncButtons />}
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="calendar" label="Appointments today" value={s.apptsToday} hint={`${s.apptsWeek} in the next 7 days`} />
        <Stat icon="inbox" label="Leads this week" value={s.leadsWeek} hint={`${s.leadsToday} today · ${s.leadsMonth} in 30 days`} tone="gold" />
        <Stat icon="waiting" label="Waiting for reply" value={s.pendingReplies} hint={s.urgent ? `${s.urgent} urgent — reply now` : "Nothing urgent"} tone={s.urgent ? "red" : "green"} />
        <Stat icon="trend" label="Lead → booking" value={`${s.conversion}%`} hint={`${s.bookedMonth} booked of ${s.leadsMonth} (30d)`} tone="green" />
      </div>

      {/* urgent strip */}
      {s.urgentLeads.length > 0 && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5">
          <p className="mb-3 text-sm font-semibold text-red-700">🚨 Needs attention now</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {s.urgentLeads.map((l) => (
              <li key={l.id}>
                <Link prefetch href={`/dashboard/leads/${l.id}`} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 transition hover:shadow-md">
                  <Avatar name={leadName(l)} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{leadName(l)}</span>
                    <span className="block truncate text-xs text-muted">{l.ai_summary ?? l.message}</span>
                  </span>
                  <span className="text-[11px] text-muted">{timeAgo(l.created_at)}</span>
                  <ArrowRight size={16} className="text-purple" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* left column */}
        <div className="space-y-6">
          <Card title="Lead volume">
            <LeadsChart days={s.perDay} />
          </Card>

          <Card
            title={`Needs your action${s.todos.length ? ` · ${s.todos.length}` : ""}`}
            action={<Link href="/dashboard/leads" className="text-xs font-semibold text-purple hover:underline">All leads →</Link>}
          >
            {s.todos.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl">🎉</p>
                <p className="mt-1 text-sm font-semibold text-ink">All caught up</p>
                <p className="text-xs text-muted">Every lead has been answered. New ones will appear here.</p>
              </div>
            ) : (
              <ul className="-mx-2 divide-y divide-purple/10">
                {s.todos.map(({ lead: l, kind, label, action }) => {
                  const tone =
                    kind === "urgent" ? "bg-red-100 text-red-700" :
                    kind === "replied" ? "bg-sky-100 text-sky-800" :
                    kind === "waiting" ? "bg-gray-100 text-gray-600" :
                    "bg-gold/25 text-yellow-800";
                  const icon = kind === "urgent" ? "🚨" : kind === "replied" ? "💬" : kind === "waiting" ? "⏳" : kind === "draft" ? "✨" : "✍️";
                  return (
                    <li key={l.id}>
                      <Link prefetch href={`/dashboard/leads/${l.id}`} className="flex items-center gap-4 rounded-2xl px-2 py-3 transition hover:bg-[#F6F3FF]">
                        <Avatar name={leadName(l)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink">{leadName(l)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{icon} {label}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">{l.ai_summary ?? l.message}</p>
                          <p className="mt-0.5 text-[11px] text-muted"><SourceBadge source={l.source} /> · {timeAgo(l.created_at)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-purple px-3.5 py-1.5 text-xs font-semibold text-white">{action} →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* right column */}
        <div className="space-y-6">
          <Card title="Upcoming appointments" action={<Link href="/dashboard/bookings" className="text-xs font-semibold text-purple hover:underline">Calendar →</Link>}>
            {s.upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nothing scheduled.</p>
            ) : (
              <ol className="relative ml-2 space-y-4 border-l-2 border-purple/15 pl-5">
                {s.upcoming.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-purple" />
                    <p className="text-xs font-semibold text-purple">{fmtTime(a.starts_at)} – {fmtTime(a.ends_at)}</p>
                    <p className="text-sm font-medium text-ink">{a.patient_name ?? a.title}</p>
                    <p className="text-xs text-muted">{a.service ?? a.title}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Where leads come from">
            <Breakdown data={s.bySource} />
          </Card>

          <Card title="What they ask about">
            <Breakdown data={s.byIntent} labels={intentLabel} />
          </Card>

          <Card title="Response speed">
            <p className="font-serif text-[40px] leading-none text-ink">{s.avgReplyMin == null ? "—" : `${s.avgReplyMin} min`}</p>
            <p className="mt-2 text-xs text-muted">Average time to first reply (30 days). Under 5 minutes converts best.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
