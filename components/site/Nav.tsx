"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/lib/site-content";
import { Logo } from "./Logo";
import { BookButton } from "./BookButton";

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    /* original @1920: logo 60px in from the content edge, CTA ~55px in from the right */
    <header className="container-site relative flex items-center justify-between py-8 md:px-[calc(3.5rem+60px)] md:py-10 xl:px-[242px]">
      <a href="#top" aria-label={site.name}>
        <Logo />
      </a>
      {/* original: links 20px / 600 purple, CTA pill 22px bold */}
      <nav className="hidden items-center gap-10 md:flex">
        {site.nav.map((n) => (
          <a key={n.href} href={n.href} className="nav-link text-[20px] font-semibold text-purple">
            {n.label}
          </a>
        ))}
        <BookButton className="ml-2" />
      </nav>
      <button className="text-purple md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
        {open ? <X size={28} /> : <Menu size={28} />}
      </button>
      {open && (
        <div className="absolute left-6 right-6 top-20 z-40 rounded-2xl border border-purple/20 bg-cream p-6 shadow-xl md:hidden">
          <div className="flex flex-col gap-5">
            {site.nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="text-lg font-semibold text-purple">
                {n.label}
              </a>
            ))}
            <span onClick={() => setOpen(false)}>
              <BookButton size="md" />
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
