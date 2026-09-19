import Image from "next/image";
import { site } from "@/lib/site-content";
import { Tooth } from "./Logo";
import { BookButton } from "./BookButton";

export function Hero() {
  return (
    /* original @1920: text column starts 60px in, video is a 700×700 rounded square on the right */
    <section id="top" className="container-site grid items-center gap-12 pb-16 pt-4 md:grid-cols-[1fr_46%] md:gap-10 md:pt-8">
      <div className="md:pl-[60px]">
        {/* original: Tobias 72px / 86px line-height, wraps naturally (2 lines @1920) */}
        <h1 className="font-serif text-[48px] leading-[1.15] text-purple sm:text-[60px] md:text-[72px] md:leading-[1.2]">
          Where oral <Tooth className="mx-[0.12em] inline-block h-[0.68em] w-[0.68em] align-[-0.02em] text-purple" /> care meets self-care.
        </h1>
        {/* original: 20px / 32px, #626262, letter-spacing 1px */}
        <p className="mt-8 max-w-[690px] text-[18px] leading-[1.6] tracking-[1px] text-muted md:text-[20px]">
          {site.hero.sub1}
          <br />
          {site.hero.sub2}
        </p>
        <BookButton className="mt-10" />
      </div>

      <div className="relative aspect-square w-full max-w-[700px] justify-self-end overflow-hidden rounded-[25px] bg-purple-soft">
        {/* local photo always shows first; the video fades over it once it loads */}
        <Image src={site.hero.image} alt="Swish clinic" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" priority />
        {site.heroVideo && (
          <iframe
            src={site.heroVideo}
            title="Swish clinic"
            allow="autoplay; fullscreen"
            loading="lazy"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2"
          />
        )}
      </div>
    </section>
  );
}
