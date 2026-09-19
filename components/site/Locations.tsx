"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { site } from "@/lib/site-content";

export function Locations() {
  const [i, setI] = useState(0);
  const loc = site.locations[i];
  const g = site.gallery;
  const prev = () => setI((i - 1 + site.locations.length) % site.locations.length);
  const next = () => setI((i + 1) % site.locations.length);

  return (
    <section id="location" className="container-site pb-16 pt-4">
      <div className="rule mb-14" />
      <h2 className="section-title mb-8">Swish Locations</h2>

      {/* original @1920: columns 448 / 538 / 448, rows 280 + 550, gap 20, radius 35 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-[1fr_1.2fr_1fr] md:grid-rows-[280px_550px] md:gap-5">
        {/* location card — original: h2 22px, arrows 34px #5D54A4, gold sweep button */}
        <div className="col-span-2 flex flex-col justify-between rounded-[35px] bg-purple-soft p-7 md:col-span-1 md:p-8">
          <div className="flex gap-2.5">
            <button onClick={prev} className="grid h-[34px] w-[34px] place-items-center rounded-full bg-purple-deep text-white transition duration-300 hover:bg-purple" aria-label="Previous">
              <ChevronLeft size={16} />
            </button>
            <button onClick={next} className="grid h-[34px] w-[34px] place-items-center rounded-full bg-purple-deep text-white transition duration-300 hover:bg-purple" aria-label="Next">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="my-4">
            <h3 className="text-[22px] font-medium tracking-[-0.5px] text-purple-deep">{loc.name}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{loc.address}</p>
          </div>
          <a href="#contact" className="sweep-btn w-fit">
            See Location Details
          </a>
        </div>

        <Pic src={g[0]} className="md:row-span-2" />
        <Pic src={g[1]} />
        <Pic src={g[2]} />
        <Pic src={g[3]} />
      </div>
    </section>
  );
}

/* original: image zooms to 1.07 over 1.2s on hover */
function Pic({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`group relative min-h-[200px] overflow-hidden rounded-[35px] ${className}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 768px) 30vw, 50vw"
        className="object-cover transition-transform duration-[1200ms] ease-in-out group-hover:scale-[1.07]"
      />
    </div>
  );
}
