import Link from "next/link";
import { after } from "next/server";
import { Globe, LogOut } from "lucide-react";
import { NavLink, type NavIcon } from "@/components/dashboard/NavLink";
import { getSettings } from "@/lib/settings";
import { runDueFollowups } from "@/lib/leads";
import { seedIfEmpty } from "@/lib/seed";
import { ensureDb, flushDb } from "@/lib/db";

const links: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/leads", label: "Leads", icon: "leads" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "bookings" },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: "assistant" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureDb();
  seedIfEmpty();
  // expired follow-ups + persisting writes happen after the response is sent, so pages render instantly
  after(async () => {
    await runDueFollowups().catch(() => {});
    await flushDb();
  });
  const settings = await getSettings();
  const initials = settings.clinic_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#F6F3FF]">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-purple-ink p-6 text-white md:flex">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 font-serif text-2xl italic">S</span>
          <span>
            <span className="block text-lg font-semibold leading-tight">Swish</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Front Desk AI</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1.5">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} />
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <Link href="/" target="_blank" className="flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
            <Globe size={16} /> View website
          </Link>
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-sm font-bold text-purple-ink">{initials}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{settings.clinic_name}</span>
              <span className="block truncate text-xs text-white/60">{settings.clinic_email ?? "Front desk"}</span>
            </span>
            <form action="/api/dashboard/login" method="post" className="hidden" />
            <Link href="/login" aria-label="Sign out" className="text-white/60 hover:text-white"><LogOut size={16} /></Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top nav */}
        <div className="flex items-center gap-4 bg-purple-ink px-4 py-3 text-white md:hidden">
          <span className="font-serif text-2xl italic">Swish</span>
          <nav className="flex gap-4 overflow-x-auto text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap text-white/80">{l.label}</Link>
            ))}
          </nav>
        </div>
        <main className="flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
