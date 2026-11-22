"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellRing, Check, ChevronRight, Loader2, MessageCircle, Minus, Plus, Search, Send, ShoppingBag, Star } from "lucide-react";
import type { GuestPageData } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadVisitor, saveVisitor, type Visitor } from "@/lib/visitor";
import { useExitPrompt } from "@/lib/sheet-back";
import { inr, totals } from "@/lib/pos";
import { Sheet } from "@/components/guest/Sheet";
import { ReviewFlow } from "@/components/guest/ReviewFlow";
import { FeedbackForm } from "@/components/guest/FeedbackForm";
import { glassInput, pillPrimary, pillSoft } from "@/components/guest/ui";

type Addon = { name: string; price: number };
type Item = { id: string; category_id: string | null; name: string; description: string | null; price: number; veg: boolean; image_url: string | null; available: boolean; addons: Addon[]; bestseller: boolean };
export type MenuData = {
  accepting: boolean; gst_rate: number; gst_inclusive: boolean;
  geo: { required: boolean; lat: number | null; lng: number | null; radius: number };
  categories: { id: string; name: string }[]; items: Item[];
};
type Line = { key: string; item: Item; addons: Addon[]; qty: number; note: string };
type Placed = { id: string; token: string; order_no: number; total: number; ts: number };
type Status = "new" | "preparing" | "ready" | "served" | "completed" | "cancelled";

const STEPS: { key: Status; label: string }[] = [{ key: "new", label: "Received" }, { key: "preparing", label: "Preparing" }, { key: "ready", label: "Ready" }, { key: "served", label: "Served" }];
const unit = (l: { item: Item; addons: Addon[] }) => l.item.price + l.addons.reduce((a, x) => a + x.price, 0);
const MAX_AGAIN = 2;   // after the first time, the stars come back on Back this many times

