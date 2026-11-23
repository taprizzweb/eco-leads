import { requireSection } from "@/lib/dash";
import { can } from "@/lib/roles";
import { LiveBoard } from "@/components/pos/LiveBoard";
import type { MenuItem, Order, Request } from "@/lib/pos";

export default async function PosHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, role } = await requireSection(slug, "pos");
  const [o, r, s, m] = await Promise.all([
    sb.from("orders").select("id, order_no, channel, external_ref, table_label, plate_code, customer_name, customer_phone, items, subtotal, extras, discount, gst_rate, gst_inclusive, cgst, sgst, total, note, status, payment_status, payment_mode, bill_no, created_at, updated_at").eq("client_id", client.id).in("status", ["new", "preparing", "ready", "served"]).order("created_at", { ascending: true }).limit(200),
    sb.from("server_calls").select("id, label, kind, note, status, created_at").eq("client_id", client.id).eq("status", "new").order("created_at", { ascending: true }).limit(50),
    sb.from("pos_settings").select("accepting").eq("client_id", client.id).maybeSingle(),
    sb.from("menu_items").select("id, category_id, name, description, price, veg, image_url, available, bestseller, addons, sort").eq("client_id", client.id).order("sort").limit(500),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Live orders</h1>
      <LiveBoard canBill={can(role, "pos-bills")} clientId={client.id} slug={client.slug} accepting={s.data?.accepting ?? true} initialOrders={(o.data ?? []) as unknown as Order[]} initialRequests={(r.data ?? []) as Request[]} menu={(m.data ?? []) as unknown as MenuItem[]} />
    </div>
  );
}
