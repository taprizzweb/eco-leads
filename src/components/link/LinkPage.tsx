"use client";

import { useBackToClose } from "@/lib/sheet-back";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bike, CalendarDays, Coffee, Gift, Globe, Instagram, Facebook, Link2, Mail, MapPin, MessageSquareText, Phone, Share2, ShoppingBag, Star, Store, Utensils, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Mark } from "@/components/dash/AuthFrame";
import { BRAND, GoogleColorIcon, GoogleIcon, InstagramIcon, SwiggyIcon, WhatsappIcon, ZomatoIcon } from "@/components/guest/BrandIcons";
import { brandFor } from "./brands";
import { SiteLogo } from "./SiteLogo";
import { PhotoStrip } from "@/components/PhotoStrip";
import { LinkReviewSheet } from "./LinkReview";
import { ContactSheet } from "./ContactSheet";
import { MenuViewer, menuEmbedUrl } from "./MenuViewer";
import { getLinkTheme, safeUrl, telLink, waLink, type LinkData, type LinkOffer, type LinkOutlet } from "@/lib/linkpage";

type Ico = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
const ICONS: Record<string, Ico> = {
  menu: Utensils, drink: Coffee, map: MapPin, mail: Mail, phone: Phone, globe: Globe, calendar: CalendarDays, star: Star, gift: Gift,
  bag: ShoppingBag, outlets: Store, whatsapp: WhatsappIcon, zomato: Bike, swiggy: Bike, link: Link2,
};
const display = { fontFamily: 'var(--font-bebas), "Bebas Neue", Oswald, "Arial Narrow", Impact, sans-serif' } as const;

/** A button that asks for a Google review: it points at Google's write-a-review page, or carries the "smile" wording when it opens the outlet list first. */
const isReviewButton = (b: { url: string; label: string }) => /search\.google\.com\/local\/writereview|g\.page\/r\/[^/]+\/review/i.test(b.url) || /\b(win a|free) smile\b/i.test(b.label);
const googleBadge = <span className="grid h-7 w-7 place-items-center rounded-lg bg-white"><GoogleColorIcon size={18} /></span>;

/** Gold stars that sit on the top right edge of the review buttons. Decoration only. */
function Sparkles() {
  const star = "M12 0C13.2 7.2 16.8 10.8 24 12C16.8 13.2 13.2 16.8 12 24C10.8 16.8 7.2 13.2 0 12C7.2 10.8 10.8 7.2 12 0Z";
  return (
    <svg width={42} height={36} viewBox="0 0 42 36" className="pointer-events-none absolute -top-3.5 right-4" aria-hidden focusable="false">
      <path d={star} transform="translate(3 9)" fill="#f9c80e" />
      <path d={star} transform="translate(25 1) scale(0.62)" fill="#ffdd4a" />
      <path d={star} transform="translate(29 22) scale(0.36)" fill="#ffdd4a" />
    </svg>
  );
}

/** Repeats a short list until it has at least n items, so a moving strip never shows a blank gap. */
const fillTo = <T,>(list: T[], n: number): T[] => (list.length === 0 ? list : Array.from({ length: Math.ceil(n / list.length) }).flatMap(() => list));

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

