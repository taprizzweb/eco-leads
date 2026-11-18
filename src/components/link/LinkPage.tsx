"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bike, CalendarDays, ChevronRight, Coffee, Gift, Globe, Instagram, Facebook, Link2, Mail, MapPin, Phone, ShoppingBag, Star, Store, Utensils, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BRAND, GoogleIcon, SwiggyIcon, WhatsappIcon, ZomatoIcon } from "@/components/guest/BrandIcons";
import { getLinkTheme, safeUrl, telLink, waLink, type LinkData, type LinkOutlet } from "@/lib/linkpage";

type Ico = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
const ICONS: Record<string, Ico> = {
  menu: Utensils, drink: Coffee, map: MapPin, mail: Mail, phone: Phone, globe: Globe, calendar: CalendarDays, star: Star, gift: Gift,
  bag: ShoppingBag, outlets: Store, whatsapp: WhatsappIcon, zomato: Bike, swiggy: Bike, link: Link2,
};

function Marquee({ children, seconds, reverse, label }: { children: React.ReactNode; seconds: number; reverse?: boolean; label: string }) {
  return (
    <div className={`marquee-scroll marquee-pausable no-scrollbar overflow-hidden ${reverse ? "marquee-reverse" : ""}`} aria-label={label} tabIndex={0}>
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${seconds}s` }}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

const roundBtn = "grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90";
const ring = { background: "var(--l-surface)", boxShadow: "inset 0 0 0 1px var(--l-line)", color: "var(--l-text)" } as const;

function OutletsSheet({ outlets, onClose, onClick }: { outlets: LinkOutlet[]; onClose: () => void; onClick: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
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
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] px-5 pt-4 pb-10" style={{ background: "var(--l-sheet)", color: "var(--l-text)", boxShadow: "0 -1px 0 var(--l-line)" }}>
        <div className="sticky top-0 z-10 -mx-5 mb-2 flex items-center justify-between px-5 pb-3" style={{ background: "var(--l-sheet)" }}>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Our {outlets.length} {outlets.length === 1 ? "outlet" : "outlets"}</h2>
          <button onClick={onClose} aria-label="Close" className={roundBtn} style={ring}><X size={18} /></button>
        </div>
        <ul className="space-y-6">
          {outlets.map((o, i) => {
            const all: { href: string | null; label: string; I: Ico }[] = [
              { href: safeUrl(o.map_url), label: "Directions", I: MapPin },
              { href: waLink(o.whatsapp), label: "WhatsApp", I: WhatsappIcon },
              { href: telLink(o.phone), label: "Call", I: Phone },
              { href: safeUrl(o.review_url), label: "Review on Google", I: Star },
            ];
            const acts = all.flatMap((a) => (a.href ? [{ ...a, href: a.href }] : []));
            return (
              <li key={i} className="space-y-3">
                {o.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image_url} alt={o.name} loading="lazy" className="aspect-[16/10] w-full rounded-[22px] object-cover" style={{ boxShadow: "0 0 0 1px var(--l-line)" }} />
                )}
                <div>
                  <h3 className="text-[16px] font-semibold">{o.name}</h3>
                  {o.address && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--l-muted)" }}>{o.address}</p>}
                </div>
                {acts.length > 0 && (
                  <div className="flex gap-2">
                    {acts.map((a) => (
                      <a key={a.label} href={a.href} target={a.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener" aria-label={`${a.label}: ${o.name}`} onClick={onClick} className={roundBtn} style={{ ...ring, background: "var(--l-accent-soft)", color: "var(--l-accent)" }}>
                        <a.I size={18} />
                      </a>
                    ))}
                  </div>
                )}
                {i < outlets.length - 1 && <div className="pt-3" style={{ borderBottom: "1px solid var(--l-line)" }} />}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}

export function LinkPage({ data, preview }: { data: LinkData; preview?: boolean }) {
  const theme = getLinkTheme(data.theme);
  const reduce = useReducedMotion();
  const [outlets, setOutlets] = useState(false);
  const sb = supabaseBrowser();
  const track = (kind: "view" | "click") => { if (!preview) void sb.rpc("link_track", { p_id: data.id, p_kind: kind }); };
  const viewed = useRef(false);
  useEffect(() => { if (!viewed.current) { viewed.current = true; track("view"); } });

  const s = data.socials;
  const icons = [
    s.instagram && { href: s.instagram, label: "Instagram", node: <Instagram size={19} strokeWidth={1.8} />, brand: null },
    s.facebook && { href: s.facebook, label: "Facebook", node: <Facebook size={19} strokeWidth={1.8} />, brand: null },
    s.zomato && { href: s.zomato, label: "Zomato", node: <ZomatoIcon size={18} />, brand: BRAND.zomato },
    s.swiggy && { href: s.swiggy, label: "Swiggy", node: <SwiggyIcon size={19} />, brand: BRAND.swiggy },
    s.whatsapp && waLink(s.whatsapp) && { href: waLink(s.whatsapp)!, label: "WhatsApp", node: <WhatsappIcon size={19} />, brand: null },
    s.maps && { href: s.maps, label: "Directions", node: <MapPin size={19} strokeWidth={1.8} />, brand: null },
    s.phone && telLink(s.phone) && { href: telLink(s.phone)!, label: "Call", node: <Phone size={19} strokeWidth={1.8} />, brand: null },
    s.website && { href: s.website, label: "Website", node: <Globe size={19} strokeWidth={1.8} />, brand: null },
  ].filter(Boolean) as { href: string; label: string; node: React.ReactNode; brand: { bg: string; fg: string } | null }[];

  const buttons = data.buttons.filter((b) => b.label.trim() && (b.url === "#outlets" ? data.outlets.length > 0 : !!safeUrl(b.url)));
  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.06 + i * 0.07, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <div className="min-h-dvh [overflow-x:clip]" data-theme={theme.dark ? "dark" : "light"} style={{ ...(theme.vars as React.CSSProperties), background: `radial-gradient(90% 420px at 50% -60px, var(--l-glow), transparent 70%), var(--l-bg)`, color: "var(--l-text)" }}>
      <main className="mx-auto flex max-w-md flex-col pb-10">
        {/* profile */}
        <motion.header {...rise(0)} className="flex flex-col items-center px-6 pt-12 text-center">
          <span className="grid h-[108px] w-[108px] place-items-center overflow-hidden rounded-full p-[3px]" style={{ background: "linear-gradient(145deg, var(--l-accent), transparent 65%)", boxShadow: "0 18px 50px -18px var(--l-accent)" }}>
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full" style={{ background: "var(--l-sheet)" }}>
              {data.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={data.logo_url} alt={`${data.name} logo`} width={102} height={102} className="h-full w-full object-cover" />
                : <span className="text-4xl font-semibold" style={{ color: "var(--l-accent)" }}>{data.name.slice(0, 1).toUpperCase()}</span>}
            </span>
          </span>
          <h1 className="mt-5 text-[26px] leading-tight font-semibold tracking-[0.06em] uppercase">{data.name}</h1>
          {data.tagline && <p className="mt-1.5 text-[12px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--l-muted)" }}>{data.tagline}</p>}
        </motion.header>

        {icons.length > 0 && (
          <motion.nav {...rise(1)} aria-label="Find us" className="mt-6 flex flex-wrap justify-center gap-2.5 px-6">
            {icons.map((i) => (
              <a key={i.label} href={i.href} target={i.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener" aria-label={i.label} onClick={() => track("click")} className={roundBtn} style={i.brand ? { background: i.brand.bg, color: i.brand.fg } : ring}>{i.node}</a>
            ))}
          </motion.nav>
        )}

        {data.tags.length > 0 && (
          <motion.div {...rise(2)} className="mt-6">
            <Marquee seconds={Math.max(30, data.tags.length * 5)} label="About this place">
              {data.tags.map((t) => (
                <span key={t} className="mr-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-medium" style={{ background: "var(--l-surface)", boxShadow: "inset 0 0 0 1px var(--l-line)", color: "var(--l-text)" }}>{t}</span>
              ))}
            </Marquee>
          </motion.div>
        )}

        {data.photos.length > 0 && (
          <motion.section {...rise(3)} className="mt-6" aria-label="Photos">
            {data.photos.length >= 3 ? (
              <Marquee seconds={Math.max(30, data.photos.length * 7)} reverse label="Photos">
                {data.photos.map((p, i) => (
                  <figure key={p.url + i} className="mr-3 aspect-[4/5] w-[230px] shrink-0 overflow-hidden rounded-[26px]" style={{ boxShadow: "0 0 0 1px var(--l-line), 0 20px 40px -24px rgba(0,0,0,0.6)", background: "var(--l-surface)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? ""} loading={i < 2 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
                  </figure>
                ))}
              </Marquee>
            ) : (
              <div className="flex justify-center gap-3 px-6">
                {data.photos.map((p, i) => (
                  <figure key={p.url + i} className="aspect-[4/5] w-[44%] overflow-hidden rounded-[26px]" style={{ boxShadow: "0 0 0 1px var(--l-line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" />
                  </figure>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {buttons.length > 0 && (
          <motion.nav {...rise(4)} aria-label="Links" className="mt-7 space-y-2.5 px-5">
            {buttons.map((b, i) => {
              const Icon = ICONS[b.icon] ?? Link2;
              const inner = (
                <>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--l-accent-soft)", color: "var(--l-accent)" }}><Icon size={19} strokeWidth={1.9} /></span>
                  <span className="flex-1 text-left text-[15px] font-semibold tracking-[0.01em]">{b.label}</span>
                  <ChevronRight size={18} style={{ color: "var(--l-muted)" }} aria-hidden />
                </>
              );
              const cls = "group flex min-h-[60px] w-full items-center gap-3.5 rounded-[20px] px-3 py-2.5 transition active:scale-[0.985]";
              const st = { background: "linear-gradient(180deg, var(--l-surface-2), var(--l-surface))", boxShadow: "inset 0 0 0 1px var(--l-line), 0 10px 30px -22px rgba(0,0,0,0.7)", color: "var(--l-text)" } as const;
              return b.url === "#outlets"
                ? <button key={i} type="button" className={cls} style={st} onClick={() => { track("click"); setOutlets(true); }}>{inner}</button>
                : <a key={i} href={b.url} target={b.url.startsWith("tel:") || b.url.startsWith("mailto:") ? undefined : "_blank"} rel="noopener" className={cls} style={st} onClick={() => track("click")}>{inner}</a>;
            })}
          </motion.nav>
        )}

        {data.reviews.length > 0 && (
          <motion.section {...rise(5)} className="mt-9" aria-label="Guest reviews">
            <h2 className="mb-3 px-6 text-center text-[11px] font-semibold tracking-[0.22em] uppercase" style={{ color: "var(--l-muted)" }}>What guests say</h2>
            <Marquee seconds={Math.max(40, data.reviews.length * 8)} label="Guest reviews">
              {data.reviews.map((r, i) => (
                <article key={i} className="mr-3 flex w-[260px] shrink-0 flex-col gap-2 rounded-[20px] p-4" style={{ background: "var(--l-surface)", boxShadow: "inset 0 0 0 1px var(--l-line)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{r.author}</span>
                    <GoogleIcon size={14} className="shrink-0 opacity-70" />
                  </div>
                  <div className="flex items-center gap-2" aria-label={`${r.rating} out of 5 stars`}>
                    <span className="flex">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={13} className={k < r.rating ? "fill-amber-400 text-amber-400" : "opacity-25"} />)}</span>
                    {r.date && <span className="text-[11px]" style={{ color: "var(--l-muted)" }}>{r.date}</span>}
                  </div>
                  <p className="line-clamp-4 text-[13px] leading-relaxed" style={{ color: "var(--l-muted)" }}>{r.body}</p>
                </article>
              ))}
            </Marquee>
          </motion.section>
        )}

        <footer className="mt-10 text-center text-[10px] font-semibold tracking-[0.28em] uppercase" style={{ color: "var(--l-muted)" }}>Powered by Taprizz</footer>
      </main>
      {outlets && <OutletsSheet outlets={data.outlets} onClose={() => setOutlets(false)} onClick={() => track("click")} />}
    </div>
  );
}
