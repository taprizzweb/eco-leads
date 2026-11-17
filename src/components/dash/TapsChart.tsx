"use client";

import { useState } from "react";

// One series (daily taps), so no legend: the title names it.
// Thin bars with 4px rounded data-ends on a recessive baseline; hover/focus shows the exact value.
export function TapsChart({ days }: { days: { label: string; full: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  const total = days.reduce((a, d) => a + d.value, 0);
  return (
    <figure>
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="font-semibold" style={{ color: "var(--d-text)" }}>Taps, last 7 days</span>
        <span className="text-sm tabular-nums" style={{ color: "var(--d-muted)" }}>{total} total</span>
      </figcaption>
      <div className="relative">
        <div className="flex h-36 items-end gap-2 border-b" style={{ borderColor: "var(--d-line-2)" }} role="list">
          {days.map((d, i) => (
            <div
              key={d.full}
              role="listitem"
              tabIndex={0}
              aria-label={`${d.full}: ${d.value} taps`}
              className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <span
                className="block w-full max-w-7 rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max(d.value ? 4 : 0, (d.value / max) * 100)}%`,
                  background: "var(--d-bar)",
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
              {hover === i && (
                <span className="d-raise pointer-events-none absolute bottom-full z-10 mb-2 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl" style={{ color: "var(--d-text)" }}>
                  <b className="tabular-nums">{d.value}</b> taps · {d.full}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {days.map((d) => (
            <span key={d.full} className="flex-1 text-center text-[11px]" style={{ color: "var(--d-muted)" }}>{d.label}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Taps per day</caption>
        <tbody>{days.map((d) => <tr key={d.full}><th>{d.full}</th><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
