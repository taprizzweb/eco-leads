import { loadOverview, daysFrom } from "@/lib/admin-data";
import { BillingTable } from "@/components/admin/BillingTable";
import { Empty, PageHead } from "@/components/admin/ui";

export default async function BillingPage() {
  const { clients, pk } = await loadOverview();
  // Renewal calendar: soonest end date first, clients with no end date last.
  const rows = [...clients]
    .sort((a, b) => (a.expires_at ?? "9999").localeCompare(b.expires_at ?? "9999"))
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name, plan: pk.get(c.package_id)?.name ?? c.package_id, price: pk.get(c.package_id)?.price_inr ?? 0, status: c.status, expires_at: c.expires_at, days: daysFrom(c.expires_at) }));
  return (
    <>
      <PageHead title="Billing" sub="Renewal calendar. Mark a client paid to push their end date out 30 days, or pause them: the page then falls back to a plain Google review link." />
      {rows.length === 0 ? <Empty title="No clients yet">Renewals will be listed here, soonest first.</Empty> : <BillingTable rows={rows} />}
    </>
  );
}
