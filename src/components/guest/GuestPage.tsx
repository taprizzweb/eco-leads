"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Instagram, Facebook, MapPin, Phone, ChevronRight, Star, UtensilsCrossed, Bike } from "lucide-react";
import type { CardKey, GuestPageData } from "@/lib/types";
import { CARD_TINTS, getTheme } from "@/lib/themes";
import { AnimatedIcon } from "./AnimatedIcon";
import { Sheet } from "./Sheet";
import { ReviewFlow } from "./ReviewFlow";
import { FeedbackForm } from "./FeedbackForm";

const DEFAULT_ORDER: CardKey[] = ["menu", "review", "complaint", "suggestion", "moment", "offers", "events", "membership", "creators"];

const DEFAULT_COPY: Record<CardKey, { title: string; help: string }> = {
  menu: { title: "View menu", help: "Browse what is cooking today" },
  review: { title: "Review us on Google", help: "Three taps, and the draft is yours to edit" },
  complaint: { title: "Raise a complaint", help: "Goes privately to the management" },
  suggestion: { title: "Any suggestions?", help: "One idea can improve the next visit" },
  moment: { title: "Share your moment", help: "A photo or clip of your visit, 30 seconds" },
  offers: { title: "Check offers", help: "What is running at the store right now" },
  events: { title: "Upcoming events", help: "Nights, workshops and gatherings" },
  membership: { title: "Become a member", help: "Perks for regulars" },
  creators: { title: "Creators corner", help: "Collaborate with us or get a shoot brief" },
};

// Flows built so far. Cards for later build steps stay hidden until their flow exists,
// so a guest never taps into a dead end.
const BUILT: CardKey[] = ["menu", "review", "complaint", "suggestion", "offers", "events"];

function cardEnabled(k: CardKey, d: GuestPageData): boolean {
  const f = d.features;
  switch (k) {
    case "menu": return !!f.menu && !!d.client.menu_url;
    case "review": return !!f.review && !!d.client.google_review_url;
    case "complaint": return !!f.complaints;
    case "suggestion": return !!f.suggestions;
    case "moment": return !!f.moments;
    case "offers": return !!f.offers_card && d.offers.length > 0;
    case "events": return !!f.events && d.events.length > 0;
    case "membership": return !!f.membership;
    case "creators": return !!f.creators;
  }
}

function Marquee({ children, seconds, pausable, label }: { children: React.ReactNode; seconds: number; pausable?: boolean; label: string }) {
  return (
    <div
      className={`marquee-scroll no-scrollbar overflow-hidden ${pausable ? "marquee-pausable" : ""}`}
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

export function GuestPage({ data, code }: { data: GuestPageData; code: string }) {
  const theme = getTheme(data.client.theme);
  const [open, setOpen] = useState<CardKey | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const reduce = useReducedMotion();
  const { client } = data;

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
    client.socials.zomato && { href: client.socials.zomato, label: "Zomato", Icon: UtensilsCrossed },
    client.socials.swiggy && { href: client.socials.swiggy, label: "Swiggy", Icon: Bike },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Instagram }[];

  const onCard = (k: CardKey) => {
    if (k === "menu" && client.menu_url) {
      window.open(client.menu_url, "_blank", "noopener");
      return;
    }
    setOpen(k);
  };

  // Cards and blocks rise in one after another when the page opens (still for reduced motion).
  const rise = (i: number) =>
    reduce
      ? {}
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

        {/* 2. Social row */}
        {socials.length > 0 && (
          <motion.nav {...rise(1)} aria-label="Find us" className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-5">
            {socials.slice(0, 6).map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("tel:") ? undefined : "_blank"}
                rel="noopener"
                aria-label={label}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-line transition active:scale-90"
                style={{ background: "var(--surface)" }}
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

            {/* 4. Photo gallery (swipe only, no autoplay) */}
            {data.gallery.length > 0 && (
              <motion.section {...rise(3)} aria-label="Photos" className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3">
                {data.gallery.map((g, i) => (
                  <figure key={g.url} className="relative aspect-[4/5] w-[62%] shrink-0 snap-start overflow-hidden rounded-[22px] ring-1 ring-line" style={{ background: "var(--surface)" }}>
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
                ))}
              </motion.section>
            )}

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

        {/* 9. Footer */}
        <footer className="mt-12 flex justify-center">
          <a href="https://taprizz.in" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs text-muted ring-1 ring-line" style={{ background: "var(--surface)" }}>
            <svg width="16" height="16" viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="13" fill="currentColor" opacity="0.85" />
              <path d="M7.4 14.6c.7-3.6 2.9-6 6.6-6.7" fill="none" stroke="var(--bg)" strokeWidth="2.3" strokeLinecap="round" />
              <circle cx="16.9" cy="16.6" r="1.9" fill="var(--bg)" />
            </svg>
            Powered by <span className="font-semibold text-fg">Taprizz</span>
            <ChevronRight size={12} />
          </a>
        </footer>
      </main>

      {/* Sheets */}
      <Sheet open={open === "review"} onClose={close} title="Review us on Google">
        <ReviewFlow data={data} code={code} onPrivateFeedback={data.features.complaints ? () => setOpen("complaint") : undefined} />
      </Sheet>
      <Sheet open={open === "complaint"} onClose={close} title="Raise a complaint">
        <FeedbackForm kind="complaint" clientId={client.id} code={data.plate?.code ?? null} onDone={close} />
      </Sheet>
      <Sheet open={open === "suggestion"} onClose={close} title="Any suggestions?">
        <FeedbackForm kind="suggestion" clientId={client.id} code={data.plate?.code ?? null} onDone={close} />
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
