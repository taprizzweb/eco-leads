"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bike, CalendarDays, Coffee, Gift, Globe, Instagram, Facebook, Link2, Mail, MapPin, MessageSquareText, Phone, Share2, ShoppingBag, Star, Store, Utensils, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Mark } from "@/components/dash/AuthFrame";
import { BRAND, GoogleIcon, SwiggyIcon, WhatsappIcon, ZomatoIcon } from "@/components/guest/BrandIcons";
import { getLinkTheme, isVideo, safeUrl, telLink, waLink, type LinkData, type LinkOffer, type LinkOutlet } from "@/lib/linkpage";

type Ico = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
const ICONS: Record<string, Ico> = {
  menu: Utensils, drink: Coffee, map: MapPin, mail: Mail, phone: Phone, globe: Globe, calendar: CalendarDays, star: Star, gift: Gift,
  bag: ShoppingBag, outlets: Store, whatsapp: WhatsappIcon, zomato: Bike, swiggy: Bike, link: Link2,
};
const display = { fontFamily: 'var(--font-bebas), "Bebas Neue", Oswald, "Arial Narrow", Impact, sans-serif' } as const;

function Marquee({ children, seconds, label }: { children: React.ReactNode; seconds: number; label: string }) {
  return (
    <div className="marquee-scroll marquee-pausable no-scrollbar overflow-hidden" aria-label={label} tabIndex={0}>
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${seconds}s` }}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

/** One photo or clip at a time, with dots. It moves on by itself and also follows a swipe. The direction is set per page. */
function Slider({ photos, backward }: { photos: { url: string; caption?: string; kind?: "image" | "video" }[]; backward: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const x0 = useRef<number | null>(null);
  const n = photos.length;
  const [instant, setInstant] = useState(false);
  // Going from the first photo back to the last jumps there at once, instead of sliding past every photo in between.
  const go = useCallback((d: number) => setI((v) => {
    const next = (v + d + n) % n;
    if (Math.abs(next - v) > 1) { setInstant(true); setTimeout(() => setInstant(false), 80); }
    return next;
  }), [n]);
  useEffect(() => {
    if (reduce || hold || n < 2) return;
    const t = setInterval(() => go(backward ? -1 : 1), 3600);
    return () => clearInterval(t);
  }, [reduce, hold, n, go, backward]);
  // only the clip on screen plays, muted and looping
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => { vids.current.forEach((v, k) => { if (!v) return; if (k === i && !reduce) void v.play().catch((e) => console.warn("Clip could not start:", e?.name)); else v.pause(); }); }, [i, reduce]);
  return (
    <div className="rounded-[26px] px-0 py-4" style={{ background: "var(--l-surface)", boxShadow: "inset 0 0 0 1px var(--l-line)" }}>
      <div className="relative overflow-hidden touch-pan-y" role="group" aria-roledescription="carousel" aria-label="Photos"
        onPointerDown={(e) => { x0.current = e.clientX; setHold(true); }}
        onPointerUp={(e) => { if (x0.current !== null) { const d = e.clientX - x0.current; if (Math.abs(d) > 40) go(d < 0 ? 1 : -1); } x0.current = null; setHold(false); }}
        onPointerCancel={() => { x0.current = null; setHold(false); }}>
        <div className={`flex ${instant ? "" : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"}`} style={{ transform: `translateX(calc(17% - ${i} * 66%))` }}>
          {photos.map((p, k) => (
            <div key={p.url + k} className="w-[66%] shrink-0 px-[1.5%]" aria-hidden={k !== i}>
              <div className="aspect-square overflow-hidden rounded-[18px] transition-all duration-700" style={{ opacity: k === i ? 1 : 0.45, transform: k === i ? "scale(1)" : "scale(0.94)", background: "var(--l-bg)" }}>
                {isVideo(p)
                  ? <video ref={(el) => { vids.current[k] = el; }} src={p.url} muted loop playsInline preload={k === 0 ? "auto" : "metadata"} aria-label={p.caption ?? `Clip ${k + 1}`} className="h-full w-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={p.url} alt={p.caption ?? `Photo ${k + 1}`} loading={k < 3 ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full object-cover" />}
              </div>
            </div>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Choose a photo">
          {photos.map((_, k) => (
            <button key={k} role="tab" aria-selected={k === i} aria-label={`Photo ${k + 1}`} onClick={() => setI(k)} className="grid h-6 w-6 place-items-center">
              <span className="block rounded-full transition-all" style={{ width: k === i ? 8 : 5, height: k === i ? 8 : 5, background: k === i ? "var(--l-text)" : "var(--l-muted)", opacity: k === i ? 1 : 0.55 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OutletsSheet({ outlets, onClose, onClick }: { outlets: LinkOutlet[]; onClose: () => void; onClick: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const cities = useMemo(() => [...new Set(outlets.map((o) => (o.city ?? "").trim()).filter(Boolean))], [outlets]);
  const [city, setCity] = useState("");
  const shown = city ? outlets.filter((o) => (o.city ?? "").trim() === city) : outlets;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("button")?.focus(), 50);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); document.body.style.overflow = ""; window.removeEventListener("keydown", key); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Our outlets">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div ref={panel} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-white px-5 pb-10 text-[#111]" style={{ boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.6)" }}>
        <div className="sticky top-0 z-10 -mx-5 mb-1 flex items-center gap-2 bg-white px-5 py-4">
          <h2 className="flex-1 text-[17px] font-semibold tracking-[-0.01em]">Our {outlets.length} {outlets.length === 1 ? "outlet" : "outlets"}</h2>
          {cities.length > 0 && (
            <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className="h-9 rounded-full border border-black/15 bg-white px-3 text-[13px]">
              <option value="">All</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-black/70"><X size={20} /></button>
        </div>
        <ul className="space-y-6">
          {shown.map((o, i) => {
            const all: { href: string | null; label: string; I: Ico }[] = [
              { href: safeUrl(o.review_url), label: "Review on Google", I: MessageSquareText },
              { href: safeUrl(o.map_url), label: "Directions", I: MapPin },
              { href: safeUrl(o.instagram), label: "Instagram", I: Instagram },
              { href: waLink(o.whatsapp), label: "WhatsApp", I: WhatsappIcon },
              { href: telLink(o.phone), label: "Call", I: Phone },
            ];
            const acts = all.flatMap((a) => (a.href ? [{ ...a, href: a.href }] : []));
            return (
              <li key={i} className="space-y-2.5">
                {o.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image_url} alt={o.name} loading="lazy" className="aspect-[16/10] w-full rounded-2xl object-cover" />
                )}
                <div>
                  <h3 className="text-[15px] font-semibold">{o.name}</h3>
                  {o.address && <p className="mt-0.5 text-[12.5px] leading-snug text-black/55">{o.address}</p>}
                </div>
                {acts.length > 0 && (
                  <div className="flex gap-1.5">
                    {acts.map((a) => (
                      <a key={a.label} href={a.href} target={a.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener" aria-label={`${a.label}: ${o.name}`} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full text-black/70 transition active:scale-90">
                        <a.I size={19} strokeWidth={1.6} />
                      </a>
                    ))}
                  </div>
                )}
                {i < shown.length - 1 && <div className="pt-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }} />}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}

function OffersSheet({ offers, outlets, onClose, onClick }: { offers: LinkOffer[]; outlets: LinkOutlet[]; onClose: () => void; onClick: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  // Offers are grouped by outlet, in the order of the outlets list. Offers for every outlet come first.
  const groups = useMemo(() => {
    const names = [...new Set(offers.map((o) => (o.outlet ?? "").trim()))];
    const order = ["", ...outlets.map((o) => o.name.trim())];
    names.sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
    return names.map((n) => ({ name: n, items: offers.filter((o) => (o.outlet ?? "").trim() === n) }));
  }, [offers, outlets]);
  const [pick, setPick] = useState("__all");
  const shown = pick === "__all" ? groups : groups.filter((g) => g.name === pick);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("button")?.focus(), 50);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); document.body.style.overflow = ""; window.removeEventListener("keydown", key); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Offers">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div ref={panel} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-white px-5 pb-10 text-[#111]" style={{ boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.6)" }}>
        <div className="sticky top-0 z-10 -mx-5 flex items-center gap-2 bg-white px-5 py-4">
          <h2 className="flex-1 text-[17px] font-semibold tracking-[-0.01em]">Offers</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-black/70"><X size={20} /></button>
        </div>
        {groups.length > 1 && (
          <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar" role="tablist" aria-label="Choose an outlet">
            {[{ id: "__all", label: "All" }, ...groups.map((g) => ({ id: g.name, label: g.name || "Every outlet" }))].map((c) => (
              <button key={c.id} role="tab" aria-selected={pick === c.id} onClick={() => setPick(c.id)} className="h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium" style={pick === c.id ? { background: "#111", color: "#fff" } : { background: "rgba(0,0,0,0.06)", color: "#333" }}>{c.label}</button>
            ))}
          </div>
        )}
        <div className="space-y-6">
          {shown.map((g) => (
            <section key={g.name} aria-label={g.name || "Every outlet"}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-black/50 uppercase">{g.name || "At every outlet"}</h3>
              <ul className="space-y-2.5">
                {g.items.map((o, i) => {
                  const href = safeUrl(o.link);
                  return (
                    <li key={i} className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.04)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}>
                      <p className="text-[15px] font-semibold">{o.title}</p>
                      {o.details && <p className="mt-1 text-[13px] leading-snug text-black/60">{o.details}</p>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {o.valid_till && <span className="rounded-full bg-black/[0.07] px-2.5 py-1 text-[11px] font-medium text-black/65">{o.valid_till}</span>}
                        {href && <a href={href} target={href.startsWith("tel:") || href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener" onClick={onClick} className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-semibold text-white">Get this offer</a>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const PALETTE = ["#6c5ce7", "#00a3a3", "#e17055", "#0984e3", "#d63384", "#2d9b5e"];

export function LinkPage({ data, preview }: { data: LinkData; preview?: boolean }) {
  const theme = getLinkTheme(data.theme);
  const reduce = useReducedMotion();
  const [outlets, setOutlets] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [note, setNote] = useState("");
  const sb = supabaseBrowser();
  const track = (kind: "view" | "click") => { if (!preview) void sb.rpc("link_track", { p_id: data.id, p_kind: kind }); };
  const viewed = useRef(false);
  useEffect(() => { if (!viewed.current) { viewed.current = true; track("view"); } });

  async function share() {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) { await navigator.share({ title: data.name, url }); return; }
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch { setNote("Could not share. Copy the address from your browser."); }
    setTimeout(() => setNote(""), 2200);
  }

  const s = data.socials;
  const icons = [
    s.instagram && { href: s.instagram, label: "Instagram", node: <Instagram size={22} strokeWidth={1.6} />, brand: null },
    s.facebook && { href: s.facebook, label: "Facebook", node: <Facebook size={22} strokeWidth={1.6} />, brand: null },
    s.zomato && { href: s.zomato, label: "Zomato", node: <ZomatoIcon size={17} />, brand: BRAND.zomato },
    s.swiggy && { href: s.swiggy, label: "Swiggy", node: <SwiggyIcon size={18} />, brand: BRAND.swiggy },
    s.whatsapp && waLink(s.whatsapp) && { href: waLink(s.whatsapp)!, label: "WhatsApp", node: <WhatsappIcon size={21} />, brand: null },
    s.maps && { href: s.maps, label: "Directions", node: <MapPin size={22} strokeWidth={1.6} />, brand: null },
    s.phone && telLink(s.phone) && { href: telLink(s.phone)!, label: "Call", node: <Phone size={22} strokeWidth={1.6} />, brand: null },
    s.website && { href: s.website, label: "Website", node: <Globe size={22} strokeWidth={1.6} />, brand: null },
  ].filter(Boolean) as { href: string; label: string; node: React.ReactNode; brand: { bg: string; fg: string } | null }[];

  const offers = (data.offers ?? []).filter((o) => o.title.trim());
  const buttons = data.buttons.filter((b) => b.label.trim() && (b.url === "#outlets" ? data.outlets.length > 0 : b.url === "#offers" ? offers.length > 0 : !!safeUrl(b.url)));
  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] as const } });
  const topBtn = "grid h-9 w-9 place-items-center rounded-full transition active:scale-90";

  return (
    <div className="min-h-dvh [overflow-x:clip]" data-theme={theme.dark ? "dark" : "light"} style={{ ...(theme.vars as React.CSSProperties), background: `radial-gradient(90% 420px at 50% -60px, var(--l-glow), transparent 70%), var(--l-bg)`, color: "var(--l-text)" }}>
      <main className="relative mx-auto flex max-w-md flex-col pb-8">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
          <span className="rounded-full" style={{ boxShadow: "0 6px 18px -8px rgba(0,0,0,0.7)" }}><Mark size={36} /></span>
          <button type="button" onClick={share} aria-label="Share this page" className={topBtn} style={{ background: "var(--l-surface-2)", boxShadow: "inset 0 0 0 1px var(--l-line)", color: "var(--l-text)" }}><Share2 size={16} /></button>
        </div>
        <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          {note && <span className="rounded-full px-3.5 py-1.5 text-[12px] font-medium" style={{ background: "var(--l-text)", color: "var(--l-bg)" }}>{note}</span>}
        </div>

        <motion.header {...rise(0)} className="flex flex-col items-center px-6 pt-14 text-center">
          <span className="grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full bg-white" style={{ boxShadow: "0 14px 40px -16px var(--l-accent), 0 0 0 1px var(--l-line)" }}>
            {data.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={data.logo_url} alt={`${data.name} logo`} width={84} height={84} className="h-full w-full object-cover" />
              : <span className="text-3xl font-semibold text-black/80" style={display}>{data.name.slice(0, 1).toUpperCase()}</span>}
          </span>
          <h1 className="mt-4 text-[44px] leading-none tracking-[0.02em] uppercase" style={display}>{data.name}</h1>
          {data.tagline && <p className="mt-1.5 text-[17px] leading-none tracking-[0.03em] uppercase" style={{ ...display, color: "var(--l-muted)" }}>{data.tagline}</p>}
        </motion.header>

        {icons.length > 0 && (
          <motion.nav {...rise(1)} aria-label="Find us" className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 px-6">
            {icons.map((i) => (
              <a key={i.label} href={i.href} target={i.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener" aria-label={i.label} onClick={() => track("click")}
                className={i.brand ? "grid h-8 w-8 place-items-center rounded-full transition active:scale-90" : "grid h-8 w-8 place-items-center transition active:scale-90"}
                style={i.brand ? { background: i.brand.bg, color: i.brand.fg } : { color: "var(--l-text)" }}>{i.node}</a>
            ))}
          </motion.nav>
        )}

        {data.tags.length > 0 && (
          <motion.div {...rise(2)} className="mt-5 py-2.5" style={{ background: "var(--l-pill)", color: "var(--l-pill-text)" }}>
            <Marquee seconds={Math.max(30, data.tags.length * 6)} label="About this place">
              {data.tags.map((t) => (
                <span key={t} className="flex items-center whitespace-nowrap px-4 text-[12.5px] font-bold uppercase tracking-[0.06em]">
                  {t}
                  <span className="pl-8 opacity-40">✦</span>
                </span>
              ))}
            </Marquee>
          </motion.div>
        )}

        {data.photos.length > 0 && (
          <motion.section {...rise(3)} className="mt-4 px-3" aria-label="Photos"><Slider photos={data.photos} backward={data.photo_direction === "backward"} /></motion.section>
        )}

        {buttons.length > 0 && (
          <motion.nav {...rise(4)} aria-label="Links" className="mt-4 space-y-2.5 px-3">
            {buttons.map((b, i) => {
              const Icon = ICONS[b.icon] ?? Link2;
              // Zomato and Swiggy show their own logos, not a generic icon
              const glyph = b.icon === "zomato"
                ? <span className="grid h-6 w-9 place-items-center rounded-md" style={{ background: BRAND.zomato.bg, color: BRAND.zomato.fg }}><ZomatoIcon size={15} /></span>
                : b.icon === "swiggy"
                  ? <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: BRAND.swiggy.bg, color: BRAND.swiggy.fg }}><SwiggyIcon size={17} /></span>
                  : <Icon size={21} strokeWidth={1.7} />;
              const inner = (
                <>
                  <span className="absolute left-3.5 grid h-7 min-w-6 place-items-center" aria-hidden>{glyph}</span>
                  <span className="text-[22px] leading-none tracking-[0.03em] uppercase" style={display}>{b.label}</span>
                </>
              );
              const cls = "relative flex min-h-[52px] w-full items-center justify-center rounded-full px-12 py-2.5 transition active:scale-[0.985]";
              const st = { background: "var(--l-pill)", color: "var(--l-pill-text)", boxShadow: "0 10px 26px -16px rgba(0,0,0,0.8)" } as const;
              return b.url === "#outlets" || b.url === "#offers"
                ? <button key={i} type="button" className={cls} style={st} onClick={() => { track("click"); if (b.url === "#offers") setOffersOpen(true); else setOutlets(true); }}>{inner}</button>
                : <a key={i} href={b.url} target={b.url.startsWith("tel:") || b.url.startsWith("mailto:") ? undefined : "_blank"} rel="noopener" className={cls} style={st} onClick={() => track("click")}>{inner}</a>;
            })}
          </motion.nav>
        )}

        {data.reviews.length > 0 && (
          <motion.section {...rise(5)} className="mt-5" aria-label="Guest reviews">
            <Marquee seconds={Math.max(40, data.reviews.length * 8)} label="Guest reviews">
              {data.reviews.map((r, i) => (
                <article key={i} className="mr-3 flex w-[250px] shrink-0 flex-col gap-1.5 rounded-2xl bg-white p-3.5 text-[#111]" style={{ boxShadow: "0 12px 30px -20px rgba(0,0,0,0.8)" }}>
                  <div className="flex items-center gap-2.5">
                    {r.avatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: PALETTE[(r.author.charCodeAt(0) || 0) % PALETTE.length] }}>{r.author.slice(0, 1).toUpperCase()}</span>}
                    <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-[12.5px] font-semibold">{r.author}</p>{r.date && <p className="text-[10.5px] text-black/50">{r.date}</p>}</div>
                    <GoogleIcon size={14} className="shrink-0 text-black/45" />
                  </div>
                  <span className="flex" aria-label={`${r.rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={12} className={k < r.rating ? "fill-amber-400 text-amber-400" : "text-black/20"} />)}</span>
                  <p className="line-clamp-3 text-[12px] leading-relaxed text-black/60">{r.body}</p>
                </article>
              ))}
            </Marquee>
          </motion.section>
        )}

        <footer className="mt-6 flex items-center justify-center gap-2 text-[8.5px] font-semibold tracking-[0.3em] uppercase" style={{ color: "var(--l-muted)" }}><Mark size={16} />Powered by Taprizz</footer>
      </main>
      {offersOpen && <OffersSheet offers={offers} outlets={data.outlets} onClose={() => setOffersOpen(false)} onClick={() => track("click")} />}
      {outlets && <OutletsSheet outlets={data.outlets} onClose={() => setOutlets(false)} onClick={() => track("click")} />}
    </div>
  );
}
