"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChefHat, Flame, Undo2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { CHANNELS, type Order } from "@/lib/pos";

const COLS = "id, order_no, channel, external_ref, table_label, items, note, status, created_at";
type K = Pick<Order, "id" | "order_no" | "channel" | "external_ref" | "table_label" | "items" | "note" | "status" | "created_at">;
const mins = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

/** What the cooks see: big tickets, oldest first, no prices and no guest details. One tap to start, one tap when it is ready. */
export function KitchenBoard({ clientId, initial }: { clientId: string; initial: K[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [orders, setOrders] = useState(initial);
  const [ready, setReady] = useState<K[]>([]);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      sb.from("orders").select(COLS).eq("client_id", clientId).in("status", ["new", "preparing"]).order("created_at", { ascending: true }).limit(100),
      sb.from("orders").select(COLS).eq("client_id", clientId).eq("status", "ready").gte("updated_at", new Date(Date.now() - 15 * 60000).toISOString()).order("updated_at", { ascending: false }).limit(8),
    ]);
    if (o.data) setOrders(o.data as unknown as K[]);
    if (r.data) setReady(r.data as unknown as K[]);
  }, [sb, clientId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) return; timer = setTimeout(() => { timer = null; void load(); }, 150); };
    void load();
    const ch = sb.channel(`kitchen-${clientId}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${clientId}` }, soon).subscribe();
    const poll = setInterval(() => { if (document.visibilityState === "visible") void load(); tick((n) => n + 1); }, 5000);
    const vis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { sb.removeChannel(ch); clearInterval(poll); document.removeEventListener("visibilitychange", vis); if (timer) clearTimeout(timer); };
  }, [sb, clientId, load]);

  async function move(o: K, status: "preparing" | "ready" | "new") {
    setOrders((s) => s.flatMap((x) => (x.id === o.id ? (status === "ready" ? [] : [{ ...x, status }]) : [x])));
    if (status === "ready") setReady((s) => [{ ...o, status }, ...s].slice(0, 8));
    if (status !== "ready") setReady((s) => s.filter((x) => x.id !== o.id));
    const { error } = await sb.from("orders").update({ status }).eq("id", o.id);
    if (error) { toast("That did not save. Please try again.", true); void load(); }
  }

  const fresh = orders.filter((o) => o.status === "new");
  const cooking = orders.filter((o) => o.status === "preparing");
  const ticket = (o: K) => {
    const m = mins(o.created_at);
    const late = m >= 20 ? "var(--d-red)" : m >= 10 ? "var(--d-amber, #f59e0b)" : "var(--d-green)";
    return (
      <article key={o.id} className="d-card p-4" style={{ boxShadow: `inset 0 0 0 2px ${o.status === "new" ? "var(--d-green)" : "var(--d-line-2)"}` }}>
        <header className="flex items-center gap-2">
          <p className="text-[24px] leading-none font-bold">#{o.order_no} · {o.channel === "dine_in" ? o.table_label ?? "Table" : CHANNELS[o.channel].label}</p>
          <span className="d-chip ml-auto !text-[13px]" style={{ ["--c" as string]: late }}>{m} min</span>
        </header>
        <ul className="mt-3 space-y-2">
          {o.items.map((l, i) => (
            <li key={i} className="flex gap-2.5 text-[19px] leading-snug">
              <span className="mt-2 h-3 w-3 shrink-0 rounded-sm" style={{ background: l.veg === false ? "#dc2626" : "#16a34a" }} aria-label={l.veg === false ? "Non veg" : "Veg"} />
              <span className="min-w-0 flex-1"><b>{l.qty} ×</b> {l.name}{l.addons?.length ? <span className="block text-[15px]" style={{ color: "var(--d-muted)" }}>+ {l.addons.map((a) => a.name).join(", ")}</span> : null}{l.note ? <span className="block text-[15px] font-semibold" style={{ color: "var(--d-amber, #f59e0b)" }}>* {l.note}</span> : null}</span>
            </li>
          ))}
        </ul>
        {o.note && <p className="mt-3 rounded-lg px-3 py-2 text-[16px] font-semibold" style={{ background: "color-mix(in srgb, var(--d-amber, #f59e0b) 20%, transparent)" }}>Note: {o.note}</p>}
        <div className="mt-4">
          {o.status === "new"
            ? <button type="button" className="d-btn d-btn-p !min-h-14 w-full !text-[17px]" onClick={() => move(o, "preparing")}><Flame size={20} /> Start cooking</button>
            : <button type="button" className="d-btn d-btn-p !min-h-14 w-full !text-[17px]" onClick={() => move(o, "ready")}><Check size={20} /> Ready</button>}
        </div>
      </article>
    );
  };
  return (
    <div className="space-y-6">
      {fresh.length === 0 && cooking.length === 0 && (
        <div className="d-card flex flex-col items-center gap-2 px-6 py-16 text-center" style={{ color: "var(--d-muted)" }}><ChefHat size={34} aria-hidden /><p className="text-lg">No order to cook right now.</p><p className="text-sm">New orders appear here by themselves, with a sound.</p></div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="New orders" className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--d-muted)" }}>New <span className="d-chip" style={{ ["--c" as string]: fresh.length ? "var(--d-red)" : "var(--d-muted)" }}>{fresh.length}</span></h2>
          {fresh.map(ticket)}
        </section>
        <section aria-label="Cooking" className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--d-muted)" }}>Cooking <span className="d-chip" style={{ ["--c" as string]: "var(--d-muted)" }}>{cooking.length}</span></h2>
          {cooking.map(ticket)}
        </section>
      </div>
      {ready.length > 0 && (
        <section aria-label="Ready" className="space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--d-muted)" }}>Ready in the last 15 minutes</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ready.map((o) => (
              <li key={o.id} className="d-card flex items-center gap-3 p-3"><span className="font-semibold">#{o.order_no} · {o.channel === "dine_in" ? o.table_label ?? "Table" : CHANNELS[o.channel].label}</span><button type="button" className="d-btn d-btn-s ml-auto" onClick={() => move(o, "preparing")}><Undo2 size={14} /> Back to cooking</button></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
