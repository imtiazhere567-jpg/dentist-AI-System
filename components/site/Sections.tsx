import { Smile, Wand2, Wallet } from "lucide-react";
import { site } from "@/lib/site-content";
import { BookButton } from "./BookButton";

const whyIcons = { smile: Smile, wand: Wand2, wallet: Wallet };

export function Why() {
  return (
    <section id="why" className="container-site pb-16 pt-4">
      <div className="rule mb-14" />
      <h2 className="section-title mb-10">Why Switch to Swish?</h2>
      {/* original: flex accordion — hovered card grows (2.5), siblings shrink (0.7), turns white with purple border, icon + text reveal */}
      <div className="why-grid">
        {site.why.map((w) => {
          const Icon = whyIcons[w.icon];
          return (
            <div key={w.title} className="why-card">
              <div className="why-icon">
                <Icon size={40} strokeWidth={2.2} />
              </div>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Team() {
  return (
    <section id="team" className="container-site pb-16 pt-4">
      <div className="rule mb-14" />
      {/* original: label 32px/600, heading Tobias 40px/52px, body 16px/25.6px ls 1px */}
      <p className="text-[26px] font-semibold text-purple md:text-[32px]">Our Team</p>
      <h2 className="mt-4 max-w-[745px] font-serif text-[34px] leading-[1.3] text-purple md:text-[40px]">{site.team.heading}</h2>
      <p className="mt-6 max-w-[745px] text-[16px] leading-[1.6] tracking-[1px] text-muted">{site.team.text}</p>
      {/* original team CTA: 12px 25px, 20px */}
      <BookButton size="md" className="mt-8" />
    </section>
  );
}

export function Services() {
  return (
    <section id="services" className="container-site pb-20 pt-4">
      <div className="rule mb-14" />
      <h2 className="section-title">Our Services</h2>
      <p className="mt-3 max-w-[760px] text-[16px] leading-[1.6] tracking-[1px] text-muted">
        From Essential Dentistry to Emergency Dental Services, our Team at Swish
        <br className="hidden md:block" /> is well-versed in all things oral care.
      </p>
      {/* original: number 16px bold (50px col), title Tobias 56px, description 18.4px; on hover a 300×200 image slides in and the arrow rotates -45° */}
      <ol className="mt-14 border-t border-purple">
        {site.services.map((s, i) => (
          <li key={s.title}>
            <a href="#contact" className="svc-row">
              <span className="mt-[15px] min-w-[50px] self-start text-[16px] font-bold text-purple">0{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt="" className="svc-img" />
              <div className="flex flex-1 flex-col pr-5">
                <h3 className="mb-[15px] font-serif text-[36px] leading-[1.1] text-purple md:text-[56px]">{s.title}</h3>
                <p className="max-w-[850px] text-[16px] leading-[1.5] text-muted md:text-[18.4px]">{s.text}</p>
              </div>
              <span className="svc-arrow" aria-hidden>→</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
