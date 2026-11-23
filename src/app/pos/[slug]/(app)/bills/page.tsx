import { requireSection } from "@/lib/dash";
import { BillsView } from "@/components/pos/BillsView";
import type { Order } from "@/lib/pos";

export default async function BillsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string }> }) {
  const { slug } = await params;
  const { r } = await searchParams;
  const range = r === "7" || r === "30" ? r : "today";
  const { sb, client } = await requireSection(slug, "pos-bills");
  // "Today" follows the shop's day in India, not the server's clock.
  const ist = new Date(Date.now() + 5.5 * 3600e3);
  const startIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600e3;
  const since = new Date(range === "today" ? startIst : startIst - (Number(range) - 1) * 86400e3).toISOString();
  const { data } = await sb.from("orders").select("id, order_no, channel, external_ref, table_label, plate_code, customer_name, customer_phone, items, subtotal, extras, discount, gst_rate, gst_inclusive, cgst, sgst, total, note, status, payment_status, payment_mode, bill_no, created_at, updated_at")
    .eq("client_id", client.id).gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Bills</h1>
      <BillsView slug={client.slug} range={range} orders={(data ?? []) as unknown as Order[]} />
    </div>
  );
}
