"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Crown, Gift, MapPin, Medal, Star } from "lucide-react";
import { HUB_PATH, MIN_GUESTS, OFFER_KINDS } from "@/lib/hub-shared";

export type NearPlace = {
  slug: string; name: string; tagline: string | null; logo_url: string | null; area: string | null; category: string | null;
  distance_km: number | null; rating: number; guests: number; photos: string[]; rank?: number | null;
  offer: { kind: string; ends_on: string; follow_first: boolean; title: string | null } | null;
};
const daysLeft = (iso: string) => Math.max(0, Math.round((new Date(iso + "T00:00:00+05:30").getTime() - Date.now()) / 864e5));
export const offerLine = (o: NonNullable<NearPlace["offer"]>) => {
  const d = daysLeft(o.ends_on);
  return `${o.title ?? OFFER_KINDS[o.kind] ?? "Special offer"} · ${d <= 0 ? "ends today" : d === 1 ? "1 day left" : `${d} days left`}`;
};

/** Small cards: the photos fade into each other. */
function FadePhotos({ photos, alt, fallback }: { photos: string[]; alt: string; fallback?: string | null }) {
  const list = photos.length ? photos : fallback ? [fallback] : [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % list.length), 3200 + Math.random() * 1200);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return <div className="absolute inset-0" style={{ background: "linear-gradient(145deg, #3a2a20, #1b1410)" }} />;
  return (
    <>
      {list.map((u, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt={k === 0 ? alt : ""} loading={k === 0 ? "eager" : "lazy"} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000" style={{ opacity: k === i ? 1 : 0 }} />
      ))}
    </>
  );
}

/** Big cards: the photos slide along by themselves. A finger can swipe them back; after a pause they carry on. */
function SlidePhotos({ photos, alt, fallback }: { photos: string[]; alt: string; fallback?: string | null }) {
  const list = photos.length ? photos : fallback ? [fallback] : [];
  const box = useRef<HTMLDivElement>(null);
  const touched = useRef(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => {
      const el = box.current;
      if (!el || Date.now() - touched.current < 6000) return;
      const next = Math.round(el.scrollLeft / el.clientWidth) + 1;
      el.scrollTo({ left: next >= list.length ? 0 : next * el.clientWidth, behavior: "smooth" });
    }, 3600 + Math.random() * 800);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return <div className="absolute inset-0" style={{ background: "linear-gradient(145deg, #3a2a20, #1b1410)" }} />;
  return (
    <div ref={box} onPointerDown={() => { touched.current = Date.now(); }}
      className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
      {list.map((u, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt={k === 0 ? alt : ""} loading={k === 0 ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full shrink-0 snap-center object-cover" />
      ))}
    </div>
  );
}

const TIER = {
  1: { ring: "#f5c542", glow: "0 18px 50px -18px rgba(245,197,66,0.65)", bg: "linear-gradient(160deg, #6b5210, #2a210a)", label: "Gold" },
  2: { ring: "#d7dce2", glow: "0 18px 50px -20px rgba(215,220,226,0.45)", bg: "linear-gradient(160deg, #5b616b, #23262b)", label: "Silver" },
  3: { ring: "#d08a52", glow: "0 18px 50px -20px rgba(208,138,82,0.5)", bg: "linear-gradient(160deg, #6a3f1f, #271709)", label: "Bronze" },
} as const;

/** A complete card for a place: photos on top, name and area over them, a short description, and the offer running there along the bottom. */
export function PlaceCard({ p, size = "big" }: { p: NearPlace; size?: "big" | "mid" | "mini" }) {
  const big = size === "big";
  const enough = p.guests >= MIN_GUESTS;
  const tier = big && p.rank && p.rank <= 3 ? TIER[p.rank as 1 | 2 | 3] : null;
  const dims = big ? "aspect-[6/5] w-full rounded-[24px]" : size === "mid" ? "mr-3 aspect-[3/4] w-[180px] rounded-[20px]" : "mr-3 aspect-[3/4] w-[128px] rounded-[18px]";
  return (
    <div className={big ? "relative rounded-[28px] p-[3px]" : "contents"} style={tier ? { background: tier.bg, boxShadow: tier.glow, outline: `1.5px solid ${tier.ring}`, outlineOffset: -1 } : undefined}>
      <Link href={`${HUB_PATH}/${p.slug}`} draggable={false} aria-label={`${p.name}, ${p.area ?? ""}${p.offer ? `. ${offerLine(p.offer)}` : ""}`}
        className={`relative block shrink-0 overflow-hidden text-white ring-1 ring-white/10 active:scale-[0.995] ${dims}`} style={{ background: "#1b1410" }}>
        {big ? <SlidePhotos photos={p.photos} alt={p.name} fallback={p.logo_url} /> : <FadePhotos photos={p.photos} alt={p.name} fallback={p.logo_url} />}
        <div className="pointer-events-none absolute inset-0" style={{ background: big ? "linear-gradient(180deg, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.9) 100%)" : "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.82) 100%)" }} />
        <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 ${big ? "p-3.5" : "p-2.5"}`}>
          <div className="min-w-0 flex-1">
            {big && p.rank === 1 && <span className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase" style={{ background: "linear-gradient(180deg, #ffe08a, #f5c542)", color: "#3b2a00" }}><Crown size={13} aria-hidden /> No. 1</span>}
            {big && p.rank && p.rank >= 2 && p.rank <= 3 && <span className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase" style={{ background: tier!.ring, color: "#1a1410" }}><Medal size={13} aria-hidden /> No. {p.rank}</span>}
            {big && p.rank && p.rank > 3 && <span className="mb-1 inline-block rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold backdrop-blur-md">No. {p.rank}</span>}
            <p className={`truncate font-bold tracking-[-0.03em] drop-shadow ${big ? "text-[20px] leading-tight" : size === "mid" ? "text-[15px] leading-tight" : "text-[13px] leading-tight"}`}>{p.name}</p>
            <p className={`flex items-center gap-1 truncate opacity-90 ${big ? "mt-0.5 text-[13px]" : "mt-0.5 text-[10.5px]"}`}><MapPin size={big ? 13 : 10} aria-hidden />{[p.area, big ? p.category : null, p.distance_km != null ? `${p.distance_km} km` : null].filter(Boolean).join(" · ")}</p>
          </div>
          {big && enough && <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[13px] font-semibold backdrop-blur-md"><Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />{p.rating.toFixed(1)}</span>}
        </div>
        {big && p.tagline && <p className="pointer-events-none absolute inset-x-0 bottom-[3.7rem] line-clamp-1 px-3.5 text-[13px] leading-snug font-medium drop-shadow" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>{p.tagline}</p>}
        {p.offer && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 ${big ? "m-2.5 rounded-xl px-3 py-2" : "m-1.5 rounded-xl px-2 py-1.5"}`} style={{ background: "rgba(255,255,255,0.93)", color: "#1a1410" }}>
            <Gift size={big ? 16 : 12} className="shrink-0 text-rose-600" aria-hidden />
            <span className={`min-w-0 flex-1 font-semibold ${big ? "truncate text-[13px]" : "line-clamp-2 text-[10px] leading-tight"}`}>{big ? offerLine(p.offer) : (p.offer.title ?? OFFER_KINDS[p.offer.kind] ?? "Special offer")}</span>
            {big && <span aria-hidden className="text-lg leading-none">›</span>}
          </div>
        )}
      </Link>
    </div>
  );
}
