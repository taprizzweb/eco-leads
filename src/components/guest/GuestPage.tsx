"use client";

import { OFFER_KINDS } from "@/lib/hub-shared";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Instagram, Facebook, MapPin, Phone, ChevronRight, Star, Store, MessageCircle } from "lucide-react";
import type { LinkOutlet } from "@/lib/linkpage";
import type { CardKey, GuestPageData } from "@/lib/types";
import { CARD_TINTS, getTheme } from "@/lib/themes";
import { AnimatedIcon } from "./AnimatedIcon";
import { BRAND, SwiggyIcon, ZomatoIcon } from "./BrandIcons";
import { Mark } from "@/components/dash/AuthFrame";
import { Sheet } from "./Sheet";
import { CallServerButton, NewPill, PostersSheet, StaffSheet, WifiSheet } from "./GuestExtras";
import { useExitPrompt } from "@/lib/sheet-back";
import { ReviewFlow } from "./ReviewFlow";
import { FeedbackForm } from "./FeedbackForm";
import { CreatorsSheet } from "./CreatorsSheet";
import { VisitorGate } from "./VisitorGate";
import { forgetPass, loadVisitor, saveVisitor, type Visitor } from "@/lib/visitor";
import { supabaseBrowser } from "@/lib/supabase/client";

const DEFAULT_ORDER: CardKey[] = ["menu", "review", "complaint", "suggestion", "staff", "offers", "events", "membership", "creators", "wifi", "instagram"];

const DEFAULT_COPY: Record<CardKey, { title: string; help: string }> = {
  menu: { title: "View menu", help: "Browse what is cooking today" },
  review: { title: "Review us on Google", help: "Three taps, and the draft is yours to edit" },
  complaint: { title: "Raise a complaint", help: "Goes privately to the management" },
  suggestion: { title: "Any suggestions?", help: "One idea can improve the next visit" },
  offers: { title: "Check offers", help: "What is running at the store right now" },
  events: { title: "Upcoming events", help: "Nights, workshops and gatherings" },
  membership: { title: "Become a member", help: "Perks for regulars" },
  creators: { title: "Creators corner", help: "Tag us, follow us, and share your photos" },
  staff: { title: "Thank or report staff", help: "Appreciate great service or tell us what went wrong" },
  wifi: { title: "Connect to Wi-Fi", help: "Scan the code or copy the password" },
  instagram: { title: "Follow us on Instagram", help: "Stay updated on our latest events and happenings" },
};

// Flows built so far. Cards for later build steps stay hidden until their flow exists,
// so a guest never taps into a dead end.
const BUILT: CardKey[] = ["menu", "review", "complaint", "suggestion", "offers", "events", "creators", "staff", "wifi", "instagram"];

function cardEnabled(k: CardKey, d: GuestPageData): boolean {
  const f = d.features;
  switch (k) {
    case "menu": return !!d.plate?.menu_url || (!!f.menu && !!d.client.menu_url);
    case "review": return !!f.review && !!d.client.google_review_url;
    case "complaint": return !!f.complaints;
    case "suggestion": return !!f.suggestions;
    case "offers": return !!f.offers_card && d.offers.length > 0;
    case "events": return !!f.events && d.events.length > 0;
    case "membership": return !!f.membership;
    case "creators": return !!f.creators;
    case "staff": return !!d.extras?.staff.length;
    case "wifi": return !!d.client.socials.wifi_name;
    case "instagram": return !!d.client.socials.instagram;
  }
}

