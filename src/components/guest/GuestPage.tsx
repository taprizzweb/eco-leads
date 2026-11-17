"use client";

import { useCallback, useState } from "react";
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

  return (
    <div style={theme.vars as React.CSSProperties} className="guest-root min-h-dvh bg-bg text-fg" data-theme={theme.dark ? "dark" : "light"}>
      <main className="mx-auto max-w-md pb-10">
        {/* 1. Header */}
        <header className="flex flex-col items-center px-4 pt-10 pb-5 text-center">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt="" width={76} height={76} className="h-[76px] w-[76px] rounded-full border border-line object-cover" />
          ) : (
            <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-surface-2 text-2xl font-bold">{client.name.slice(0, 1)}</div>
          )}
          <h1 className="mt-3 text-[22px] font-bold leading-tight">{client.name}</h1>
          {client.tagline && <p className="mt-1 text-sm text-muted">{client.tagline}</p>}
          {data.plate?.label && (
            <span className="mt-3 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">{data.plate.label}</span>
          )}
        </header>

        {/* 2. Social row */}
        {socials.length > 0 && (
          <nav aria-label="Find us" className="flex justify-center gap-3 px-4 pb-6">
            {socials.slice(0, 6).map(({ href, label, Icon }) => (
              <a key={label} href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noopener" aria-label={label}
                 className="grid h-[46px] w-[46px] place-items-center rounded-full border border-line text-fg/90">
                <Icon size={20} strokeWidth={1.75} />
              </a>
            ))}
          </nav>
        )}

        {/* 10. Paused: plate never looks dead, guest can still review */}
        {!data.live ? (
          <section className="px-4">
            {client.google_review_url && (
              <a href={client.google_review_url} target="_blank" rel="noopener" className="rainbow-border block">
                <span className="flex items-center justify-between rounded-[20px] bg-surface px-5 py-6">
                  <span>
                    <span className="block text-lg font-semibold">Review us on Google</span>
                    <span className="block text-[13px] text-muted">It takes less than a minute</span>
                  </span>
                  <Star className="fill-yellow-400 text-yellow-400" size={32} />
                </span>
              </a>
            )}
          </section>
        ) : (
          <>
            {/* 3. Offers strip */}
            {data.features.offers_strip && data.offers.length > 0 && (
              <div className="mb-4 py-2.5" style={{ background: "var(--strip)", color: "var(--strip-text)" }}>
                <Marquee seconds={30} label="Current offers">
                  {data.offers.map((o) => (
                    <span key={o.id} className="flex items-center whitespace-nowrap px-4 text-[13px] font-semibold uppercase tracking-wide">
                      {o.title}{o.details ? `: ${o.details}` : ""}
                      <span className="pl-8 opacity-60">•</span>
                    </span>
                  ))}
                </Marquee>
              </div>
            )}

            {/* 4. Photo gallery (swipe only, no autoplay) */}
            {data.gallery.length > 0 && (
              <section aria-label="Photos" className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3">
                {data.gallery.map((g, i) => (
                  <figure key={g.url} className="relative aspect-square w-[82%] shrink-0 snap-center overflow-hidden rounded-[18px] bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.caption ?? ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
                    {(g.label || g.caption) && (
                      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                        <span className="text-sm font-medium">{g.caption}</span>
                        {g.label && <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-black">{g.label}</span>}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </section>
            )}

            {/* 5. Keyword strip */}
            {data.features.keywords && client.keywords.length > 0 && (
              <div className="mb-5">
                <Marquee seconds={40} label="About this place">
                  {client.keywords.map((k) => (
                    <span key={k} className="mr-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "var(--pill)", color: "var(--pill-text)" }}>
                      {k}
                    </span>
                  ))}
                </Marquee>
              </div>
            )}

            {/* 6. Action cards */}
            <section aria-label="What would you like to do?" className="space-y-3 px-4">
              {order.map((k) => {
                const c = copyFor(k);
                const tint = CARD_TINTS[k];
                const inner = (
                  <span className="flex min-h-[88px] items-center gap-4 rounded-[20px] px-5 py-4 text-left"
                        style={{ background: k === "review" ? "var(--surface)" : `linear-gradient(0deg, rgba(${tint},0.08), rgba(${tint},0.08)), var(--surface)` }}>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold ${k === "review" ? "text-lg" : "text-base"}`}>{c.title}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">{c.help}</span>
                    </span>
                    <AnimatedIcon name={k} tint={tint} size={k === "review" ? 60 : 56} />
                  </span>
                );
                return k === "review" ? (
                  <button key={k} onClick={() => onCard(k)} className="rainbow-border block w-full">{inner}</button>
                ) : (
                  <button key={k} onClick={() => onCard(k)} className="block w-full rounded-[20px] border border-line">{inner}</button>
                );
              })}
            </section>

            {/* 8. Google reviews strip */}
            {data.reviews.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 px-4 text-sm font-semibold text-muted">What guests say on Google</h2>
                <Marquee seconds={50} pausable label="Google reviews">
                  {data.reviews.map((r, i) => (
                    <figure key={i} className="mr-3 w-64 shrink-0 rounded-2xl border border-line bg-surface p-4">
                      <div className="mb-1 flex gap-0.5" aria-label={`${r.rating} stars`}>
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} size={14} className={s < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"} />
                        ))}
                      </div>
                      <blockquote className="line-clamp-2 text-[13px]">{r.body}</blockquote>
                      <figcaption className="mt-2 text-xs text-muted">{r.author}</figcaption>
                    </figure>
                  ))}
                </Marquee>
              </section>
            )}
          </>
        )}

        {/* 9. Footer */}
        <footer className="mt-10 text-center text-xs text-muted">
          <a href="https://taprizz.in" className="inline-flex min-h-11 items-center gap-1">
            Powered by <span className="font-semibold">Taprizz</span>
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
