import type { LeadPriority, LeadStatus, LeadSource, LeadIntent } from "@/lib/types";
import { CalendarDays, Inbox, MailWarning, TrendingUp, type LucideIcon } from "lucide-react";

export function Card({ children, className = "", title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return (
    <div className={`rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(86,73,155,0.06),0_12px_32px_-16px_rgba(86,73,155,0.18)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[40px] leading-none text-purple-ink">{title}</h1>
        {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const statIcons: Record<string, LucideIcon> = { calendar: CalendarDays, inbox: Inbox, waiting: MailWarning, trend: TrendingUp };
const tones = {
  purple: "bg-purple-soft text-purple-ink",
  gold: "bg-gold/25 text-yellow-800",
  red: "bg-red-100 text-red-600",
  green: "bg-emerald-100 text-emerald-700",
};

export function Stat({ label, value, hint, icon, tone = "purple" }: { label: string; value: string | number; hint?: string; icon: keyof typeof statIcons; tone?: keyof typeof tones }) {
  const Icon = statIcons[icon];
  return (
    <Card className="flex items-start gap-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-1 font-serif text-[40px] leading-none text-ink">{value}</p>
        {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

const statusStyles: Record<LeadStatus, string> = {
  new: "bg-purple-soft text-purple-ink",
  contacted: "bg-sky-100 text-sky-800",
  booked: "bg-emerald-100 text-emerald-800",
  lost: "bg-gray-100 text-gray-600",
  spam: "bg-gray-100 text-gray-500 line-through",
};
export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusStyles[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: LeadPriority | null }) {
  if (priority !== "urgent") return null;
  return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">🚨 Urgent</span>;
}

export function SourceBadge({ source }: { source: LeadSource }) {
  const icon = source === "website" ? "🌐" : source === "email" ? "✉️" : source === "calendar" ? "📅" : "✍️";
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F3FF] px-2.5 py-0.5 text-[11px] font-medium capitalize text-purple-ink">{icon} {source}</span>;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const hues = ["bg-purple-soft text-purple-ink", "bg-gold/30 text-yellow-900", "bg-sky-100 text-sky-800", "bg-emerald-100 text-emerald-800", "bg-rose-100 text-rose-800"];
  const h = hues[name.charCodeAt(0) % hues.length];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-semibold ${h}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export const intentLabel: Record<LeadIntent, string> = {
  new_patient: "New patient",
  emergency: "Emergency",
  cleaning: "Cleaning",
  price_inquiry: "Pricing",
  insurance: "Insurance",
  reschedule: "Reschedule",
  cancel: "Cancel",
  kids: "Kids",
  invisalign: "Invisalign",
  dental_work: "Dental work",
  general: "General",
  spam: "Spam",
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...opts });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