function Marquee({ children, seconds, pausable, label, reverse }: { children: React.ReactNode; seconds: number; pausable?: boolean; label: string; reverse?: boolean }) {
  return (
    <div
      className={`marquee-scroll no-scrollbar overflow-hidden ${pausable ? "marquee-pausable" : ""} ${reverse ? "marquee-reverse" : ""}`}
      aria-label={label}
      tabIndex={pausable ? 0 : undefined}
    >
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${seconds}s` }}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

export type NearbyOffer = { slug: string; name: string; area: string; category: string | null; kind: string; title: string | null; ends_on: string };

export function GuestPage({ data, code, hubHref, nearby, outlets = [] }: { data: GuestPageData; code: string; hubHref?: string | null; nearby?: { area_id: string | null; area: string | null; offers: NearbyOffer[] } | null; outlets?: LinkOutlet[] }) {
  const [outletsOpen, setOutletsOpen] = useState(false);
  const closeOutlets = useCallback(() => setOutletsOpen(false), []);
  const theme = getTheme(data.client.theme);
  const [open, setOpen] = useState<CardKey | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // The first tap on an action card asks for the guest's name and number (once per business, on their own phone).
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [gate, setGate] = useState(false);
  // "Welcome back" is for guests this phone already knows, never for someone who just filled the form a moment ago.
  const [returning, setReturning] = useState(false);
  const askContact = data.review?.collect_contact !== false;
  const [pending, setPending] = useState<CardKey | null>(null);
  const reduce = useReducedMotion();
  const { client } = data;
  const [postersOpen, setPostersOpen] = useState(false);
  const closePosters = useCallback(() => setPostersOpen(false), []);
  // Back from the page shows the review stars once. Skipped when the guest already started a review or the page cannot take reviews.
  const exitKey = `tz_exit_${client.id}`;
  const canNudge = data.live && !!data.features.review && !!client.google_review_url;
  useExitPrompt(canNudge, () => {
    try { if (sessionStorage.getItem(exitKey)) { window.history.back(); return; } sessionStorage.setItem(exitKey, "1"); } catch {}
    setOpen("review");   // straight to the stars; the name and number form is not put in front of someone who is leaving
  });

  const copyFor = (k: CardKey) => ({
    ...DEFAULT_COPY[k],
    ...(client.card_copy?.[k] ?? {}),
    ...(client.card_config?.copy?.[k] ?? {}),
  });

  const order = (client.card_config?.order?.length ? client.card_config.order : DEFAULT_ORDER).filter(
    (k) => BUILT.includes(k) && !client.card_config?.hidden?.includes(k) && cardEnabled(k, data),
  );

  const socials = [
    client.socials.instagram && { href: client.socials.instagram, label: "Instagram", Icon: Instagram },
    client.socials.facebook && { href: client.socials.facebook, label: "Facebook", Icon: Facebook },
    client.socials.maps && { href: client.socials.maps, label: "Directions", Icon: MapPin },
    client.socials.phone && { href: `tel:${client.socials.phone}`, label: "Call", Icon: Phone },
    client.socials.zomato && { href: client.socials.zomato, label: "Zomato", Icon: ZomatoIcon, brand: BRAND.zomato },
    client.socials.swiggy && { href: client.socials.swiggy, label: "Swiggy", Icon: SwiggyIcon, brand: BRAND.swiggy },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Instagram; brand?: { bg: string; fg: string } }[];

  useEffect(() => {
    if (!askContact) { setVisitor(null); return; }
    const v = loadVisitor(client.id);
    setVisitor(v);
    setReturning(!!v);
  }, [client.id, askContact]);

  const onCard = (k: CardKey) => {
    const menuLink = data.plate?.menu_url || client.menu_url;
    if (k === "menu" && menuLink) {
      window.open(menuLink, "_blank", "noopener");
      return;
    }
    if (k === "instagram" && client.socials.instagram) { window.open(client.socials.instagram, "_blank", "noopener"); return; }
    if (!askContact || k === "creators" || k === "wifi" || k === "staff") { setOpen(k); return; }
    if (!visitor) { setPending(k); setGate(true); return; }
    if (visitor.fromPass) {
      // Taprizz Pass from another place: this business gets the details only now, because the guest started something here.
      // Offers consent is never carried over, so it is false here.
      supabaseBrowser().rpc("guest_register_visitor", { p_client: client.id, p_name: visitor.name, p_phone: visitor.phone, p_marketing: false })
        .then(({ error }) => { if (!error) { saveVisitor(client.id, visitor); setVisitor({ name: visitor.name, phone: visitor.phone }); } });
    }
    setOpen(k);
  };

  useEffect(() => { if (open === "review") { try { sessionStorage.setItem(exitKey, "1"); } catch {} } }, [open, exitKey]);

  // Cards and blocks come in one after another when the page opens. With "less motion" they only fade, they do not rise.
  const rise = (i: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4, delay: 0.05 + i * 0.05 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay: 0.08 + i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div
      style={{ ...(theme.vars as React.CSSProperties), background: "radial-gradient(70% 380px at 50% -80px, var(--top, var(--surface-2)) 0%, var(--bg) 100%) no-repeat, var(--bg)" }}
      className="guest-root min-h-dvh text-fg"
      data-theme={theme.dark ? "dark" : "light"}
    >
      <main className="mx-auto max-w-md pb-12">
        {/* 1. Header: app-style, logo and name on the left, table on the right */}
        <motion.header {...rise(0)} className="flex items-center gap-3.5 px-5 pt-7 pb-4">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] ring-1 ring-line" />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-bold ring-1 ring-line" style={{ background: "linear-gradient(160deg, var(--surface-2), var(--surface))" }}>
              {client.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[21px] leading-tight font-semibold tracking-[-0.03em]">{client.name}</h1>
            {client.tagline && <p className="mt-0.5 truncate text-[13px] text-muted">{client.tagline}</p>}
          </div>
          {data.plate?.label && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line" style={{ background: "var(--surface)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              {data.plate.label}
            </span>
          )}
        </motion.header>
        {askContact && visitor && returning && (
          <p className="flex items-center gap-2 px-5 pb-1 text-sm text-muted" aria-live="polite">
            <span>Welcome back, <span className="font-semibold text-fg">{visitor.name}</span></span>
            <button type="button" className="min-h-11 px-1 underline underline-offset-4" onClick={() => { forgetPass(client.id); setVisitor(null); setReturning(false); }}>Not you?</button>
          </p>
        )}

        {/* 2. Social row */}
        {socials.length > 0 && (
          <motion.nav {...rise(1)} aria-label="Find us" className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-5">
            {socials.slice(0, 6).map(({ href, label, Icon, brand }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("tel:") ? undefined : "_blank"}
                rel="noopener"
                aria-label={label}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90 ${brand ? "" : "ring-1 ring-line"}`}
                style={brand ? { background: brand.bg, color: brand.fg } : { background: "var(--surface)" }}
              >
                <Icon size={18} strokeWidth={1.8} />
              </a>
            ))}
          </motion.nav>
        )}

        {/* 10. Paused: plate never looks dead, guest can still review */}
        {!data.live ? (
          <section className="px-4">
            {!client.google_review_url && (
              <div className="rounded-[24px] px-5 py-8 text-center ring-1 ring-line" style={{ background: "var(--surface)" }}>
                <p className="text-lg font-semibold">We will be right back</p>
                <p className="mt-1 text-[13.5px] text-muted">This page is taking a short break. Please ask the staff if you need anything.</p>
              </div>
            )}
            {client.google_review_url && (
              <a href={client.google_review_url} target="_blank" rel="noopener" className="sweep-border block">
                <span className="flex items-center justify-between rounded-[24.5px] px-5 py-6" style={{ background: "var(--surface)" }}>
                  <span>
                    <span className="block text-lg font-semibold">Review us on Google</span>
                    <span className="block text-[13px] text-muted">It takes less than a minute</span>
                  </span>
                  <Star className="fill-amber-400 text-amber-400" size={32} />
                </span>
              </a>
            )}
          </section>
        ) : (
          <>
            {/* 3. Offers strip */}
            {data.features.offers_strip && data.offers.length > 0 && (
              <motion.div {...rise(2)} className="mb-4 py-2.5" style={{ background: "var(--strip)", color: "var(--strip-text)" }}>
                <Marquee seconds={30} label="Current offers">
                  {data.offers.map((o) => (
                    <span key={o.id} className="flex items-center whitespace-nowrap px-4 text-[12.5px] font-bold uppercase tracking-[0.06em]">
                      {o.title}{o.details ? <span className="ml-1.5 font-medium normal-case tracking-normal opacity-75">{o.details}</span> : null}
                      <span className="pl-8 opacity-40">✦</span>
                    </span>
                  ))}
                </Marquee>
              </motion.div>
            )}

            {/* 3b. Nearby offers from other listed places (other categories), so a guest here discovers the area */}
            {nearby && nearby.offers.length > 0 && (
              <motion.section {...rise(2)} aria-label="Nearby offers" className="mb-4 px-4">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-[15px] font-semibold text-fg">Nearby offers</h2>
                  <a href={nearby.area_id ? `/jaipur?area=${nearby.area_id}` : "/jaipur"} className="text-xs text-muted">{nearby.area ?? "Jaipur"} · See all</a>
                </div>
                <div className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
                  {nearby.offers.map((o) => (
                    <a key={o.slug + o.kind + o.ends_on} href={`/jaipur/${o.slug}`} className="w-[172px] shrink-0 snap-start rounded-2xl p-3 ring-1 ring-line" style={{ background: "var(--surface)" }}>
                      <span className="block text-[10.5px] font-bold tracking-[0.06em] text-muted uppercase">{o.category ?? "Nearby"}</span>
                      <span className="mt-1.5 line-clamp-2 block text-[14.5px] leading-snug font-semibold text-fg">{o.title ?? (OFFER_KINDS[o.kind] ?? "Special offer")}</span>
                      <span className="mt-1 block truncate text-xs text-muted">{o.name}{o.area && o.area !== nearby.area ? ` · ${o.area}` : ""}</span>
                      {!o.title && <span className="mt-1 block text-[11px] text-muted">Follow to unlock</span>}
                    </a>
                  ))}
                </div>
              </motion.section>
            )}

            {/* 4. Photo gallery: keeps moving on its own like the offers strip when there are 3 or more photos, otherwise swipe */}
            {data.gallery.length > 0 && (() => {
              const figs = (fixed: boolean) => data.gallery.map((g, i) => (
                <figure key={g.url} className={`relative aspect-[4/5] shrink-0 overflow-hidden rounded-[22px] ring-1 ring-line ${fixed ? "mr-3 w-[220px]" : "w-[62%] snap-start"}`} style={{ background: "var(--surface)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt={g.caption ?? ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
                  {g.caption && (
                    <figcaption className="absolute top-3 left-3 max-w-[85%] truncate rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-md">
                      {g.caption}
                    </figcaption>
                  )}
                  {g.label && (
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold tracking-wide whitespace-nowrap text-black uppercase backdrop-blur-md">
                      {g.label}
                    </span>
                  )}
                </figure>
              ));
              return data.gallery.length >= 3 ? (
                <motion.section {...rise(3)} className="pb-3 pl-4">
                  <Marquee seconds={Math.max(30, data.gallery.length * 7)} pausable reverse label="Photos">{figs(true)}</Marquee>
                </motion.section>
              ) : (
                <motion.section {...rise(3)} aria-label="Photos" className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3">{figs(false)}</motion.section>
              );
            })()}

            {/* 5. Keyword strip */}
            {data.features.keywords && client.keywords.length > 0 && (
              <motion.div {...rise(4)} className="mb-6">
                <Marquee seconds={40} label="About this place">
                  {client.keywords.map((k) => (
                    <span key={k} className="mr-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line" style={{ background: "var(--pill)", color: "var(--pill-text)" }}>
                      {k}
                    </span>
                  ))}
                </Marquee>
              </motion.div>
            )}

            {/* 6. Action cards */}
            <section aria-label="What would you like to do?" className="space-y-3.5 px-4">
              {order.map((k, i) => {
                const c = copyFor(k);
                const tint = CARD_TINTS[k];
                if (k === "review") {
                  return (
                    <motion.button key={k} {...rise(5 + i)} whileTap={reduce ? undefined : { scale: 0.98 }} onClick={() => onCard(k)} className="sweep-border block w-full text-left">
                      <span className="flex items-center gap-4 rounded-[24.5px] px-5 py-5" style={{ background: "radial-gradient(120% 140% at 100% 0%, rgba(255,200,90,0.14), transparent 55%), var(--surface)" }}>
                        <span className="min-w-0 flex-1">
                          <span className="mb-2 flex gap-0.5" aria-hidden>
                            {[0, 1, 2, 3, 4].map((s) => (
                              <motion.span
                                key={s}
                                initial={reduce ? false : { scale: 0, rotate: -40, opacity: 0 }}
                                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + s * 0.09, type: "spring", stiffness: 420, damping: 16 }}
                              >
                                <Star size={16} className="fill-amber-400 text-amber-400 drop-shadow-[0_2px_6px_rgba(251,191,36,0.55)]" />
                              </motion.span>
                            ))}
                          </span>
                          <span className="block text-[20px] leading-tight font-semibold tracking-[-0.02em]">{c.title}</span>
                          <span className="mt-1 block text-[13.5px] leading-snug text-muted">{c.help}</span>
                        </span>
                        <AnimatedIcon name={k} tint="251, 191, 36" size={68} play={i} />
                      </span>
                    </motion.button>
                  );
                }
                return (
                  <motion.button
                    key={k}
                    {...rise(5 + i)}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    onClick={() => onCard(k)}
                    className="block w-full rounded-[26px] p-1.5 text-left ring-1 ring-line"
                    style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--text) 5%, var(--surface)), var(--surface))", boxShadow: "0 18px 40px -24px rgba(0,0,0,0.7), inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent)" }}
                  >
                    <span
                      className="flex min-h-[96px] items-center gap-4 rounded-[21px] py-4 pr-4 pl-5"
                      style={{ background: `radial-gradient(90% 130% at 100% 50%, rgba(${tint},0.20), transparent 62%), color-mix(in srgb, var(--text) 3%, var(--bg))` }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[18px] leading-tight font-semibold tracking-[-0.02em]">{c.title}</span>
                        <span className="mt-1 block text-[13.5px] leading-snug text-muted">{c.help}</span>
                      </span>
                      <AnimatedIcon name={k} tint={tint} size={60} play={i} />
                    </span>
                  </motion.button>
                );
              })}
            </section>

            {/* Extra link buttons the owner added (name and URL) */}
            {!!data.links?.length && (
              <section aria-label="More from us" className="mt-3.5 space-y-3.5 px-4">
                {data.links.map((l, i) => {
                  const host = (() => { try { return l.url.startsWith("http") ? new URL(l.url).hostname.replace(/^www\./, "") : l.url.replace(/^(tel|mailto):/, ""); } catch { return ""; } })();
                  return (
                    <motion.a
                      key={l.url + i}
                      {...rise(5 + order.length + i)}
                      whileTap={reduce ? undefined : { scale: 0.98 }}
                      href={l.url}
                      target={l.url.startsWith("http") ? "_blank" : undefined}
                      rel="noopener"
                      className="block w-full rounded-[26px] p-1.5 text-left ring-1 ring-line"
                      style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--text) 5%, var(--surface)), var(--surface))", boxShadow: "0 18px 40px -24px rgba(0,0,0,0.7), inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent)" }}
                    >
                      <span className="flex min-h-[88px] items-center gap-4 rounded-[21px] py-4 pr-4 pl-5" style={{ background: "radial-gradient(90% 130% at 100% 50%, rgba(148,163,184,0.18), transparent 62%), color-mix(in srgb, var(--text) 3%, var(--bg))" }}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[18px] leading-tight font-semibold tracking-[-0.02em]">{l.label}</span>
                          {host && <span className="mt-1 block truncate text-[13.5px] text-muted">{host}</span>}
                        </span>
                        <AnimatedIcon name="link" tint="148, 163, 184" size={56} play={i} />
                      </span>
                    </motion.a>
                  );
                })}
              </section>
            )}

            {/* 8. Google reviews strip */}
            {data.reviews.length > 0 && (
              <section className="mt-9">
                <h2 className="mb-3 px-5 text-[13px] font-semibold tracking-wide text-muted uppercase">What guests say on Google</h2>
                <Marquee seconds={50} pausable label="Google reviews">
                  {data.reviews.map((r, i) => (
                    <figure key={i} className="mr-3 w-64 shrink-0 rounded-[20px] p-4 ring-1 ring-line" style={{ background: "var(--surface)" }}>
                      <div className="mb-1.5 flex gap-0.5" aria-label={`${r.rating} stars`}>
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} size={13} className={s < r.rating ? "fill-amber-400 text-amber-400" : "text-muted"} />
                        ))}
                      </div>
                      <blockquote className="line-clamp-2 text-[13px] leading-snug">{r.body}</blockquote>
                      <figcaption className="mt-2 text-xs text-muted">{r.author}</figcaption>
                    </figure>
                  ))}
                </Marquee>
              </section>
            )}
          </>
        )}

        {outlets.length > 1 && (
          <button type="button" onClick={() => setOutletsOpen(true)} className="mt-8 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm ring-1 ring-line" style={{ background: "var(--surface)" }}>
            <span className="flex items-center gap-3"><Store size={18} aria-hidden className="text-muted" /><span><span className="block font-semibold text-fg">Our {outlets.length} outlets</span><span className="block text-xs text-muted">Find the one nearest to you</span></span></span>
            <ChevronRight size={16} aria-hidden />
          </button>
        )}

        {hubHref && (
          <a href={hubHref} className="mt-8 flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-sm ring-1 ring-line" style={{ background: "var(--surface)" }}>
            <span><span className="block font-semibold text-fg">More places and offers in Jaipur</span><span className="block text-xs text-muted">See what is on near you</span></span>
            <ChevronRight size={16} aria-hidden />
          </a>
        )}

        {/* 9. Footer */}
        <footer className="mt-12 flex justify-center">
          <a href="https://taprizz.in" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs text-muted ring-1 ring-line" style={{ background: "var(--surface)" }}>
            <Mark size={18} />
            Powered by <span className="font-semibold text-fg">Taprizz</span>
            <ChevronRight size={12} />
          </a>
        </footer>
      </main>

      {/* Sheets */}
      <Sheet open={outletsOpen} onClose={closeOutlets} title={`Our ${outlets.length} outlets`}>
        <ul className="space-y-4">
          {outlets.map((o, i) => {
            const safe = (u?: string) => (u && /^https:\/\//.test(u) ? u : null);
            const wa = o.whatsapp ? o.whatsapp.replace(/\D/g, "") : "";
            return (
              <li key={o.name + i} className="overflow-hidden rounded-2xl ring-1 ring-line" style={{ background: "var(--surface-2, var(--surface))" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {safe(o.image_url) && <img src={o.image_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
                <div className="p-3.5">
                  <p className="font-semibold text-fg">{o.name}</p>
                  {(o.address || o.city) && <p className="mt-0.5 text-xs text-muted">{[o.address?.replace(/[,\s]+$/, ""), o.city].filter(Boolean).join(", ")}</p>}
                  <div className="mt-2.5 flex gap-2">
                    {safe(o.map_url) && <a href={o.map_url} target="_blank" rel="noopener" aria-label={`Directions to ${o.name}`} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-line"><MapPin size={17} /></a>}
                    {safe(o.instagram) && <a href={o.instagram} target="_blank" rel="noopener" aria-label={`${o.name} on Instagram`} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-line"><Instagram size={17} /></a>}
                    {wa.length >= 10 && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" aria-label={`WhatsApp ${o.name}`} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-line"><MessageCircle size={17} /></a>}
                    {o.phone && <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${o.name}`} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-line"><Phone size={17} /></a>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Sheet>
      <Sheet open={open === "review"} onClose={close} title="Review us on Google">
        <ReviewFlow data={data} code={code} visitor={visitor} onPrivateFeedback={data.features.complaints ? () => setOpen("complaint") : undefined} />
      </Sheet>
      <Sheet open={open === "complaint"} onClose={close} title="Raise a complaint">
        <FeedbackForm kind="complaint" clientId={client.id} code={data.plate?.code ?? null} visitor={visitor} onDone={close} />
      </Sheet>
      <Sheet open={open === "suggestion"} onClose={close} title="Any suggestions?">
        <FeedbackForm kind="suggestion" clientId={client.id} code={data.plate?.code ?? null} onDone={close} />
      </Sheet>
      <Sheet open={open === "wifi"} onClose={close} title="Connect to Wi-Fi">
        {open === "wifi" && client.socials.wifi_name && <WifiSheet name={client.socials.wifi_name} password={client.socials.wifi_password ?? ""} />}
      </Sheet>
      <Sheet open={open === "staff"} onClose={close} title="Our team">
        {open === "staff" && <StaffSheet staff={data.extras?.staff ?? []} clientId={client.id} code={data.plate?.code ?? null} visitor={visitor} canReport={!!data.features.complaints} onDone={close} />}
      </Sheet>
      <Sheet open={postersOpen} onClose={closePosters} title="What is new">
        {postersOpen && <PostersSheet posters={data.extras?.posters ?? []} />}
      </Sheet>
      {data.live && !!data.features.call_server && !!data.plate?.label && <CallServerButton clientId={client.id} code={data.plate.code} table={data.plate.label} />}
      {data.live && !!data.extras?.posters.length && !postersOpen && !open && !gate && !outletsOpen && <NewPill onOpen={() => setPostersOpen(true)} />}
      <Sheet open={gate} onClose={() => { setGate(false); setPending(null); }} title="Before we start">
        {gate && <VisitorGate clientId={client.id} businessName={client.name} onDone={(v) => { setVisitor(v); setGate(false); setOpen(pending); setPending(null); }} />}
      </Sheet>
      <Sheet open={open === "creators"} onClose={close} title="Creators corner">
        {open === "creators" && <CreatorsSheet clientId={client.id} businessName={client.name} instagramUrl={client.socials.instagram} onDone={close} />}
      </Sheet>
      <Sheet open={open === "offers"} onClose={close} title="Offers right now">
        <ul className="space-y-3">
          {data.offers.map((o) => (
            <li key={o.id} className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="font-semibold">{o.title}</p>
              {o.details && <p className="mt-1 text-sm text-muted">{o.details}</p>}
              {o.ends_at && <p className="mt-2 text-xs text-muted">Till {new Date(o.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={open === "events"} onClose={close} title="Upcoming events">
        <ul className="space-y-3">
          {data.events.map((e, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border border-line bg-surface-2 p-4">
              <div className="w-12 shrink-0 text-center">
                <p className="text-xs uppercase text-muted">{new Date(e.starts_at).toLocaleDateString("en-IN", { month: "short" })}</p>
                <p className="text-xl font-bold">{new Date(e.starts_at).getDate()}</p>
              </div>
              <div>
                <p className="font-semibold">{e.title}</p>
                {e.details && <p className="mt-1 text-sm text-muted">{e.details}</p>}
                <p className="mt-1 text-xs text-muted">{new Date(e.starts_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