function OutletsSheet({ outlets, onClose, onClick }: { outlets: LinkOutlet[]; onClose: () => void; onClick: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useBackToClose(true, onClose);
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
  useBackToClose(true, onClose);
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
              <button key={c.id} role="tab" aria-selected={pick === c.id} onClick={() => setPick(c.id)} className="relative h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']" style={pick === c.id ? { background: "#111", color: "#fff" } : { background: "rgba(0,0,0,0.06)", color: "#333" }}>{c.label}</button>
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
  const theme = getLinkTheme(data.theme, data.colors);
  const reduce = useReducedMotion();
  const [outlets, setOutlets] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [menuView, setMenuView] = useState<{ src: string; title: string } | null>(null);
  const [note, setNote] = useState("");
  const sb = supabaseBrowser();
  // A review opens the business on Google Maps: its first outlet's map link, else the page's own Maps link.
  const reviewHref = safeUrl(data.outlets?.find((o) => safeUrl(o.map_url))?.map_url) ?? safeUrl(data.socials.maps);
  // A Supabase call only goes out once something waits on it, so .then() is what actually sends the count. A failed count never bothers the visitor.
  const track = (kind: "view" | "click", key?: string) => {
    if (!preview) sb.rpc("link_track", { p_id: data.id, p_kind: kind, p_key: key ?? null }).then(() => {}, () => {});
  };
  // Someone who taps Instagram (or any link) and comes back sees the review stars once, for every rating alike.
  useEffect(() => {
    if (!data.review_code || preview) return;
    const left = { v: false };
    const onClick = (e: MouseEvent) => { const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null; if (a && a.origin !== window.location.origin) left.v = true; };
    const back = () => {
      if (document.visibilityState !== "visible" || !left.v) return;
      left.v = false;
      try { if (sessionStorage.getItem("tz-review-back")) return; sessionStorage.setItem("tz-review-back", "1"); } catch { /* shown once per visit is best effort */ }
      setReviewOpen(true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); };
  }, [data.review_code, preview]);
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
    s.instagram && { href: s.instagram, label: "Instagram", node: <InstagramIcon size={24} />, brand: null },
    s.facebook && { href: s.facebook, label: "Facebook", node: brandFor(s.facebook, "Facebook") ?? <Facebook size={22} strokeWidth={1.6} />, brand: null },
    s.zomato && { href: s.zomato, label: "Zomato", node: <ZomatoIcon size={17} />, brand: BRAND.zomato },
    s.swiggy && { href: s.swiggy, label: "Swiggy", node: <SwiggyIcon size={18} />, brand: BRAND.swiggy },
    s.whatsapp && waLink(s.whatsapp) && { href: waLink(s.whatsapp)!, label: "WhatsApp", node: <WhatsappIcon size={21} />, brand: null },
    s.maps && { href: s.maps, label: "Directions", node: <MapPin size={22} strokeWidth={1.6} />, brand: null },
    s.phone && telLink(s.phone) && { href: telLink(s.phone)!, label: "Call", node: <Phone size={22} strokeWidth={1.6} />, brand: null },
    s.website && { href: s.website, label: "Website", node: <Globe size={22} strokeWidth={1.6} />, brand: null },
  ].filter(Boolean) as { href: string; label: string; node: React.ReactNode; brand: { bg: string; fg: string } | null }[];

  const offers = (data.offers ?? []).filter((o) => o.title.trim());
  const buttons = data.buttons.filter((b) => b.label.trim() && (b.url === "#contact" ? true : b.url === "#outlets" ? data.outlets.length > 0 : b.url === "#offers" ? offers.length > 0 : !!safeUrl(b.url)));
  const rise = (i: number) => (reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4, delay: 0.05 + i * 0.05 } } : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] as const } });
  const topBtn = "grid h-9 w-9 place-items-center rounded-full transition active:scale-90";

  // The highlighted review button. With AI review on it opens the stars inside the page; with it off it opens the plain link saved for this page.
  const reviewLink = data.review_code ? null : safeUrl(data.review_link);
  const googleLink = !!reviewLink && isReviewButton({ url: reviewLink, label: "" });
  const reviewName = data.review_label || (data.review_code ? "AI Review by Tap" : googleLink ? "Review on Google" : "Open Link");
  const reviewCls = "relative flex min-h-[60px] w-full items-center justify-center rounded-full px-12 py-2.5 transition active:scale-[0.985]";
  const reviewStyle = { background: "var(--l-pill)", color: "var(--l-pill-text)", boxShadow: "0 10px 26px -16px rgba(0,0,0,0.8), 0 0 0 2px var(--l-accent)" } as const;
  const reviewInner = (
    <>
      <span className="absolute left-3.5 grid h-7 min-w-6 place-items-center" aria-hidden>{!reviewLink || googleLink ? googleBadge : brandFor(reviewLink, reviewName) ?? <Link2 size={21} strokeWidth={1.7} />}</span>
      <span className="flex flex-col items-center leading-none"><span className="text-[22px] tracking-[0.03em] uppercase" style={display}>{reviewName}</span>{!reviewLink && <span className="mt-1 text-[10.5px] font-semibold tracking-[0.08em] uppercase opacity-70">Pick stars, get your review in seconds</span>}</span>
      {(!reviewLink || googleLink) && <Sparkles />}
    </>
  );
  const reviewButton = data.review_code
    ? <button type="button" onClick={() => { track("click", reviewName); setReviewOpen(true); }} className={reviewCls} style={reviewStyle}>{reviewInner}</button>
    : reviewLink
      ? <a href={reviewLink} target={/^(tel|mailto):/i.test(reviewLink) ? undefined : "_blank"} rel="noopener" onClick={() => track("click", reviewName)} className={reviewCls} style={reviewStyle}>{reviewInner}</a>
      : null;

  return (
    <div className="min-h-dvh [overflow-x:clip]" data-theme={theme.dark ? "dark" : "light"} style={{ ...(theme.vars as React.CSSProperties), background: `radial-gradient(90% 420px at 50% -60px, var(--l-glow), transparent 70%), var(--l-bg)`, color: "var(--l-text)" }}>
      <main className="relative mx-auto flex max-w-md flex-col pb-8">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
          <a href="https://taprizz.in" target="_blank" rel="noopener" aria-label="Taprizz" onClick={() => track("click", "Taprizz logo")} className="rounded-full" style={{ boxShadow: "0 6px 18px -8px rgba(0,0,0,0.7)" }}><Mark size={36} /></a>
          <button type="button" onClick={share} aria-label="Share this page" className={topBtn} style={{ background: "var(--l-surface-2)", boxShadow: "inset 0 0 0 1px var(--l-line)", color: "var(--l-text)" }}><Share2 size={16} /></button>
        </div>
        <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          {note && <span className="rounded-full px-3.5 py-1.5 text-[12px] font-medium" style={{ background: "var(--l-text)", color: "var(--l-bg)" }}>{note}</span>}
        </div>

        <motion.header {...rise(0)} className="flex flex-col items-center px-6 pt-14 text-center">
          <a href="https://taprizz.in" target="_blank" rel="noopener" aria-label="Taprizz" onClick={() => track("click", "Taprizz logo")} className="grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full bg-white" style={{ boxShadow: "0 14px 40px -16px var(--l-accent), 0 0 0 1px var(--l-line)" }}>
            {data.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={data.logo_url} alt={`${data.name} logo`} width={84} height={84} className="h-full w-full object-cover" />
              : <span className="text-3xl font-semibold text-black/80" style={display}>{data.name.slice(0, 1).toUpperCase()}</span>}
          </a>
          <h1 className="mt-4 text-[44px] leading-none tracking-[0.02em] uppercase" style={display}>{data.name}</h1>
          {data.tagline && <p className="mt-1.5 text-[17px] leading-none tracking-[0.03em] uppercase" style={{ ...display, color: "var(--l-muted)" }}>{data.tagline}</p>}
        </motion.header>

        {icons.length > 0 && (
          <motion.nav {...rise(1)} aria-label="Find us" className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 px-6">
            {icons.map((i) => (
              <a key={i.label} href={i.href} target={i.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener" aria-label={i.label} onClick={() => track("click", `Icon: ${i.label}`)}
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
          <motion.section {...rise(3)} className="mt-4" aria-label="Photos"><PhotoStrip items={data.photos.map((p) => ({ url: p.url, caption: p.caption, kind: p.kind }))} width={210} ratio="1/1" /></motion.section>
        )}

        {reviewButton && (data.review_pos ?? "top") === "top" && <motion.div {...rise(4)} className="mt-4 px-3">{reviewButton}</motion.div>}

        {buttons.length > 0 && (
          <motion.nav {...rise(4)} aria-label="Links" className="mt-4 space-y-2.5 px-3">
            {buttons.map((b, i) => {
              const Icon = ICONS[b.icon] ?? Link2;
              // Every link shows the logo of the app it points to (Facebook, YouTube, LinkedIn, X, Instagram...). Unknown ones keep the generic icon.
              // Review buttons always show Google's logo. The "google" icon can also be chosen by hand for any other button.
              const review = isReviewButton(b);
              const logo = review || b.icon === "google" ? googleBadge
                : brandFor(b.url, b.label) ?? (b.icon === "link" && /^https?:\/\//i.test(b.url) ? <SiteLogo url={b.url} /> : null);
              const glyph = logo ?? <Icon size={21} strokeWidth={1.7} />;
              const inner = (
                <>
                  <span className="absolute left-3.5 grid h-7 min-w-6 place-items-center" aria-hidden>{glyph}</span>
                  <span className="text-[22px] leading-none tracking-[0.03em] uppercase" style={display}>{b.label}</span>
                  {review && <Sparkles />}
                </>
              );
              const cls = "relative flex min-h-[52px] w-full items-center justify-center rounded-full px-12 py-2.5 transition active:scale-[0.985]";
              const st = { background: "var(--l-pill)", color: "var(--l-pill-text)", boxShadow: "0 10px 26px -16px rgba(0,0,0,0.8)" } as const;
              // A menu button that points to a Drive file or a PDF opens inside the page, with a cross to come back.
              const embed = b.icon === "menu" || /menu/i.test(b.label) ? menuEmbedUrl(b.url) : null;
              if (embed) return <button key={i} type="button" className={cls} style={st} onClick={() => { track("click", `Button: ${b.label}`); setMenuView({ src: embed, title: b.label }); }}>{inner}</button>;
              return b.url === "#outlets" || b.url === "#offers" || b.url === "#contact"
                ? <button key={i} type="button" className={cls} style={st} onClick={() => { track("click", `Button: ${b.label}`); if (b.url === "#offers") setOffersOpen(true); else if (b.url === "#contact") setContactOpen(true); else setOutlets(true); }}>{inner}</button>
                : <a key={i} href={safeUrl(b.url) ?? "#"} target={b.url.startsWith("tel:") || b.url.startsWith("mailto:") ? undefined : "_blank"} rel="noopener" className={cls} style={st} onClick={() => track("click", `Button: ${b.label}`)}>{inner}</a>;
            })}
          </motion.nav>
        )}
        {reviewButton && (data.review_pos ?? "top") === "bottom" && <motion.div {...rise(4)} className="mt-4 px-3">{reviewButton}</motion.div>}

        {data.reviews.length > 0 && (
          <motion.section {...rise(5)} className="mt-5" aria-label="Guest reviews">
            <Marquee seconds={Math.max(24, data.reviews.length * 6)} label="Guest reviews">
              {fillTo(data.reviews, 8).map((r, i) => (
                <ReviewCard key={i} href={reviewHref} onClick={() => track("click", "Guest reviews card")}>
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
                </ReviewCard>
              ))}
            </Marquee>
          </motion.section>
        )}

        <footer className="mt-6 flex items-center justify-center gap-2 text-[8.5px] font-semibold tracking-[0.3em] uppercase" style={{ color: "var(--l-muted)" }}><a href="https://taprizz.in" target="_blank" rel="noopener" onClick={() => track("click", "Powered by Taprizz")} className="flex items-center gap-2"><Mark size={16} />Powered by Taprizz</a></footer>
        {data.plan === "mini" && !data.premium && !preview && <MiniFooter slug={data.slug} />}
      </main>
      {reviewOpen && data.review_code && <LinkReviewSheet code={data.review_code} onClose={() => setReviewOpen(false)} />}
      {menuView && <MenuViewer src={menuView.src} title={menuView.title} onClose={() => setMenuView(null)} />}
      {contactOpen && <ContactSheet linkId={data.id} onClose={() => setContactOpen(false)} onSent={() => track("click", "Contact form sent")} />}
      {offersOpen && <OffersSheet offers={offers} outlets={data.outlets} onClose={() => setOffersOpen(false)} onClick={() => track("click", "Offer: Get this offer")} />}
      {outlets && <OutletsSheet outlets={data.outlets} onClose={() => setOutlets(false)} onClick={() => track("click", "Outlet: call, map or Instagram")} />}
    </div>
  );
}

/** Mini pages are open to everyone, so every one carries a link to make your own and a way to report it. */
function MiniFooter({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const send = async (reason: string) => { setDone(true); setOpen(false); await supabaseBrowser().rpc("link_report", { p_slug: slug, p_reason: reason }).then(() => {}, () => {}); };
  return (
    <div className="mt-3 pb-6 text-center text-[11px]" style={{ color: "var(--l-muted)" }}>
      <a href="/create" className="underline underline-offset-4">Make your own page</a>
      <span aria-hidden> · </span>
      {done ? <span>Thank you, we will look at it.</span> : <button type="button" className="underline underline-offset-4" onClick={() => setOpen((v) => !v)}>Report this page</button>}
      {open && (
        <div className="mx-auto mt-2 flex max-w-xs flex-wrap justify-center gap-1.5">
          {["Scam or fake", "Adult content", "Illegal", "Pretends to be someone", "Other"].map((r) => (
            <button key={r} type="button" onClick={() => void send(r)} className="rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ background: "var(--l-surface-2)", color: "var(--l-text)", boxShadow: "inset 0 0 0 1px var(--l-line)" }}>{r}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ href, onClick, children }: { href: string | null; onClick: () => void; children: React.ReactNode }) {
  const cls = "mr-3 flex w-[250px] shrink-0 flex-col gap-1.5 rounded-2xl bg-white p-3.5 text-left text-[#111]";
  const st = { boxShadow: "0 12px 30px -20px rgba(0,0,0,0.8)" } as const;
  return href
    ? <a href={href} target="_blank" rel="noopener" onClick={onClick} aria-label="See this place and its reviews on Google Maps" className={`${cls} transition active:scale-[0.98]`} style={st}>{children}</a>
    : <article className={cls} style={st}>{children}</article>;
}
