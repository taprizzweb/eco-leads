// Shared bits of the food-ordering system: types, money, labels. The server (pos_totals) is the source of truth for bills;
// totals() here mirrors it so the screen can show the result before saving.
export type Line = { item_id?: string | null; name: string; veg?: boolean; qty: number; price: number; unit: number; addons?: { name: string; price: number }[]; note?: string };
export type Extra = { name: string; amount: number };
export type Channel = "dine_in" | "takeaway" | "zomato" | "swiggy" | "other";
export type Status = "new" | "preparing" | "ready" | "served" | "completed" | "cancelled";

export type Order = {
  id: string; order_no: number; channel: Channel; external_ref: string | null; table_label: string | null; plate_code: string | null;
  customer_name: string | null; customer_phone: string | null; items: Line[]; subtotal: number; extras: Extra[]; discount: number;
  gst_rate: number; gst_inclusive: boolean; cgst: number; sgst: number; total: number; note: string | null; status: Status;
  payment_status: "unpaid" | "paid"; payment_mode: string | null; bill_no: number | null; created_at: string; updated_at: string;
};
export type Request = { id: string; label: string | null; kind: "waiter" | "bill" | "clean" | "other"; note: string | null; status: "new" | "done"; created_at: string };
export type MenuCat = { id: string; name: string; sort: number; active: boolean };
export type MenuItem = { id: string; category_id: string | null; name: string; description: string | null; price: number; veg: boolean; image_url: string | null; available: boolean; bestseller: boolean; addons: { name: string; price: number }[]; sort: number };
export type PosSettings = {
  client_id: string; accepting: boolean; gst_rate: number; gst_inclusive: boolean; gstin: string | null; legal_name: string | null; address: string | null; bill_footer: string | null;
  geo_lat: number | null; geo_lng: number | null; geo_radius_m: number; geo_required: boolean;
};

export const CHANNELS: Record<Channel, { label: string; color: string }> = {
  dine_in: { label: "Table", color: "#16a34a" },
  takeaway: { label: "Takeaway", color: "#0ea5e9" },
  zomato: { label: "Zomato", color: "#e23744" },
  swiggy: { label: "Swiggy", color: "#fc8019" },
  other: { label: "Other", color: "#8b5cf6" },
};
export const REQUEST_LABEL: Record<Request["kind"], string> = { waiter: "Call waiter", bill: "Wants the bill", clean: "Clean the table", other: "Needs help" };

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
export const inr = (v: number | string) => `₹${num(v).toLocaleString("en-IN", { minimumFractionDigits: num(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function totals(subtotal: number, extras: Extra[], discount: number, rate: number, inclusive: boolean) {
  const ex = extras.reduce((a, e) => a + Math.max(0, num(e.amount)), 0);
  const gross = Math.max(0, subtotal + ex - Math.max(0, discount));
  let taxable = gross, gst: number, total: number;
  if (inclusive) { taxable = r2(gross / (1 + rate / 100)); gst = r2(gross - taxable); total = gross; }
  else { gst = r2((gross * rate) / 100); total = r2(gross + gst); }
  const cgst = r2(gst / 2);
  return { extras_total: ex, taxable, gst, cgst, sgst: r2(gst - cgst), total };
}
export const itemsSubtotal = (items: Line[]) => r2(items.reduce((a, l) => a + num(l.unit) * num(l.qty), 0));
export const waLink = (phone: string, text?: string) => `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Short two-tone beep for new orders, requests and chat. Browsers allow sound only after the owner has tapped the page once. */
export function beep(kind: "order" | "request" | "chat" = "order") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "order" ? [880, 1175, 880] : kind === "request" ? [660, 660] : [990];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t); o.stop(t + 0.21);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sound is a nice extra, the screen still updates */ }
}
