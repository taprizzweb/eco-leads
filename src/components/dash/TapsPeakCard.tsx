"use client";

import { useEffect, useRef, useState } from "react";
import { PeakChart } from "@/components/ui/peak-chart";

export type PeriodSeries = { data: number[]; labels: string[]; total: number; prev: number; vs: string };

// Wraps the Peak Chart card for the dashboard: sizes it to its column and feeds it real tap counts.
export function TapsPeakCard({ series, updated }: { series: Record<"Weekly" | "Monthly" | "Yearly", PeriodSeries>; updated: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [period, setPeriod] = useState<"Weekly" | "Monthly" | "Yearly">("Weekly");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(Math.min(420, e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = series[period];
  const change = s.prev > 0 ? Math.round(((s.total - s.prev) / s.prev) * 100) : null;
  const trend = change === null || change === 0 ? "none" : change > 0 ? "up" : "down";
  const caption = change === null ? `No taps ${s.vs} to compare` : change === 0 ? `Same as ${s.vs}` : `${change > 0 ? "+" : ""}${change}% vs ${s.vs}`;

  return (
    <div ref={box} className="flex w-full justify-center [overflow-x:clip] [overflow-y:visible]">
      {width > 0 && (
        <PeakChart
          width={width}
          data={s.data}
          labels={s.labels}
          value={s.total}
          valueSuffix=""
          title={`Taps, ${period.toLowerCase()}`}
          caption={caption}
          updatedText={updated}
          trend={trend}
          periods={["Weekly", "Monthly", "Yearly"]}
          period={period}
          onPeriodChange={(p) => setPeriod(p as typeof period)}
          formatValue={(v) => `${Math.max(0, Math.round(v)).toLocaleString("en-IN")} taps`}
          font="var(--font-inter), system-ui, sans-serif"
        />
      )}
      {/* The card is drawn on a canvas; this table gives screen readers the same numbers. */}
      <div className="sr-only"><table>
        <caption>Taps per {period === "Yearly" ? "month" : "day"}, {period.toLowerCase()}: {s.total} total, {caption}</caption>
        <tbody>{s.data.map((v, i) => <tr key={s.labels[i]}><th scope="row">{s.labels[i]}</th><td>{v}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
