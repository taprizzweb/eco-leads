"use client";

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import type { PosSettings } from "@/lib/pos";

export function PosSettingsForm({ initial }: { initial: PosSettings }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [rate, setRate] = useState(String(initial.gst_rate));
  const [radius, setRadius] = useState(String(initial.geo_radius_m));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PosSettings>(k: K, v: PosSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  function here() {
    if (!navigator.geolocation) return toast("This phone cannot share its location", true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setS((x) => ({ ...x, geo_lat: p.coords.latitude, geo_lng: p.coords.longitude })); toast("Location set to where you are now. Press Save."); },
      () => toast("Please allow location for this page, then try again", true),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function save() {
    const r = Number(rate), m = Number(radius);
    if (!(r >= 0 && r <= 40)) return toast("GST must be between 0 and 40", true);
    if (!(m >= 20 && m <= 5000)) return toast("Distance must be between 20 and 5000 metres", true);
    if (s.geo_required && (s.geo_lat == null || s.geo_lng == null)) return toast("Set your shop location first, or switch the distance check off", true);
    if (s.gstin && !/^[0-9A-Z]{15}$/i.test(s.gstin.trim())) return toast("A GSTIN has 15 letters and numbers", true);
    setBusy(true);
    const { error } = await sb.from("pos_settings").upsert({ ...s, gst_rate: r, geo_radius_m: Math.round(m), gstin: s.gstin?.trim().toUpperCase() || null, legal_name: s.legal_name?.trim() || null, address: s.address?.trim() || null, bill_footer: s.bill_footer?.trim() || null }, { onConflict: "client_id" });
    setBusy(false);
    toast(error ? "That did not save. Please try again." : "Saved", !!error);
  }
  const card = "d-card space-y-3 p-4";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className={card}>
        <h2 className="font-semibold">Orders</h2>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={s.accepting} onChange={(e) => set("accepting", e.target.checked)} /> Taking orders (switch off during a rush or when the kitchen is closed)</label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={s.counter_orders} onChange={(e) => set("counter_orders", e.target.checked)} /> Guests can also order from plates that are not tables, like Counter</label>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Every table plate gets your menu by itself, with its table number. If this is off, a Counter plate shows the menu to look at, but ordering is only from tables.</p>
      </section>
      <section className={card}>
        <h2 className="font-semibold">GST</h2>
        <label className="block text-sm">GST % on the bill (split equally into CGST and SGST)<input className="d-input mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <div className="d-seg" role="group" aria-label="How prices are set">
          <button type="button" aria-pressed={!s.gst_inclusive} onClick={() => set("gst_inclusive", false)}>GST added on top</button>
          <button type="button" aria-pressed={s.gst_inclusive} onClick={() => set("gst_inclusive", true)}>Prices include GST</button>
        </div>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Restaurants usually charge 5%. Check with your accountant. A change applies to new orders; old bills keep the rate they were made with.</p>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Bill details</h2>
        <label className="block text-sm">Business name on the bill<input className="d-input mt-1" value={s.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} /></label>
        <label className="block text-sm">GSTIN<input className="d-input mt-1" value={s.gstin ?? ""} maxLength={15} onChange={(e) => set("gstin", e.target.value)} /></label>
        <label className="block text-sm">Address<textarea className="d-input mt-1" rows={2} value={s.address ?? ""} onChange={(e) => set("address", e.target.value)} /></label>
        <label className="block text-sm">Line at the bottom<input className="d-input mt-1" placeholder="Thank you, visit again!" value={s.bill_footer ?? ""} onChange={(e) => set("bill_footer", e.target.value)} /></label>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Order only from inside the shop</h2>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={s.geo_required} onChange={(e) => set("geo_required", e.target.checked)} /> Guests must be near the shop to place an order</label>
        <button type="button" className="d-btn d-btn-s" onClick={here}><Crosshair size={15} /> Use my current location as the shop</button>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>{s.geo_lat != null ? `Shop location saved (${s.geo_lat.toFixed(4)}, ${s.geo_lng?.toFixed(4)}). Stand inside your shop when you press the button.` : "No shop location yet. Stand inside your shop and press the button."}</p>
        <label className="block text-sm">Allowed distance in metres<input className="d-input mt-1" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Phone GPS inside buildings can be off by 30 to 80 metres, so 150 is a safe start. The guest is asked for location only when they place the order, and it is never stored.</p>
      </section>
      <button type="button" className="d-btn d-btn-p w-full" disabled={busy} onClick={save}>Save settings</button>
    </div>
  );
}
