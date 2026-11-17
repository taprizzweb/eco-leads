import Link from "next/link";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { loadAlerts, loadOverview, daysFrom } from "@/lib/admin-data";
import { A, Empty, Expiry, PageHead, Pill, Row, Stat, TableWrap, inr, td, th } from "@/components/admin/ui";

export default async function Overview() {
  const { clients, stats, pk } = await loadOverview();
  const alerts = await loadAlerts();
  const active = clients.filter((c) => c.status === "active");
  const sum = (f: (s: ReturnType<typeof stats.get> & object) => number) => [...stats.values()].reduce((a, s) => a + f(s), 0);
  // Money due this month: active clients whose plan ends by the end of this month (or already ended and not renewed).
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const due = active.filter((c) => c.expires_at && new Date(c.expires_at + "T23:59:59+05:30") <= monthEnd);
  const dueTotal = due.reduce((a, c) => a + (pk.get(c.package_id)?.price_inr ?? 0), 0);
  const recent = [...clients].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <>
      <PageHead title="Overview" sub="Everything across all clients, right now.">
        <Link href="/admin/clients/new" className="d-btn d-btn-p">Add client</Link>
      </PageHead>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Active clients" value={active.length} tone="var(--d-green)" sub={clients.length - active.length ? `${clients.length - active.length} paused` : undefined} />
        <Stat label="Plates live" value={sum((s) => s.plates)} tone="var(--d-blue)" />
        <Stat label="Reviews sent to Google" value={sum((s) => s.reviews_month)} tone="var(--d-amber)" sub="this month" />
        <Stat label="Open complaints" value={sum((s) => s.open_complaints)} tone="var(--d-red)" sub="across all clients" />
        <Stat label="Money due this month" value={inr(dueTotal)} tone="var(--d-green)" sub={`${due.length} renewal${due.length === 1 ? "" : "s"}`} />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-5">
        <section className="d-card p-5 xl:col-span-3" aria-labelledby="att">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="att" className="font-semibold">Needs attention</h2>
            <Link href="/admin/alerts" className="flex min-h-11 items-center gap-1 text-sm" style={{ color: "var(--d-muted)" }}>All alerts <ChevronRight size={14} /></Link>
          </div>
          {alerts.length ? (
            <ul className="space-y-2">
              {alerts.slice(0, 6).map((a) => (
                <li key={a.id} className="d-raise flex items-start gap-3 p-3">
                  <Pill tone={a.level}>{a.level === "red" ? "Urgent" : a.level === "amber" ? "Soon" : "Info"}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]" style={{ color: "var(--d-text)" }}>{a.title}</p>
                    <p className="text-xs" style={{ color: "var(--d-muted)" }}>{a.detail}</p>
                  </div>
                  {a.slug && <Link href={`/admin/clients/${a.slug}`} className="flex min-h-11 items-center text-sm font-medium" style={{ color: "var(--d-text)" }}>Open</Link>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 style={{ color: "var(--d-green)" }} />
              <p className="mt-3 font-medium" style={{ color: "var(--d-text)" }}>Nothing needs you right now</p>
              <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Renewals, late complaints and idle plates show up here.</p>
            </div>
          )}
        </section>

        <section className="xl:col-span-2" aria-labelledby="rec">
          <h2 id="rec" className="mb-3 font-semibold">Newest clients</h2>
          {recent.length ? (
            <TableWrap>
              <thead><tr style={{ color: "var(--d-muted)" }}><th className={th}>Client</th><th className={th}>Plan</th><th className={th}>Ends</th></tr></thead>
              <tbody>
                {recent.map((c) => (
                  <Row key={c.id}>
                    <td className={td}><A href={`/admin/clients/${c.slug}`}>{c.name}</A></td>
                    <td className={td}>{pk.get(c.package_id)?.name ?? c.package_id}</td>
                    <td className={td}><Expiry iso={c.expires_at} days={daysFrom(c.expires_at)} /></td>
                  </Row>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <Empty title="No clients yet">Add your first client. It takes about two minutes.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
