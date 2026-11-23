import { requireSection } from "@/lib/dash";
import { KitchenBoard } from "@/components/pos/KitchenBoard";

export default async function KitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await requireSection(slug, "pos-kitchen");
  const { data } = await sb.from("orders").select("id, order_no, channel, external_ref, table_label, items, note, status, created_at").eq("client_id", client.id).in("status", ["new", "preparing"]).order("created_at", { ascending: true }).limit(100);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Kitchen</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Every order to cook, oldest first. No printing needed. Tap Start cooking, then Ready. The waiter sees Ready at once.</p>
      </div>
      <KitchenBoard clientId={client.id} initial={(data ?? []) as never} />
    </div>
  );
}
