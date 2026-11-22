"use client";

import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { CHANNELS, inr, type Order } from "@/lib/pos";

const RANGES = [["today", "Today"], ["7", "7 days"], ["30", "30 days"]] as const;

export function BillsView({ slug, range, orders }: { slug: string; range: string; orders: Order[] }) {
  const done = orders.filter((o) => o.status === "completed");
  const sales = done.reduce((a, o) => a + Number(o.total), 0);
  const gst = done.reduce((a, o) => a + Number(o.cgst) + Number(o.sgst), 0);
  const by = (c: string) => done.filter((o) => o.channel === c).reduce((a, o) => a + Number(o.total), 0);
  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Bill no", "Order no", "Date", "Channel", "Table", "Guest", "Subtotal", "Extras", "Discount", "CGST", "SGST", "Total", "Payment", "Status"];
    const rows = orders.map((o) => [o.bill_no ?? "", o.order_no, new Date(o.created_at).toLocaleString("en-IN"), o.channel, o.table_label ?? "", o.customer_name ?? "", o.subtotal, o.extras.reduce((a, e) => a + e.amount, 0), o.discount, o.cgst, o.sgst, o.total, o.payment_mode ?? o.payment_status, o.status].map(esc).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `orders-${range}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="d-seg" role="group" aria-label="Period">
          {RANGES.map(([k, l]) => <Link key={k} href={`/pos/${slug}/bills?r=${k}`} aria-current={range === k ? "page" : undefined}>{l}</Link>)}
        </div>
        <button type="button" className="d-btn d-btn-s ml-auto" onClick={csv} disabled={!orders.length}><Download size={15} /> Download CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Sales", inr(sales)], ["Bills", String(done.length)], ["GST collected", inr(gst)], ["Zomato + Swiggy", inr(by("zomato") + by("swiggy"))]].map(([k, v]) => (
          <div key={k} className="d-card p-3.5"><p className="text-xs" style={{ color: "var(--d-muted)" }}>{k}</p><p className="mt-1 text-[22px] font-semibold">{v}</p></div>
        ))}
      </div>
      {orders.length === 0 ? <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>No orders in this period.</div> : (
        <div className="d-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead style={{ color: "var(--d-muted)" }}><tr><th className="p-3">Order</th><th className="p-3">Time</th><th className="p-3">Where</th><th className="p-3">Guest</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t" style={{ borderColor: "var(--d-line)" }}>
                  <td className="p-3 font-semibold">#{o.order_no}{o.bill_no ? <span className="font-normal" style={{ color: "var(--d-muted)" }}> · Bill {o.bill_no}</span> : null}</td>
                  <td className="p-3">{new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="p-3">{o.channel === "dine_in" ? o.table_label ?? "Table" : CHANNELS[o.channel].label}</td>
                  <td className="p-3">{o.customer_name ?? "-"}</td>
                  <td className="p-3 text-right font-semibold">{inr(o.total)}</td>
                  <td className="p-3">{o.status === "completed" ? `Paid · ${o.payment_mode ?? ""}` : o.status}</td>
                  <td className="p-3"><a className="d-btn d-btn-s" href={`/pos/${slug}/print/${o.id}?kind=bill`} target="_blank" rel="noopener" aria-label={`Print bill ${o.order_no}`}><Printer size={14} /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