export function MenuApp({ data, menu, code }: { data: GuestPageData; menu: MenuData; code: string }) {
  const { client, plate } = data;
  const theme = getTheme(client.theme);
  const sb = useMemo(() => supabaseBrowser(), []);
  const tableLabel = plate?.label ?? "your table";
  const orderKey = `tz_order_${client.id}`;
  const reviewedKey = `tz_reviewed_${client.id}`;

  const [q, setQ] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Line[]>([]);
  const [pick, setPick] = useState<Item | null>(null);          // add-on sheet
  const [cartOpen, setCartOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [chat, setChat] = useState(false);
  const [stars, setStars] = useState(false);
  const [complaint, setComplaint] = useState(false);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [status, setStatus] = useState<Status>("new");
  const [activeCat, setActiveCat] = useState<string>("");
  const [rearm, setRearm] = useState(0);
  const [armed, setArmed] = useState(false);
  const againUsed = useRef(0);
  const viaBack = useRef(false);

  useEffect(() => {
    setVisitor(loadVisitor(client.id));
    try {
      const raw = JSON.parse(localStorage.getItem(orderKey) ?? "null") as Placed | null;
      if (raw && Date.now() - raw.ts < 4 * 3600e3) setPlaced(raw);
    } catch { /* no earlier order */ }
  }, [client.id, orderKey]);

  // ---- menu
  const shown = useMemo(() => menu.items.filter((i) => (!vegOnly || i.veg) && (!q.trim() || (i.name + " " + (i.description ?? "")).toLowerCase().includes(q.trim().toLowerCase()))), [menu.items, vegOnly, q]);
  const sections = useMemo(() => {
    const s: { id: string; name: string; items: Item[] }[] = [];
    for (const c of menu.categories) { const items = shown.filter((i) => i.category_id === c.id); if (items.length) s.push({ id: c.id, name: c.name, items }); }
    const loose = shown.filter((i) => !i.category_id || !menu.categories.some((c) => c.id === i.category_id));
    if (loose.length) s.push({ id: "other", name: menu.categories.length ? "More" : "Menu", items: loose });
    return s;
  }, [shown, menu.categories]);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActiveCat(v.target.id.replace("sec-", "")); }, { rootMargin: "-120px 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  // ---- cart
  const qtyOf = (id: string) => cart.filter((l) => l.item.id === id).reduce((a, l) => a + l.qty, 0);
  const keyOf = (item: Item, addons: Addon[]) => `${item.id}|${addons.map((a) => a.name).sort().join("+")}`;
  const addLine = (item: Item, addons: Addon[] = [], note = "") => setCart((s) => {
    const key = keyOf(item, addons);
    return s.some((l) => l.key === key) ? s.map((l) => (l.key === key ? { ...l, qty: Math.min(50, l.qty + 1) } : l)) : [...s, { key, item, addons, qty: 1, note }];
  });
  const bump = (key: string, d: number) => setCart((s) => s.flatMap((l) => (l.key === key ? (l.qty + d <= 0 ? [] : [{ ...l, qty: Math.min(50, l.qty + d) }]) : [l])));
  const minusItem = (id: string) => setCart((s) => { const i = [...s].reverse().findIndex((l) => l.item.id === id); if (i < 0) return s; const idx = s.length - 1 - i; return s.flatMap((l, n) => (n === idx ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])); });
  const onAdd = (item: Item) => (item.addons.length ? setPick(item) : addLine(item));
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const sub = cart.reduce((a, l) => a + unit(l) * l.qty, 0);
  const bill = totals(sub, [], 0, menu.gst_rate, menu.gst_inclusive);

  // ---- order status (the guest sees the kitchen moving)
  useEffect(() => {
    if (!placed) return;
    let stop = false;
    const tick = async () => {
      const { data: s } = await sb.rpc("guest_order_status", { p_order: placed.id, p_token: placed.token });
      if (!stop && s && typeof s === "object" && "status" in s) setStatus((s as { status: Status }).status);
    };
    void tick();
    const t = setInterval(() => { if (document.visibilityState === "visible") void tick(); }, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [placed, sb]);

  // ---- after ordering: thank-you, then the stars open by themselves; Back brings them again, twice at most
  const reviewable = data.live && !!data.features.review && !!client.google_review_url;
  const reviewed = () => { try { return !!localStorage.getItem(reviewedKey); } catch { return false; } };
  const justPlaced = useRef(false);
  useEffect(() => {
    if (!placed || !justPlaced.current) return;
    justPlaced.current = false;
    const t1 = setTimeout(() => setArmed(true), 600);
    const t2 = setTimeout(() => { if (reviewable && !reviewed()) setStars(true); }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed]);
  useEffect(() => { if (placed && !justPlaced.current) setArmed(true); }, [placed]);
  useExitPrompt(armed && reviewable, () => {
    if (reviewed() || againUsed.current >= MAX_AGAIN) { window.history.back(); return; }
    againUsed.current += 1;
    viaBack.current = true;
    setStars(true);
  }, rearm);
  // The first time the stars open by themselves, the Back entry is still there, so nothing is added. After a Back-triggered
  // showing the entry is used up, so it is put back (unless that was the last allowed time).
  const closeStars = useCallback(() => {
    setStars(false);
    if (viaBack.current) { viaBack.current = false; if (againUsed.current < MAX_AGAIN) setTimeout(() => setRearm((n) => n + 1), 400); }
  }, []);

  const request = useCallback(async (kind: "waiter" | "bill" | "clean" | "other", note?: string) => {
    const { error } = await sb.rpc("guest_table_request", { p_client: client.id, p_code: code, p_kind: kind, p_note: note ?? null });
    return !error;
  }, [sb, client.id, code]);

  const css = { ...(theme.vars as React.CSSProperties), background: "var(--bg)" };
  const orderDone = !!placed && count === 0;
  return (
    <div style={css} className="guest-root min-h-dvh text-fg" data-theme={theme.dark ? "dark" : "light"}>
      <main className="mx-auto max-w-md pb-32">
        <header className="sticky top-0 z-30 border-b border-line px-4 pt-3 pb-2.5 backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}>
          <div className="flex items-center gap-3">
            <Link href={`/e/${code}`} aria-label="Back to the page" className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-line" style={{ background: "var(--surface)" }}><ArrowLeft size={19} /></Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[18px] leading-tight font-semibold tracking-[-0.02em]">{client.name}</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{tableLabel}</p>
            </div>
            <button type="button" onClick={() => setHelp(true)} aria-label="Call the staff or chat" className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-line" style={{ background: "var(--surface)" }}><BellRing size={19} /></button>
          </div>
          {!orderDone && (<>
            <div className="mt-3 flex items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search the menu</span>
                <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes" className="min-h-11 w-full rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)] pr-4 pl-10 text-[15px] placeholder:text-muted focus:ring-2 focus:ring-[color-mix(in_srgb,var(--text)_35%,transparent)] focus:outline-none" />
              </label>
              <button type="button" role="switch" aria-checked={vegOnly} onClick={() => setVegOnly((v) => !v)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ring-line" style={{ background: vegOnly ? "color-mix(in srgb, #16a34a 22%, transparent)" : "var(--surface)" }}>
                <span className="grid h-4 w-4 place-items-center rounded-[3px] border-2 border-emerald-500"><span className={`h-2 w-2 rounded-full ${vegOnly ? "bg-emerald-500" : "bg-transparent"}`} /></span>Veg
              </button>
            </div>
            {sections.length > 1 && (
              <nav aria-label="Categories" className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
                {sections.map((s) => (
                  <button key={s.id} type="button" onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className={`min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${activeCat === s.id ? "bg-fg text-bg" : "ring-1 ring-line"}`}>{s.name}</button>
                ))}
              </nav>
            )}
          </>)}
        </header>

        {!menu.accepting && (
          <p role="status" className="mx-4 mt-4 rounded-2xl px-4 py-3 text-sm ring-1 ring-line" style={{ background: "var(--surface)" }}>We are not taking online orders right now. You can still look around the menu, or ask the staff.</p>
        )}

        {orderDone && placed ? (
          <Success placed={placed} status={status} name={visitor?.name} onHelp={() => setHelp(true)} onMore={() => { setPlaced(null); try { localStorage.removeItem(orderKey); } catch {} }} onStars={reviewable ? () => setStars(true) : undefined} request={request} />
        ) : (
          <div className="px-4">
            {placed && <p className="mt-4 rounded-2xl px-4 py-3 text-sm ring-1 ring-line" style={{ background: "var(--surface)" }}>Order #{placed.order_no} is {status === "new" ? "received" : status === "completed" ? "done" : status}. Add more below and send it as a new order.</p>}
            {sections.length === 0 && <p className="py-16 text-center text-muted">{menu.items.length ? "Nothing matches your search." : "The menu is being updated. Please ask the staff."}</p>}
            {sections.map((s) => (
              <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-44 pt-6">
                <h2 className="mb-1 text-[17px] font-semibold tracking-[-0.01em]">{s.name} <span className="text-sm font-normal text-muted">({s.items.length})</span></h2>
                <ul className="divide-y divide-line">
                  {s.items.map((i) => {
                    const n = qtyOf(i.id);
                    return (
                      <li key={i.id} className="flex gap-3 py-4" style={{ opacity: i.available ? 1 : 0.55 }}>
                        <div className="min-w-0 flex-1">
                          <span className="grid h-4 w-4 place-items-center rounded-[3px] border-2" style={{ borderColor: i.veg ? "#16a34a" : "#dc2626" }} aria-label={i.veg ? "Veg" : "Non veg"}><span className="h-2 w-2 rounded-full" style={{ background: i.veg ? "#16a34a" : "#dc2626" }} /></span>
                          <p className="mt-1.5 text-[16px] leading-snug font-semibold">{i.name}{i.bestseller && <Star size={13} className="ml-1.5 inline fill-amber-400 text-amber-400" aria-label="Bestseller" />}</p>
                          <p className="mt-0.5 text-[15px] font-medium">{inr(i.price)}</p>
                          {i.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted">{i.description}</p>}
                        </div>
                        <div className={`relative w-[118px] shrink-0 ${i.image_url ? "" : "flex items-center"}`}>
                          {i.image_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={i.image_url} alt="" loading="lazy" className={`h-[104px] w-[118px] rounded-2xl object-cover ${i.available ? "" : "grayscale"}`} />
                            : null}
                          <div className={i.image_url ? "absolute inset-x-3 -bottom-3" : "w-full px-3"}>
                            {!i.available ? <span className="flex min-h-10 items-center justify-center rounded-xl bg-bg text-[13px] font-semibold text-muted ring-1 ring-line">Sold out</span>
                              : n === 0 ? (
                                <button type="button" onClick={() => onAdd(i)} disabled={!menu.accepting} className="flex min-h-10 w-full items-center justify-center rounded-xl bg-bg text-[14px] font-extrabold tracking-wide text-emerald-500 uppercase shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)] ring-1 ring-line active:scale-95 disabled:opacity-50" aria-label={`Add ${i.name}`}>Add{i.addons.length ? <span className="ml-0.5 text-[10px] align-super">+</span> : null}</button>
                              ) : (
                                <div className="flex min-h-10 items-center justify-between rounded-xl bg-emerald-500 px-1 text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)]">
                                  <button type="button" onClick={() => minusItem(i.id)} className="grid h-10 w-10 place-items-center" aria-label={`Less ${i.name}`}><Minus size={16} /></button>
                                  <span className="text-[15px] font-bold" aria-live="polite">{n}</span>
                                  <button type="button" onClick={() => onAdd(i)} className="grid h-10 w-10 place-items-center" aria-label={`More ${i.name}`}><Plus size={16} /></button>
                                </div>
                              )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <p className="mt-10 text-center text-xs text-muted">Prices {menu.gst_inclusive ? "include" : "exclude"} GST{menu.gst_inclusive ? "" : ", added on the bill"}.</p>
          </div>
        )}
      </main>

      {count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setCartOpen(true)} className="mx-auto flex min-h-14 w-full max-w-md items-center justify-between rounded-2xl bg-emerald-500 px-5 text-white shadow-[0_14px_36px_-10px_rgba(16,185,129,0.8)] active:scale-[0.99]">
            <span className="flex items-center gap-2.5 text-[15px] font-bold"><ShoppingBag size={19} />{count} item{count > 1 ? "s" : ""} · {inr(sub)}</span>
            <span className="flex items-center gap-1 text-[15px] font-bold">View cart <ChevronRight size={18} /></span>
          </button>
        </div>
      )}

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick?.name ?? "Customise"}>
        {pick && <AddonPicker item={pick} onAdd={(addons, note) => { addLine(pick, addons, note); setPick(null); }} />}
      </Sheet>

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title="Your order">
        {cartOpen && (
          <Checkout menu={menu} lines={cart} bill={bill} sub={sub} visitor={visitor} name={client.name} tableLabel={tableLabel} bump={bump}
            onMore={() => setCartOpen(false)}
            onPlace={async (name, phone, note) => {
              let lat: number | null = null, lng: number | null = null;
              if (menu.geo.required) {
                const pos = await new Promise<GeolocationPosition | null>((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 }); });
                if (!pos) return `Please allow location so we can confirm you are at ${client.name}. It is used only for this check and is never stored.`;
                lat = pos.coords.latitude; lng = pos.coords.longitude;
              }
              const { data: r, error } = await sb.rpc("guest_place_order", { p_client: client.id, p_code: code, p_name: name, p_phone: phone, p_note: note || null, p_lat: lat, p_lng: lng, p_lines: cart.map((l) => ({ item_id: l.item.id, qty: l.qty, addons: l.addons.map((a) => a.name), note: l.note })) });
              if (error) {
                const m = error.message ?? "";
                if (m.includes("OUT_OF_RANGE")) return `You seem to be away from ${client.name}. Orders can be placed only from inside.`;
                if (m.includes("LOCATION_NEEDED")) return "Please allow location to place your order.";
                if (m.includes("ITEM_UNAVAILABLE")) return `${m.split("ITEM_UNAVAILABLE:")[1]?.split("\n")[0] ?? "An item"} just sold out. Please remove it and try again.`;
                return m && m.length < 140 ? m : "That did not go through. Please check your connection and try again.";
              }
              const v = { name: name.trim().split(/\s+/)[0].slice(0, 24), phone: phone.replace(/\D/g, "") };
              saveVisitor(client.id, v); setVisitor(v);
              const o = r as { id: string; token: string; order_no: number; total: number };
              const p: Placed = { id: o.id, token: o.token, order_no: o.order_no, total: o.total, ts: Date.now() };
              try { localStorage.setItem(orderKey, JSON.stringify(p)); } catch {}
              justPlaced.current = true; setStatus("new"); setCart([]); setCartOpen(false); setPlaced(p);
              window.scrollTo({ top: 0 });
              return null;
            }} />
        )}
      </Sheet>

      <Sheet open={help} onClose={() => setHelp(false)} title="How can we help?">
        {help && <HelpSheet table={tableLabel} request={request} onChat={() => { setHelp(false); setTimeout(() => setChat(true), 260); }} />}
      </Sheet>

      <Sheet open={chat} onClose={() => setChat(false)} title="Chat with us">
        {chat && <ChatSheet clientId={client.id} code={code} table={tableLabel} visitor={visitor} onVisitor={setVisitor} />}
      </Sheet>

      <Sheet open={stars} onClose={closeStars} title="How was your visit?">
        {stars && <ReviewFlow data={data} code={code} visitor={visitor} onPrivateFeedback={data.features.complaints ? () => { setStars(false); setTimeout(() => setComplaint(true), 260); } : undefined} />}
      </Sheet>
      <Sheet open={complaint} onClose={() => setComplaint(false)} title="Tell us what went wrong">
        {complaint && <FeedbackForm kind="complaint" clientId={client.id} code={code} visitor={visitor} onDone={() => setComplaint(false)} />}
      </Sheet>
    </div>
  );
}

function AddonPicker({ item, onAdd }: { item: Item; onAdd: (a: Addon[], note: string) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const chosen = item.addons.filter((a) => sel.includes(a.name));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Make it yours. Add-ons are optional.</p>
      <ul className="space-y-2">
        {item.addons.map((a) => (
          <li key={a.name}>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl px-4 ring-1 ring-line" style={{ background: sel.includes(a.name) ? "color-mix(in srgb, #10b981 16%, transparent)" : "var(--surface-2)" }}>
              <input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={sel.includes(a.name)} onChange={() => setSel((s) => (s.includes(a.name) ? s.filter((x) => x !== a.name) : [...s, a.name]))} />
              <span className="flex-1 text-[15px]">{a.name}</span><span className="text-[15px] font-medium">+ {inr(a.price)}</span>
            </label>
          </li>
        ))}
      </ul>
      <input className={glassInput} value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Any request? (less sugar, no onion...)" aria-label="Request for the kitchen" />
      <button type="button" className={pillPrimary} onClick={() => onAdd(chosen, note)}>Add to order · {inr(item.price + chosen.reduce((a, x) => a + x.price, 0))}</button>
    </div>
  );
}

function Checkout({ menu, lines, bill, sub, visitor, name: shop, tableLabel, bump, onMore, onPlace }: {
  menu: MenuData; lines: Line[]; bill: ReturnType<typeof totals>; sub: number; visitor: Visitor | null; name: string; tableLabel: string;
  bump: (key: string, d: number) => void; onMore: () => void; onPlace: (name: string, phone: string, note: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(visitor?.name ?? "");
  const [phone, setPhone] = useState(visitor?.phone?.replace(/^91(?=\d{10}$)/, "") ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    if (!name.trim()) return setErr("Please add your name.");
    if (phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").length !== 10) return setErr("Enter your 10-digit mobile number.");
    setBusy(true); setErr("");
    const e = await onPlace(name, phone, note);
    setBusy(false);
    if (e) setErr(e);
  }
  if (lines.length === 0) return <p className="py-8 text-center text-muted">Your cart is empty.</p>;
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.key} className="flex items-start gap-3">
            <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border-2" style={{ borderColor: l.item.veg ? "#16a34a" : "#dc2626" }}><span className="h-2 w-2 rounded-full" style={{ background: l.item.veg ? "#16a34a" : "#dc2626" }} /></span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{l.item.name}</p>{(l.addons.length > 0 || l.note) && <p className="text-xs text-muted">{[...l.addons.map((a) => a.name), l.note].filter(Boolean).join(" · ")}</p>}</div>
            <div className="flex items-center rounded-xl bg-emerald-500 text-white">
              <button type="button" onClick={() => bump(l.key, -1)} className="grid h-10 w-9 place-items-center" aria-label={`Less ${l.item.name}`}><Minus size={15} /></button>
              <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
              <button type="button" onClick={() => bump(l.key, 1)} className="grid h-10 w-9 place-items-center" aria-label={`More ${l.item.name}`}><Plus size={15} /></button>
            </div>
            <span className="w-16 pt-2 text-right text-[15px] font-medium">{inr(unit(l) * l.qty)}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onMore} className="text-sm underline underline-offset-4">Add more items</button>
      <dl className="space-y-1.5 rounded-2xl p-4 text-[14px] ring-1 ring-line" style={{ background: "var(--surface-2)" }}>
        <div className="flex justify-between"><dt className="text-muted">Items</dt><dd>{inr(sub)}</dd></div>
        {menu.gst_inclusive ? <div className="flex justify-between"><dt className="text-muted">GST {menu.gst_rate}% (included)</dt><dd>{inr(bill.gst)}</dd></div> : (<>
          <div className="flex justify-between"><dt className="text-muted">CGST {menu.gst_rate / 2}%</dt><dd>{inr(bill.cgst)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">SGST {menu.gst_rate / 2}%</dt><dd>{inr(bill.sgst)}</dd></div>
        </>)}
        <div className="flex justify-between border-t border-line pt-2 text-[17px] font-bold"><dt>Total</dt><dd>{inr(bill.total)}</dd></div>
        <p className="pt-1 text-xs text-muted">Pay at the table after your meal. Served to {tableLabel}.</p>
      </dl>
      <input className={glassInput} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the kitchen (optional)" aria-label="Note for the kitchen" />
      <div className="space-y-3">
        <p className="text-sm font-semibold">Who is ordering?</p>
        <input className={glassInput} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} autoComplete="given-name" maxLength={40} placeholder="Your name" aria-label="Your name" />
        <input className={glassInput} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} maxLength={16} placeholder="Mobile number" aria-label="Mobile number" />
        <p className="text-xs text-muted">So {shop} can reach you about this order. Your number is kept for a short time for this order only. It is never sold or shared.</p>
      </div>
      {err && <p role="alert" className="text-sm text-amber-500">{err}</p>}
      <button className={pillPrimary} disabled={busy || !menu.accepting}>{busy && <Loader2 size={18} className="animate-spin" />}{menu.accepting ? `Place order · ${inr(bill.total)}` : "Orders are paused"}</button>
    </form>
  );
}

function Success({ placed, status, name, onHelp, onMore, onStars, request }: { placed: Placed; status: Status; name?: string; onHelp: () => void; onMore: () => void; onStars?: () => void; request: (k: "waiter" | "bill" | "clean" | "other") => Promise<boolean> }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === (status === "completed" ? "served" : status)));
  const [sent, setSent] = useState<string | null>(null);
  const ask = async (k: "waiter" | "bill", label: string) => { setSent((await request(k)) ? label : "That did not go through. Please wave to the staff."); };
  return (
    <section className="px-4 pt-10 text-center" aria-live="polite">
      <span className="tick-pop mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_14px_40px_-10px_rgba(16,185,129,0.9)]"><Check size={42} strokeWidth={3} /></span>
      <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">{status === "cancelled" ? "We could not take this order" : `Thank you${name ? `, ${name}` : ""}!`}</h2>
      <p className="mt-1 text-muted">{status === "cancelled" ? "Please ask the staff and we will sort it out." : `Order #${placed.order_no} is placed. We are on it.`}</p>
      {status !== "cancelled" && (
        <ol className="mx-auto mt-7 flex max-w-xs items-start justify-between" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex w-1/4 flex-col items-center gap-1.5 text-[11px]" aria-current={i === idx ? "step" : undefined}>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold ${i <= idx ? "bg-emerald-500 text-white" : "ring-1 ring-line text-muted"}`}>{i < idx ? <Check size={14} /> : i + 1}</span>
              <span className={i <= idx ? "font-semibold" : "text-muted"}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mx-auto mt-8 grid max-w-xs gap-2.5">
        <button type="button" className={pillSoft} onClick={() => ask("waiter", "A waiter is on the way.")}><BellRing size={18} /> Call waiter</button>
        <button type="button" className={pillSoft} onClick={() => ask("bill", "We will bring your bill.")}>Ask for the bill</button>
        <button type="button" className={pillSoft} onClick={onHelp}><MessageCircle size={18} /> More help or chat</button>
        <button type="button" className={pillPrimary} onClick={onMore}>Order something more</button>
        {onStars && <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={onStars}>Rate your visit</button>}
      </div>
      {sent && <p role="status" className="mt-4 text-sm text-emerald-500">{sent}</p>}
    </section>
  );
}

function HelpSheet({ table, request, onChat }: { table: string; request: (k: "waiter" | "bill" | "clean" | "other", note?: string) => Promise<boolean>; onChat: () => void }) {
  const [done, setDone] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(k: "waiter" | "bill" | "clean" | "other", ok: string, n?: string) {
    setBusy(true);
    const r = await request(k, n);
    setBusy(false);
    setDone(r ? ok : "That did not go through. Please wave to the staff.");
    if (r) setOther(false);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">We will come to {table}.</p>
      {done && <p role="status" className="rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-500">{done}</p>}
      <button type="button" disabled={busy} className={pillSoft} onClick={() => go("waiter", "A waiter is on the way.")}><BellRing size={18} /> Call a waiter</button>
      <button type="button" disabled={busy} className={pillSoft} onClick={() => go("bill", "We will bring your bill.")}>Bring the bill</button>
      <button type="button" disabled={busy} className={pillSoft} onClick={() => go("clean", "Someone will clean your table.")}>Clean the table</button>
      {!other ? <button type="button" className={pillSoft} onClick={() => setOther(true)}>Something else</button> : (
        <div className="space-y-2">
          <input className={glassInput} value={note} maxLength={200} autoFocus onChange={(e) => setNote(e.target.value)} placeholder="Tell us what you need" aria-label="What do you need" />
          <button type="button" disabled={busy || !note.trim()} className={pillPrimary} onClick={() => go("other", "We have your request.", note)}>Send request</button>
        </div>
      )}
      <button type="button" className={pillPrimary} onClick={onChat}><MessageCircle size={18} /> Chat with the staff</button>
    </div>
  );
}

type Msg = { id: string; sender: "customer" | "staff"; body: string };
function ChatSheet({ clientId, code, table, visitor, onVisitor }: { clientId: string; code: string; table: string; visitor: Visitor | null; onVisitor: (v: Visitor) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [name, setName] = useState(visitor?.name ?? ""); const [phone, setPhone] = useState(visitor?.phone?.replace(/^91(?=\d{10}$)/, "") ?? "");
  const [thread, setThread] = useState<{ id: string; token: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const key = `tz_chat_${clientId}_${code}`;

  const start = useCallback(async (n: string, p: string) => {
    setBusy(true); setErr("");
    const { data, error } = await sb.rpc("guest_chat_open", { p_client: clientId, p_code: code, p_name: n, p_phone: p });
    setBusy(false);
    if (error || !data) return setErr("Chat did not open. Please try again, or call the waiter.");
    const t = { id: (data as { thread_id: string }).thread_id, token: (data as { token: string }).token };
    try { sessionStorage.setItem(key, JSON.stringify(t)); } catch {}
    setThread(t);
  }, [sb, clientId, code, key]);

  useEffect(() => {
    try { const t = JSON.parse(sessionStorage.getItem(key) ?? "null"); if (t?.id) setThread(t); else if (visitor) void start(visitor.name, visitor.phone); } catch { if (visitor) void start(visitor.name, visitor.phone); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!thread) return;
    let stop = false;
    const load = async () => { const { data } = await sb.rpc("guest_chat_messages", { p_thread: thread.id, p_token: thread.token }); if (!stop && Array.isArray(data)) setMsgs(data as Msg[]); };
    void load(); const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [thread, sb]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send() {
    const body = text.trim(); if (!body || !thread) return;
    setText(""); setMsgs((s) => [...s, { id: `tmp-${Date.now()}`, sender: "customer", body }]);
    const { error } = await sb.rpc("guest_chat_send", { p_thread: thread.id, p_token: thread.token, p_body: body });
    if (error) { setErr(error.message?.length < 120 ? error.message : "That did not send. Please try again."); setText(body); }
  }

  if (!thread) {
    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return setErr("Please add your name."); if (phone.replace(/\D/g, "").length < 10) return setErr("Enter your 10-digit mobile number."); const v = { name: name.trim().split(/\s+/)[0].slice(0, 24), phone: phone.replace(/\D/g, "") }; saveVisitor(clientId, v); onVisitor(v); void start(name, phone); }} noValidate>
        <p className="text-sm text-muted">Write to the staff at {table}. They reply right here.</p>
        <input className={glassInput} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} maxLength={40} placeholder="Your name" aria-label="Your name" />
        <input className={glassInput} inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} maxLength={16} placeholder="Mobile number" aria-label="Mobile number" />
        {err && <p role="alert" className="text-sm text-amber-500">{err}</p>}
        <button className={pillPrimary} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} Start chat</button>
      </form>
    );
  }
  return (
    <div className="flex h-[60dvh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto pb-2" aria-live="polite">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted">Say hello. We usually reply within a minute.</p>}
        {msgs.map((m) => <p key={m.id} className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] ${m.sender === "customer" ? "ml-auto bg-fg text-bg" : "ring-1 ring-line"}`} style={m.sender === "staff" ? { background: "var(--surface-2)" } : undefined}>{m.body}</p>)}
        <div ref={end} />
      </div>
      {err && <p role="alert" className="pb-1 text-sm text-amber-500">{err}</p>}
      <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input className={glassInput} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} maxLength={1000} placeholder="Type a message" aria-label="Message" />
        <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fg text-bg" aria-label="Send message"><Send size={18} /></button>
      </form>
    </div>
  );
}
