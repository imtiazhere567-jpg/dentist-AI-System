"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, CalendarDays, Settings, Sparkles } from "lucide-react";

const icons = { overview: LayoutDashboard, leads: Inbox, bookings: CalendarDays, assistant: Sparkles, settings: Settings } as const;
export type NavIcon = keyof typeof icons;

export function NavLink({ href, label, icon }: { href: string; label: string; icon: NavIcon }) {
  const path = usePathname();
  const active = href === "/dashboard" ? path === href : path.startsWith(href);
  const Icon = icons[icon];
  return (
    <Link
      href={href}
      prefetch
      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
        active ? "bg-white text-purple-ink shadow-lg shadow-black/10" : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}
