"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Minus, Phone, Plus, Printer, Search, Trash2, X, MessageCircle, Radio, Receipt, ChefHat } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { CHANNELS, MANUAL_CHANNELS, REQUEST_LABEL, inr, itemsSubtotal, totals, waLink, type Channel, type Extra, type Line, type MenuItem, type Order, type Request } from "@/lib/pos";

const OPEN = ["new", "preparing", "ready", "served"] as const;
const COLS: { key: (typeof OPEN)[number]; title: string }[] = [
  { key: "new", title: "New" },
  { key: "preparing", title: "Preparing" },
  { key: "ready", title: "Ready" },
  { key: "served", title: "Served · to bill" },
];
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : `${m} min`;
};
const ORDER_COLS = "id, order_no, channel, external_ref, table_label, plate_code, customer_name, customer_phone, items, subtotal, extras, discount, gst_rate, gst_inclusive, cgst, sgst, total, note, status, payment_status, payment_mode, bill_no, created_at, updated_at";

export function LiveBoard({ clientId, slug, accepting: acc0, initialOrders, initialRequests, menu, canBill = true }: {canBill?: boolean;  clientId: string; slug: string; accepting: boolean; initialOrders: Order[]; initialRequests: Request[]; menu: MenuItem[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [orders, setOrders] = useState(initialOrders);
  const [reqs, setReqs] = useState(initialRequests);
  const [live, setLive] = useState(false);
  const [accepting, setAccepting] = useState(acc0);
  const [bill, setBill] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      sb.from("orders").select(ORDER_COLS).eq("client_id", clientId).in("status", [...OPEN]).order("created_at", { ascending: true }).limit(200),
      sb.from("server_calls").select("id, label, kind, note, status, created_at").eq("client_id", clientId).eq("status", "new").order("created_at", { ascending: true }).limit(50),
    ]);
    if (o.data) {
      setOrders(o.data as unknown as Order[]);
    }
    if (r.data) {
      setReqs(r.data as Request[]);
    }
  }, [sb, clientId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) return; timer = setTimeout(() => { timer = null; void load(); }, 150); };
    const ch = sb.channel(`pos-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${clientId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "server_calls", filter: `client_id=eq.${clientId}` }, soon)
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    // Safety net: if the live connection drops (bad Wi-Fi), the screen still refreshes every few seconds.
    const poll = setInterval(() => { if (document.visibilityState === "visible") void load(); tick((n) => n + 1); }, 5000);
    const vis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { sb.removeChannel(ch); clearInterval(poll); document.removeEventListener("visibilitychange", vis); if (timer) clearTimeout(timer); };
  }, [sb, clientId, load]);

  async function setStatus(o: Order, status: Order["status"], extra: Partial<Order> = {}) {
    setOrders((s) => s.map((x) => (x.id === o.id ? { ...x, status, ...extra } : x)).filter((x) => (OPEN as readonly string[]).includes(x.status)));
    const { error } = await sb.from("orders").update({ status, ...extra }).eq("id", o.id);
    if (error) { toast("That did not save. Please try again.", true); void load(); }
  }
  const printOrder = (id: string, kind: "kot" | "bill") => window.open(`/pos/${slug}/print/${id}?kind=${kind}`, "_blank");
  async function accept(o: Order) { await setStatus(o, "preparing"); printOrder(o.id, "kot"); }
  async function reject(o: Order) { if (!window.confirm(`Cancel order #${o.order_no}?`)) return; await setStatus(o, "cancelled"); toast(`Order #${o.order_no} cancelled`); }
  async function doneReq(r: Request) {
    setReqs((s) => s.filter((x) => x.id !== r.id));
    const { error } = await sb.from("server_calls").update({ status: "done", done_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast("That did not save. Please try again.", true); void load(); }
  }
  async function toggleAccepting() {
    const v = !accepting; setAccepting(v);
    const { error } = await sb.from("pos_settings").upsert({ client_id: clientId, accepting: v }, { onConflict: "client_id" });
    if (error) { setAccepting(!v); return toast("That did not save. Please try again.", true); }
    toast(v ? "Taking orders" : "Orders paused: guests see a polite message");
  }

  const billOrder = orders.find((o) => o.id === bill) ?? null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="d-chip" style={{ ["--c" as string]: live ? "var(--d-green)" : "var(--d-muted)" }}><Radio size={12} /> {live ? "Live" : "Connecting (auto refresh on)"}</span>
        <button type="button" className="d-btn d-btn-s" aria-pressed={accepting} onClick={toggleAccepting}>{accepting ? "Taking orders" : "Orders paused"}</button>
        <button type="button" className="d-btn d-btn-p ml-auto" onClick={() => setManual(true)}><Plus size={15} /> New order</button>
      </div>

      {reqs.length > 0 && (
        <section aria-label="Table requests" aria-live="polite" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reqs.map((r) => (
            <div key={r.id} className="d-card flex items-center gap-3 p-3" style={{ boxShadow: "inset 0 0 0 1.5px var(--d-red)" }}>
              <BellRing size={20} style={{ color: "var(--d-red)" }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.label ?? "A table"} · {REQUEST_LABEL[r.kind]}</p>
                <p className="truncate text-xs" style={{ color: "var(--d-muted)" }}>{ago(r.created_at)}{r.note ? ` · ${r.note}` : ""}</p>
              </div>
              <button type="button" className="d-btn d-btn-p" onClick={() => doneReq(r)}><Check size={15} /> Done</button>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.status === c.key);
          return (
            <section key={c.key} aria-label={c.title} className="min-w-0">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--d-muted)" }}>{c.title}<span className="d-chip" style={{ ["--c" as string]: c.key === "new" && list.length ? "var(--d-red)" : "var(--d-muted)" }}>{list.length}</span></h2>
              <div className="space-y-3">
                {list.length === 0 && <div className="d-card px-4 py-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>{c.key === "new" ? "Waiting for the next order" : "Nothing here"}</div>}
                {list.map((o) => (
                  <OrderCard canBill={canBill} key={o.id} o={o} onAccept={() => accept(o)} onReject={() => reject(o)} onReady={() => setStatus(o, "ready")} onServed={() => setStatus(o, "served")} onBill={() => setBill(o.id)} onKot={() => printOrder(o.id, "kot")} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {billOrder && <BillEditor key={billOrder.id} order={billOrder} slug={slug} onClose={() => setBill(null)} onSaved={() => void load()} onClosed={() => { setBill(null); setOrders((s) => s.filter((x) => x.id !== billOrder.id)); }} />}
      {manual && <ManualOrder clientId={clientId} slug={slug} menu={menu} onClose={() => setManual(false)} onCreated={() => { setManual(false); void load(); }} />}
    </div>
  );
}

function OrderCard({ canBill, o, onAccept, onReject, onReady, onServed, onBill, onKot }: { canBill: boolean; o: Order; onAccept: () => void; onReject: () => void; onReady: () => void; onServed: () => void; onBill: () => void; onKot: () => void }) {
  const ch = CHANNELS[o.channel];
  const where = o.channel === "dine_in" ? o.table_label ?? "Table" : ch.label;
  return (
    <article className="d-card p-3.5" style={o.status === "new" ? { boxShadow: "inset 0 0 0 1.5px var(--d-green)" } : undefined}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[17px] font-semibold">#{o.order_no} · {where}
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase" style={{ background: ch.color }}>{ch.label}</span>
          </p>
          <p className="truncate text-xs" style={{ color: "var(--d-muted)" }}>
            {ago(o.created_at)}{o.external_ref ? ` · ${o.external_ref}` : ""}{o.customer_name ? ` · ${o.customer_name}` : ""}
          </p>
        </div>
        <p className="text-[17px] font-semibold">{inr(o.total)}</p>
      </header>
      <ul className="mt-2.5 space-y-1 text-sm">
        {o.items.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm" style={{ background: l.veg === false ? "#dc2626" : "#16a34a" }} aria-label={l.veg === false ? "Non veg" : "Veg"} />
            <span className="min-w-0 flex-1">{l.qty} × {l.name}{l.addons?.length ? <span style={{ color: "var(--d-muted)" }}> ({l.addons.map((a) => a.name).join(", ")})</span> : null}{l.note ? <em style={{ color: "var(--d-muted)" }}> · {l.note}</em> : null}</span>
          </li>
        ))}
      </ul>
      {o.note && <p className="mt-2 rounded-lg px-2.5 py-1.5 text-sm" style={{ background: "color-mix(in srgb, var(--d-yellow, #eab308) 18%, transparent)" }}>Note: {o.note}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {o.status === "new" && (<>
          <button type="button" className="d-btn d-btn-p" onClick={onAccept}><ChefHat size={15} /> Accept + KOT</button>
          <button type="button" className="d-btn d-btn-s" onClick={onReject}><X size={15} /> Cancel</button>
        </>)}
        {o.status === "preparing" && <button type="button" className="d-btn d-btn-p" onClick={onReady}><Check size={15} /> Mark ready</button>}
        {o.status === "ready" && <button type="button" className="d-btn d-btn-p" onClick={onServed}><Check size={15} /> Served</button>}
        {canBill && (o.status === "served" || o.status === "ready" || o.status === "preparing") && <button type="button" className={o.status === "served" ? "d-btn d-btn-p" : "d-btn d-btn-s"} onClick={onBill}><Receipt size={15} /> Bill</button>}
        <button type="button" className="d-btn d-btn-s" onClick={onKot} aria-label="Print KOT" title="Print KOT"><Printer size={15} /> KOT</button>
        {o.customer_phone && (<>
          <a className="d-btn d-btn-s" href={`tel:+${o.customer_phone}`} aria-label="Call guest"><Phone size={15} /></a>
          <a className="d-btn d-btn-s" href={waLink(o.customer_phone, `Hi ${o.customer_name ?? ""}, about your order #${o.order_no}: `)} target="_blank" rel="noopener" aria-label="WhatsApp the guest"><MessageCircle size={15} /></a>
        </>)}
      </div>
    </article>
  );
}

// Change the lines, add extras (packing, service...), give a discount, see GST worked out, print and take payment.
function BillEditor({ order, slug, onClose, onSaved, onClosed }: { order: Order; slug: string; onClose: () => void; onSaved: () => void; onClosed: () => void }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [items, setItems] = useState<Line[]>(order.items);
  const [extras, setExtras] = useState<Extra[]>(order.extras ?? []);
  const [discount, setDiscount] = useState(String(order.discount || ""));
  const [busy, setBusy] = useState(false);
  const [cn, setCn] = useState(""); const [cp, setCp] = useState("");
  const t = totals(itemsSubtotal(items), extras, Number(discount) || 0, order.gst_rate, order.gst_inclusive);

  const setQty = (i: number, d: number) => setItems((s) => s.map((l, n) => (n === i ? { ...l, qty: Math.max(1, Math.min(99, l.qty + d)) } : l)));
  const setPrice = (i: number, v: string) => setItems((s) => s.map((l, n) => (n === i ? { ...l, unit: Math.max(0, Number(v) || 0) } : l)));

  async function save(): Promise<boolean> {
    if (items.length === 0) { toast("A bill needs at least one item", true); return false; }
    const a = await sb.rpc("pos_set_items", { p_order: order.id, p_items: items });
    const b = await sb.rpc("pos_set_extras", { p_order: order.id, p_extras: extras.filter((e) => e.name.trim() && e.amount > 0), p_discount: Number(discount) || 0 });
    if (a.error || b.error) { toast("That did not save. Please try again.", true); return false; }
    onSaved();
    return true;
  }
  async function printBill() {
    setBusy(true);
    if (await save()) {
      const { error } = await sb.rpc("pos_bill_no", { p_order: order.id });
      if (error) toast("Could not number the bill", true); else window.open(`/pos/${slug}/print/${order.id}?kind=bill`, "_blank");
    }
    setBusy(false);
  }
  async function pay(mode: string) {
    setBusy(true);
    if (await save()) {
      await sb.rpc("pos_bill_no", { p_order: order.id });
      const { error } = await sb.from("orders").update({ payment_status: "paid", payment_mode: mode, status: "completed", ...(cn ? { customer_name: cn } : {}), ...(cp ? { customer_phone: cp.replace(/\D/g, "") } : {}) }).eq("id", order.id);
      if (error) toast("That did not save. Please try again.", true);
      else { toast(`Paid by ${mode}. Order closed.`); onClosed(); }
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Bill for order ${order.order_no}`}>
      <div className="d-card max-h-[94dvh] w-full max-w-xl overflow-y-auto p-4 sm:p-5" style={{ background: "var(--d-bg)" }}>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Bill · #{order.order_no} {order.table_label ?? CHANNELS[order.channel].label}</h2>
          <button type="button" className="d-btn d-btn-s ml-auto" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <ul className="mt-3 space-y-2">
          {items.map((l, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.name}{l.addons?.length ? ` (+${l.addons.map((a) => a.name).join(", ")})` : ""}</span>
              <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setQty(i, -1)} aria-label={`Less ${l.name}`}><Minus size={14} /></button>
              <span className="w-6 text-center font-semibold">{l.qty}</span>
              <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setQty(i, 1)} aria-label={`More ${l.name}`}><Plus size={14} /></button>
              <input aria-label={`Price of ${l.name}`} inputMode="decimal" className="d-input w-20 rounded-lg px-2 py-1.5 text-right" value={l.unit} onChange={(e) => setPrice(i, e.target.value)} />
              <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setItems((s) => s.filter((_, n) => n !== i))} aria-label={`Remove ${l.name}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <AddLine onAdd={(l) => setItems((s) => [...s, l])} />

        <h3 className="mt-5 mb-1.5 text-sm font-semibold" style={{ color: "var(--d-muted)" }}>Extra charges</h3>
        {extras.map((e, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input aria-label="Charge name" className="d-input min-w-0 flex-1 rounded-lg px-2.5 py-2" value={e.name} onChange={(ev) => setExtras((s) => s.map((x, n) => (n === i ? { ...x, name: ev.target.value } : x)))} />
            <input aria-label="Amount" inputMode="decimal" className="d-input w-24 rounded-lg px-2.5 py-2 text-right" value={e.amount || ""} onChange={(ev) => setExtras((s) => s.map((x, n) => (n === i ? { ...x, amount: Math.max(0, Number(ev.target.value) || 0) } : x)))} />
            <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setExtras((s) => s.filter((_, n) => n !== i))} aria-label="Remove charge"><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {["Packing", "Service charge", "Delivery", "Add-on"].map((n) => <button key={n} type="button" className="d-btn d-btn-s" onClick={() => setExtras((s) => [...s, { name: n, amount: 0 }])}><Plus size={13} /> {n}</button>)}
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm">Discount (₹)
          <input inputMode="decimal" className="d-input w-28 rounded-lg px-2.5 py-2 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>

        <dl className="mt-5 space-y-1 text-sm">
          <Row k="Items" v={inr(itemsSubtotal(items))} />
          {extras.filter((e) => e.amount > 0).map((e, i) => <Row key={i} k={e.name} v={inr(e.amount)} />)}
          {(Number(discount) || 0) > 0 && <Row k="Discount" v={`− ${inr(Number(discount))}`} />}
          {order.gst_inclusive && <Row k="Taxable value" v={inr(t.taxable)} />}
          <Row k={`CGST ${order.gst_rate / 2}%`} v={inr(t.cgst)} />
          <Row k={`SGST ${order.gst_rate / 2}%`} v={inr(t.sgst)} />
          <div className="flex justify-between border-t pt-2 text-[20px] font-bold" style={{ borderColor: "var(--d-line)" }}><dt>Total</dt><dd>{inr(t.total)}</dd></div>
          {order.gst_inclusive && <p className="text-xs" style={{ color: "var(--d-muted)" }}>Prices include GST.</p>}
        </dl>

        {!order.customer_phone && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input aria-label="Guest name" placeholder="Guest name (optional)" className="d-input rounded-lg px-2.5 py-2" value={cn} onChange={(e) => setCn(e.target.value)} />
            <input aria-label="Guest mobile" placeholder="Mobile (optional)" inputMode="tel" className="d-input rounded-lg px-2.5 py-2" value={cp} onChange={(e) => setCp(e.target.value)} />
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" disabled={busy} className="d-btn d-btn-s" onClick={printBill}><Printer size={15} /> Print bill</button>
          {["Cash", "UPI", "Card"].map((m) => <button key={m} type="button" disabled={busy} className="d-btn d-btn-p" onClick={() => pay(m)}>Paid · {m}</button>)}
        </div>
        <button type="button" disabled={busy} className="d-btn d-btn-s mt-2 w-full" onClick={async () => { if (await save()) { toast("Bill saved"); onClose(); } }}>Save changes</button>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><dt style={{ color: "var(--d-muted)" }}>{k}</dt><dd>{v}</dd></div>;

function AddLine({ onAdd }: { onAdd: (l: Line) => void }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const add = () => { const p = Number(price); if (!name.trim() || !(p >= 0) || price === "") return; onAdd({ name: name.trim(), qty: 1, price: p, unit: p, veg: true, addons: [] }); setName(""); setPrice(""); };
  return (
    <div className="mt-3 flex items-center gap-2">
      <input aria-label="Add an item" placeholder="Add an item" className="d-input min-w-0 flex-1 rounded-lg px-2.5 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      <input aria-label="Price" placeholder="₹" inputMode="decimal" className="d-input w-20 rounded-lg px-2.5 py-2 text-right" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <button type="button" className="d-btn d-btn-s" onClick={add}><Plus size={14} /> Add</button>
    </div>
  );
}

// An order that did not come from the table QR: counter, phone, Zomato, Swiggy.
function ManualOrder({ clientId, menu, onClose, onCreated }: { clientId: string; slug: string; menu: MenuItem[]; onClose: () => void; onCreated: () => void }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [channel, setChannel] = useState<Channel>("dine_in");
  const [table, setTable] = useState(""); const ref = ""; const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const shown = menu.filter((m) => m.available && m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const add = (m: MenuItem) => setLines((s) => { const i = s.findIndex((l) => l.item_id === m.id); return i >= 0 ? s.map((l, n) => (n === i ? { ...l, qty: l.qty + 1 } : l)) : [...s, { item_id: m.id, name: m.name, veg: m.veg, qty: 1, price: m.price, unit: m.price }]; });
  async function create() {
    if (!lines.length) return toast("Add at least one item", true);
    setBusy(true);
    const { error } = await sb.rpc("pos_create_order", { p_client: clientId, p_channel: channel, p_table: table, p_name: name, p_phone: phone, p_ref: ref, p_note: note, p_lines: lines.map((l) => ({ item_id: l.item_id ?? null, name: l.name, veg: l.veg, qty: l.qty, price: l.unit })) });
    setBusy(false);
    if (error) return toast(error.message || "That did not save. Please try again.", true);
    toast("Order added"); onCreated();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="New order">
      <div className="d-card max-h-[94dvh] w-full max-w-2xl overflow-y-auto p-4 sm:p-5" style={{ background: "var(--d-bg)" }}>
        <div className="flex items-center"><h2 className="text-lg font-semibold">New order</h2><button type="button" className="d-btn d-btn-s ml-auto" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="d-seg mt-3 flex-wrap" role="group" aria-label="Where is it from">
          {MANUAL_CHANNELS.map((c) => <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}>{CHANNELS[c].label}</button>)}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {channel === "dine_in" && <input aria-label="Table" placeholder="Table (for example Table 4)" className="d-input rounded-lg px-2.5 py-2" value={table} onChange={(e) => setTable(e.target.value)} />}
          <input aria-label="Guest name" placeholder="Guest name (optional)" className="d-input rounded-lg px-2.5 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Guest mobile" placeholder="Mobile (optional)" inputMode="tel" className="d-input rounded-lg px-2.5 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="relative mt-3">
          <Search size={15} className="absolute top-3 left-3" style={{ color: "var(--d-muted)" }} />
          <input aria-label="Search menu" placeholder="Search your menu" className="d-input w-full rounded-lg py-2 pr-2.5 pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {shown.map((m) => <button key={m.id} type="button" className="d-btn d-btn-s" onClick={() => add(m)}>{m.name} · {inr(m.price)}</button>)}
          {menu.length === 0 && <p className="text-sm" style={{ color: "var(--d-muted)" }}>Your menu is empty. Add a custom item below, or build your menu in the Menu tab.</p>}
        </div>
        <ul className="mt-3 space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setLines((s) => s.flatMap((x, n) => (n === i ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))} aria-label={`Less ${l.name}`}><Minus size={14} /></button>
              <span className="w-6 text-center font-semibold">{l.qty}</span>
              <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setLines((s) => s.map((x, n) => (n === i ? { ...x, qty: x.qty + 1 } : x)))} aria-label={`More ${l.name}`}><Plus size={14} /></button>
              <span className="w-16 text-right">{inr(l.unit * l.qty)}</span>
            </li>
          ))}
        </ul>
        <AddLine onAdd={(l) => setLines((s) => [...s, l])} />
        <input aria-label="Note" placeholder="Note for the kitchen (optional)" className="d-input mt-3 w-full rounded-lg px-2.5 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" disabled={busy} className="d-btn d-btn-p mt-4 w-full" onClick={create}>Add order · {inr(itemsSubtotal(lines))} + GST</button>
      </div>
    </div>
  );
}
