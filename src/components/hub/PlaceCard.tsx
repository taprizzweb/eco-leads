"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, MapPin, Star } from "lucide-react";
import { HUB_PATH, MIN_GUESTS, OFFER_KINDS } from "@/lib/hub-shared";

export type NearPlace = {
  slug: string; name: string; tagline: string | null; logo_url: string | null; area: string | null; category: string | null;
  distance_km: number; rating: number; guests: number; photos: string[];
  offer: { kind: string; ends_on: string; follow_first: boolean; title: string | null } | null;
};
const daysLeft = (iso: string) => Math.max(0, Math.round((new Date(iso + "T00:00:00+05:30").getTime() - Date.now()) / 864e5));
export const offerLine = (o: NonNullable<NearPlace["offer"]>) => {
  const d = daysLeft(o.ends_on);
  return `${o.title ?? OFFER_KINDS[o.kind] ?? "Special offer"} · ${d <= 0 ? "ends today" : d === 1 ? "1 day left" : `${d} days left`}`;
};

/** The photos of one place fade into each other, a few seconds apart. */
function Photos({ photos, alt, fallback }: { photos: string[]; alt: string; fallback?: string | null }) {
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

/** A complete card for a place: its photos, name and area on top, and the offer running there along the bottom. */
export function PlaceCard({ p, size = "big" }: { p: NearPlace; size?: "big" | "mini" }) {
  const big = size === "big";
  const enough = p.guests >= MIN_GUESTS;
  return (
    <Link href={`${HUB_PATH}/${p.slug}`} aria-label={`${p.name}, ${p.area ?? ""}${p.offer ? `. ${offerLine(p.offer)}` : ""}`}
      className={`relative block shrink-0 overflow-hidden text-white ring-1 ring-white/10 active:scale-[0.99] ${big ? "aspect-[4/4.6] w-full rounded-[26px]" : "mr-3 aspect-[3/4] w-[128px] rounded-[18px]"}`} style={{ background: "#1b1410" }}>
      <Photos photos={p.photos} alt={p.name} fallback={p.logo_url} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.82) 100%)" }} />
      <div className={`absolute inset-x-0 top-0 flex items-start gap-2 ${big ? "p-4" : "p-2.5"}`}>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold tracking-[-0.03em] drop-shadow ${big ? "text-[22px] leading-tight" : "text-[13px] leading-tight"}`}>{p.name}</p>
          <p className={`flex items-center gap-1 truncate opacity-90 ${big ? "mt-0.5 text-[13px]" : "mt-0.5 text-[10px]"}`}><MapPin size={big ? 13 : 10} aria-hidden />{[p.area, big ? p.category : null, `${p.distance_km} km`].filter(Boolean).join(" · ")}</p>
        </div>
        {big && enough && <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[13px] font-semibold backdrop-blur-md"><Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />{p.rating.toFixed(1)}</span>}
      </div>
      {p.offer && (
        <div className={`absolute inset-x-0 bottom-0 flex items-center gap-2 ${big ? "m-3 rounded-2xl px-3.5 py-3" : "m-1.5 rounded-xl px-2 py-1.5"}`} style={{ background: "rgba(255,255,255,0.92)", color: "#1a1410" }}>
          <Gift size={big ? 18 : 12} className="shrink-0 text-rose-600" aria-hidden />
          <span className={`min-w-0 flex-1 font-semibold ${big ? "truncate text-[14px]" : "line-clamp-2 text-[10px] leading-tight"}`}>{big ? offerLine(p.offer) : (p.offer.title ?? OFFER_KINDS[p.offer.kind] ?? "Special offer")}</span>
          {big && <span aria-hidden className="text-lg leading-none">›</span>}
        </div>
      )}
    </Link>
  );
}
