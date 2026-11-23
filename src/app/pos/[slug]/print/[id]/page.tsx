import { notFound } from "next/navigation";
import { requireSection } from "@/lib/dash";
import { CHANNELS, inr, type Order } from "@/lib/pos";
import { AutoPrint } from "@/components/pos/AutoPrint";

export const dynamic = "force-dynamic";

// KOT (kitchen slip) and bill, laid out for an 80 mm thermal printer. Opens, prints, and can be closed.
export default async function PrintPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { slug, id } = await params;
  const { kind } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { sb, client } = await requireSection(slug, kind === "bill" ? "pos-bills" : "pos");
  let { data: o } = await sb.from("orders").select("*").eq("id", id).eq("client_id", client.id).maybeSingle();
  if (!o) notFound();
  const isBill = kind === "bill";
  if (isBill && !o.bill_no) {
    await sb.rpc("pos_bill_no", { p_order: id });
    o = (await sb.from("orders").select("*").eq("id", id).maybeSingle()).data ?? o;
  }
  const order = o as unknown as Order;
  const { data: s } = await sb.from("pos_settings").select("legal_name, gstin, address, bill_footer").eq("client_id", client.id).maybeSingle();
  const when = new Date(order.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const where = order.channel === "dine_in" ? order.table_label ?? "Table" : CHANNELS[order.channel].label;
  const taxable = order.gst_inclusive ? Number(order.total) - Number(order.cgst) - Number(order.sgst) : null;
  return (
    <div className="slip">
      <style>{`@page{size:80mm auto;margin:0}html,body{background:#fff!important;color:#000!important}.slip{width:76mm;margin:0 auto;padding:4mm 2mm;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000;background:#fff}.slip hr{border:0;border-top:1px dashed #000;margin:6px 0}.slip .r{display:flex;justify-content:space-between;gap:8px}.slip .c{text-align:center}.slip .b{font-weight:700}.slip .big{font-size:18px}@media print{.noprint{display:none!important}}`}</style>
      <div className="noprint c" style={{ marginBottom: 8 }}><button type="button" id="print-btn" style={{ padding: "8px 16px", border: "1px solid #000", borderRadius: 6 }}>Print again</button></div>
      <div className="c b big">{isBill ? s?.legal_name || client.name : "KITCHEN ORDER"}</div>
      {isBill && s?.address && <div className="c">{s.address}</div>}
      {isBill && s?.gstin && <div className="c">GSTIN: {s.gstin}</div>}
      <hr />
      <div className="r b"><span>{isBill ? `Bill ${order.bill_no ?? ""}` : "KOT"} · #{order.order_no}</span><span>{where}</span></div>
      <div>{when}</div>
      {order.external_ref && <div>Ref: {order.external_ref}</div>}
      {order.customer_name && <div>Guest: {order.customer_name}</div>}
      <hr />
      {order.items.map((l, i) => (
        <div key={i} style={{ marginBottom: 3 }}>
          <div className="r"><span className={isBill ? "" : "b big"}>{l.qty} × {l.name}</span>{isBill && <span>{inr(l.unit * l.qty)}</span>}</div>
          {l.addons?.length ? <div>&nbsp;&nbsp;+ {l.addons.map((a) => a.name).join(", ")}</div> : null}
          {l.note ? <div>&nbsp;&nbsp;* {l.note}</div> : null}
        </div>
      ))}
      {order.note && <><hr /><div className="b">NOTE: {order.note}</div></>}
      {isBill && (<>
        <hr />
        <div className="r"><span>Items</span><span>{inr(order.subtotal)}</span></div>
        {order.extras.map((e, i) => <div key={i} className="r"><span>{e.name}</span><span>{inr(e.amount)}</span></div>)}
        {Number(order.discount) > 0 && <div className="r"><span>Discount</span><span>- {inr(order.discount)}</span></div>}
        {taxable != null && <div className="r"><span>Taxable value</span><span>{inr(taxable)}</span></div>}
        <div className="r"><span>CGST {Number(order.gst_rate) / 2}%</span><span>{inr(order.cgst)}</span></div>
        <div className="r"><span>SGST {Number(order.gst_rate) / 2}%</span><span>{inr(order.sgst)}</span></div>
        <hr />
        <div className="r b big"><span>TOTAL</span><span>{inr(order.total)}</span></div>
        <div>{order.payment_status === "paid" ? `Paid by ${order.payment_mode ?? ""}` : "Payment pending"}{order.gst_inclusive ? " · prices include GST" : ""}</div>
        <hr />
        <div className="c">{s?.bill_footer || "Thank you, visit again!"}</div>
      </>)}
      <AutoPrint />
    </div>
  );
}
