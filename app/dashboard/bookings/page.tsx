import Link from "next/link";
import { listAppointments, ensureDb } from "@/lib/db";
import type { Appointment } from "@/lib/types";
import { Card, PageTitle, Avatar, fmtTime } from "@/components/dashboard/ui";
import { SyncButtons } from "@/components/dashboard/SyncButtons";

export const dynamic = "force-dynamic";

const statusStyle: Record<Appointment["status"], { dot: string; badge: string }> = {
  scheduled: { dot: "bg-purple", badge: "bg-purple-soft text-purple-ink" },
  completed: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  cancelled: { dot: "bg-gray-300", badge: "bg-gray-100 text-gray-500" },
  no_show: { dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await ensureDb();
  const { range = "week" } = await searchParams;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (range === "today") end.setDate(end.getDate() + 1);
  else if (range === "month") end.setDate(end.getDate() + 30);
  else end.setDate(end.getDate() + 7);

  const appts = listAppointments(start, end);
  const active = appts.filter((a) => a.status !== "cancelled");

  const byDay = new Map<string, Appointment[]>();
  for (const a of appts) {
    const k = new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }

  return (
    <div>
      <PageTitle title="Bookings" sub={`${active.length} appointments · ${range === "today" ? "today" : range === "month" ? "next 30 days" : "next 7 days"}`} right={<SyncButtons />} />

      <div className="mb-5 flex gap-2">
        {[["today", "Today"], ["week", "Next 7 days"], ["month", "Next 30 days"]].map(([r, label]) => (
          <Link key={r} href={`/dashboard/bookings?range=${r}`} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${range === r ? "bg-purple-ink text-white shadow-md" : "bg-white text-purple-ink ring-1 ring-purple/10 hover:bg-purple-soft"}`}>
            {label}
          </Link>
        ))}
      </div>

      {byDay.size === 0 ? (
        <Card><p className="py-14 text-center text-sm text-muted">No appointments in this range.</p></Card>
      ) : (
        <div className="space-y-5">
          {[...byDay.entries()].map(([day, list]) => (
            <Card key={day} className="p-0">
              <div className="flex items-center justify-between border-b border-purple/10 px-6 py-4">
                <h2 className="font-serif text-xl text-purple-ink">{day}</h2>
                <span className="rounded-full bg-[#F6F3FF] px-2.5 py-0.5 text-xs font-semibold text-purple-ink">{list.length}</span>
              </div>
              <ul className="divide-y divide-purple/10">
                {list.map((a) => {
                  const st = statusStyle[a.status];
                  return (
                    <li key={a.id}>
                      <Link prefetch href={`/dashboard/bookings/${a.id}`} className="flex items-center gap-4 px-6 py-4 transition hover:bg-[#F6F3FF]">
                        <div className="w-[120px] shrink-0">
                          <p className="text-sm font-semibold text-ink">{fmtTime(a.starts_at)}</p>
                          <p className="text-xs text-muted">to {fmtTime(a.ends_at)}</p>
                        </div>
                        <span className={`h-10 w-1 shrink-0 rounded-full ${st.dot}`} />
                        <Avatar name={a.patient_name ?? a.title ?? "?"} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{a.patient_name ?? a.title}</p>
                          <p className="truncate text-xs text-muted">{a.service ?? a.title}{a.patient_email ? ` · ${a.patient_email}` : ""}{a.booked_via === "patient_link" ? " · self-booked" : a.booked_via === "ai" ? " · ✨ AI-booked" : ""}</p>
                        </div>
                        {a.calendar_link && <span className="hidden text-[11px] text-muted sm:inline">📅 in Calendar</span>}
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${st.badge}`}>{a.status.replace("_", " ")}</span>
                        <span className="text-xs font-semibold text-purple">details →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
