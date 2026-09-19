"use client";

import { useState } from "react";

type Day = { date: string; label: string; count: number };

/** Single-series bar chart: leads per day. Purple bars, hover tooltip, recessive baseline. */
export function LeadsChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.count));
  const H = 140;
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-xs text-muted">Last 14 days</p>
        <p className="text-sm font-semibold text-ink">{total} leads</p>
      </div>
      <div className="relative">
        <div className="flex h-[140px] items-end gap-1.5 border-b border-purple/15" style={{ height: H }}>
          {days.map((d, i) => {
            const h = Math.max(d.count ? 6 : 2, Math.round((d.count / max) * (H - 10)));
            const isHover = hover === i;
            return (
              <div
                key={d.date}
                className="group relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${d.count ? (isHover ? "bg-purple-deep" : "bg-purple") : "bg-purple/20"}`}
                  style={{ height: h }}
                />
                {isHover && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <span className="font-semibold">{d.count}</span> {d.count === 1 ? "lead" : "leads"} · {d.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>{days[0]?.label}</span>
          <span>{days[Math.floor(days.length / 2)]?.label}</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal breakdown bars (single hue, sorted). */
export function Breakdown({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = rows.reduce((a, [, v]) => a + v, 0) || 1;
  if (rows.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {rows.map(([k, v]) => (
        <li key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="capitalize text-ink">{labels?.[k] ?? k.replace("_", " ")}</span>
            <span className="text-muted">{v} · {Math.round((v / total) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-purple/10">
            <div className="h-2 rounded-full bg-purple" style={{ width: `${(v / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
