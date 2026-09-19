"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export function NewsletterForm() {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <p className="mt-6 flex items-center gap-2 text-[16px] font-semibold text-purple">
        <Check size={18} /> You&apos;re on the list!
      </p>
    );
  }
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setDone(true); }}
      className="mt-6 flex max-w-[280px] items-center border-b border-purple/60"
    >
      <input type="email" required placeholder="name@gmail.com" className="w-full bg-transparent py-2 text-[18px] text-purple outline-none placeholder:text-purple/60" />
      <button type="submit" aria-label="Subscribe" className="text-purple transition-transform duration-300 hover:translate-x-1">
        <ArrowRight size={20} />
      </button>
    </form>
  );
}
