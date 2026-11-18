import Link from "next/link";
import { loadGroup, groupOverview, groupBranches } from "@/lib/group";
import { Stat, Pill } from "@/components/admin/ui";

const PERIODS = [{ d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 90, l: "90 days" }];

export default async function GroupHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ days?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const days = PERIODS.some((p) => String(p.d) === sp.days) ? Number(sp.days) : 30;
  const { sb, group } = await loadGroup(slug);
  const [o, busiest, attention] = await Promise.all([
    groupOverview(sb, group, days),
    groupBranches(sb, group, { days, search: "", sort: "taps", page: 0, size: 5 }),
    groupBranches(sb, group, { days, search: "", sort: "feedback", page: 0, size: 5 }),
  ]);
  const n = (v: number | null | undefined) => (v == null ? "n/a" : v.toLocaleString("en-IN"));
  const needs = attention.rows.filter((r) => r.feedback_open > 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">All branches</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--d-muted)" }}>{o.branches} {o.branches === 1 ? "branch" : "branches"} of {group.name}, together.</p>
        </div>
        <div className="d-seg" role="group" aria-label="Period">
          {PERIODS.map((p) => <Link key={p.d} href={`/group/${group.slug}?days=${p.d}`} aria-pressed={p.d === days}>{p.l}</Link>)}
        </div>
      </div>

      {o.branches === 0 ? (
        <div className="d-card p-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>No branches are linked to this chain yet. Ask Taprizz to add them.</div>
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Guest taps" value={n(o.taps)} tone="var(--d-blue)" sub={`last ${days} days`} />
            <Stat label="Reviews written" value={n(o.drafts)} tone="var(--d-green)" sub={`${n(o.copied)} copied to Google`} />
            <Stat label="Open complaints" value={n(o.feedback_open)} tone="var(--d-red)" sub="waiting for a reply" />
            <Stat label={o.approx ? "Customer records" : "Unique customers"} value={n(o.customers)} tone="var(--d-amber)" sub={o.whatsapp_ready == null ? "across all branches" : `${n(o.whatsapp_ready)} can get WhatsApp offers`} />
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="d-card p-5" aria-labelledby="busy">
              <h2 id="busy" className="font-semibold">Busiest branches</h2>
              <ul className="mt-3 divide-y" style={{ borderColor: "var(--d-line)" }}>
                {busiest.rows.map((r) => (
                  <li key={r.client_id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Link href={`/dashboard/${r.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline" style={{ color: "var(--d-text)" }}>{r.name}</Link>
                    <span className="tabular-nums" style={{ color: "var(--d-muted)" }}>{n(r.taps)} taps</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="d-card p-5" aria-labelledby="att">
              <h2 id="att" className="font-semibold">Needs attention</h2>
              {needs.length === 0 ? <p className="mt-3 text-sm" style={{ color: "var(--d-muted)" }}>No open complaints in any branch.</p> : (
                <ul className="mt-3 divide-y" style={{ borderColor: "var(--d-line)" }}>
                  {needs.map((r) => (
                    <li key={r.client_id} className="flex items-center gap-3 py-2.5 text-sm">
                      <Link href={`/dashboard/${r.slug}/inbox`} className="min-w-0 flex-1 truncate font-medium hover:underline" style={{ color: "var(--d-text)" }}>{r.name}</Link>
                      <Pill tone="red">{r.feedback_open} open</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          {o.approx && <p className="text-xs" style={{ color: "var(--d-muted)" }}>Customer numbers add up the records of each branch. Once the group totals are switched on, one person who visited two branches is counted once.</p>}
        </>
      )}
    </div>
  );
}
