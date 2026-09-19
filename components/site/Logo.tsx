import Image from "next/image";
import { site } from "@/lib/site-content";

/** Swish wordmark — original is a 144×47 image. */
export function Logo({ className = "", width = 144 }: { className?: string; width?: number }) {
  return (
    <Image
      src={site.logo}
      alt={site.name}
      width={width}
      height={Math.round((width * 47) / 144)}
      className={`h-auto ${className}`}
      priority
    />
  );
}

export function Tooth({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      {/* solid tooth, like the original's inline icon */}
      <path
        d="M20 6c-7 0-13 6-13 14 0 6 2 9 4 15 2 7 3 23 9 23 5 0 5-12 12-12s7 12 12 12c6 0 7-16 9-23 2-6 4-9 4-15 0-8-6-14-13-14-5 0-8 3-12 3S25 6 20 6z"
        fill="currentColor"
      />
    </svg>
  );
}
