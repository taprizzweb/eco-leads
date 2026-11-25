"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LinkEditor, type EditorMode } from "@/components/admin/LinkEditor";

type Stats = {
  days: { day: string; views: number; clicks: number }[];
  buttons: { key: string; clicks: number }[];
  views: number; clicks: number; since_start: { views: number; clicks: number };
};
type EditorRow = Parameters<typeof LinkEditor>[0]["initial"];

const RANGES = [7, 30, 90] as const;
const nf = (n: number) => n.toLocaleString("en-IN");
const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
// Stats keys are "Button: Food Menu", "Icon: Instagram" ... Split the kind from the name for display.
const split = (k: string) => { const i = k.indexOf(": "); return i > 0 ? { kind: k.slice(0, i), name: k.slice(i + 2) } : { kind: "", name: k }; };

export function LinkInsights({ mode, linkId, token }: { mode: EditorMode; linkId: string; token?: string }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [s, setS] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async (d: number) => {
    const sb = supabaseBrowser();
    const { data, error } = mode === "token" ? await sb.rpc("link_edit_stats", { p_token: token, p_days: d })
      : mode === "member" ? await sb.rpc("link_my_stats", { p_id: linkId, p_days: d })
      : await sb.rpc("link_admin_stats", { p_id: linkId, p_days: d });
    if (error || !data) { setFailed(true); return; }
    setFailed(false); setS(data as Stats);
  }, [mode, linkId, token]);
  useEffect(() => { void load(days); }, [days, load]);

  if (failed) return <div className="d-card p-5 text-sm" style={{ color: "var(--d-muted)" }}>The numbers could not load. Refresh the page.</div>;
  if (!s) return <div className="d-card grid place-items-center p-10"><Loader2 className="animate-spin" /></div>;

  const maxV = Math.max(1, ...s.days.map((d) => d.views));
  const maxB = Math.max(1, ...s.buttons.map((b) => b.clicks));
  const rate = s.views ? Math.round((s.clicks / s.views) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="d-seg w-fit" role="group" aria-label="Period">
        {RANGES.map((r) => <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>Last {r} days</button>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Page visits", nf(s.views)], ["Taps on buttons and icons", nf(s.clicks)], ["Taps per 100 visits", String(rate)]].map(([l, v]) => (
          <div key={l} className="d-card p-5"><p className="text-sm" style={{ color: "var(--d-muted)" }}>{l}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>

      <section className="d-card p-5">
        <h2 className="font-semibold">Visits per day</h2>
        <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label={`Visits per day, ${nf(s.views)} in total`}>
          {s.days.map((d) => (
            <div key={d.day} title={`${dayLabel(d.day)}: ${d.views} visits, ${d.clicks} taps`} className="min-w-[2px] flex-1 rounded-t-sm" style={{ height: `${Math.max(d.views ? 4 : 1, (d.views / maxV) * 100)}%`, background: d.views ? "var(--d-text)" : "var(--d-line-2)", opacity: d.views ? 0.85 : 1 }} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs" style={{ color: "var(--d-muted)" }}><span>{dayLabel(s.days[0].day)}</span><span>{dayLabel(s.days[s.days.length - 1].day)}</span></div>
      </section>

      <section className="d-card p-5">
        <h2 className="font-semibold">Which button was tapped</h2>
        <p className="mt-0.5 text-sm" style={{ color: "var(--d-muted)" }}>Counted by the name on the button. If you rename a button, it starts a new count.</p>
        {s.buttons.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--d-muted)" }}>No taps yet in this period. They show up here as soon as visitors use the page.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {s.buttons.map((b) => {
              const { kind, name } = split(b.key);
              return (
                <li key={b.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{name}{kind && <span className="ml-2 text-xs font-normal" style={{ color: "var(--d-muted)" }}>{kind}</span>}</span><span className="tabular-nums">{nf(b.clicks)}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: "var(--d-line)" }}><div className="h-full rounded-full" style={{ width: `${(b.clicks / maxB) * 100}%`, background: "var(--d-text)" }} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="text-xs" style={{ color: "var(--d-muted)" }}>Since the page went live: {nf(s.since_start.views)} visits and {nf(s.since_start.clicks)} taps. Counts hold no names, phone numbers or device details. Button counts start from today; older taps are only in the totals.</p>
    </div>
  );
}

export function LinkManager({ initial, clientName, mode, token, mini = false, premium = false }: { initial: EditorRow; clientName: string | null; mode: EditorMode; token?: string; mini?: boolean; premium?: boolean }) {
  const [tab, setTab] = useState<"insights" | "edit">(mini ? "edit" : "insights");
  return (
    <div className="space-y-4">
      <div className="d-seg w-fit" role="group" aria-label="Mini link">
        <button type="button" aria-pressed={tab === "insights"} onClick={() => setTab("insights")}>Insights</button>
        <button type="button" aria-pressed={tab === "edit"} onClick={() => setTab("edit")}>Edit page</button>
      </div>
      {tab === "insights" ? <LinkInsights mode={mode} linkId={initial.id} token={token} /> : <LinkEditor initial={initial} clientName={clientName} mode={mode} token={token} mini={mini} premium={premium} />}
    </div>
  );
}
