"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Custom dropdown styled like the form inputs (native <select> lists can't be styled).
 * Submits through a hidden input so the plain form POST keeps working.
 */
export function Select({
  name,
  options,
  placeholder = "Select…",
  required,
  label,
}: {
  name: string;
  options: string[];
  placeholder?: string;
  required?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  // close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open && active >= 0) choose(options[active]); else setOpen((o) => !o); }
  }

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />
      {/* required check for native validation */}
      {required && <input tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0" required value={value} onChange={() => {}} />}

      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`input flex items-center justify-between text-left ${value ? "text-ink" : "text-gray-400"} ${open ? "border-purple ring-2 ring-purple/20" : ""}`}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-purple transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <ul
        id={listId}
        role="listbox"
        className={`absolute left-0 right-0 z-30 mt-2 origin-top overflow-hidden rounded-[10px] border border-purple/15 bg-white py-2 shadow-[0_24px_50px_-20px_rgba(86,73,155,0.35)] transition-all duration-200 ${
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
        }`}
      >
        {options.map((o, i) => {
          const selected = o === value;
          return (
            <li
              key={o}
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`flex cursor-pointer items-center justify-between px-5 py-3 text-[17px] transition-colors ${
                selected ? "bg-purple-soft font-medium text-purple-ink" : active === i ? "bg-[#F6F3FF] text-purple-ink" : "text-ink"
              }`}
            >
              {o}
              {selected && <Check size={16} className="text-purple" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
