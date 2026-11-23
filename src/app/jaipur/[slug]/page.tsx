import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Phone, Star, Instagram, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { HUB_NAME, HUB_PATH, MIN_GUESTS, loadPlace, loadPlaceChain } from "@/lib/hub";
import { HubBack } from "@/components/hub/HubBack";
import { OfferUnlock } from "@/components/hub/OfferUnlock";
import { PlaceHero } from "@/components/hub/PlaceHero";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await loadPlace((await params).slug);
  return p ? { title: `${p.name} · ${HUB_NAME}`, description: `${p.name}, ${p.area}. Guest ratings and the offers running today.` } : { title: HUB_NAME };
}

const safeUrl = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : null);

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [p, chain] = await Promise.all([loadPlace(slug), loadPlaceChain(slug)]);
  if (!p) notFound();
  const insta = safeUrl(p.instagram);
  const review = safeUrl(p.review_url);
  const maps = safeUrl(p.maps) ?? (p.lat != null && p.lng != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.area} Jaipur`)}`);
  const month = new Date().toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
  const enough = p.guests >= MIN_GUESTS;
  const top = enough && p.rank != null && p.rank <= 10;
  const act = "d-btn d-btn-s !min-h-12 justify-center";
  return (
    <div className="space-y-5">
      <HubBack />

      <PlaceHero photos={p.photos ?? []} name={p.name}>
        {top && <span className="d-chip w-fit" style={{ ["--c" as string]: "var(--d-amber)" }}><b>{p.rank}</b> Top 10 · {p.area} · {month}</span>}
        <h1 className="text-[30px] leading-[1.05] font-bold tracking-[-0.045em]">{p.name}</h1>
        <p className="flex items-center gap-1.5 text-sm opacity-90"><MapPin size={14} aria-hidden />{p.area}{p.category ? ` · ${p.category}` : ""}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          {enough ? <><Star size={15} className="fill-amber-400 text-amber-400" aria-hidden /><b>{p.rating.toFixed(1)}</b><span className="opacity-80">· {p.guests} guests have rated</span></> : <span className="opacity-80">New here. {p.guests} guest{p.guests === 1 ? " has" : "s have"} rated so far.</span>}
        </p>
      </PlaceHero>

      {p.tagline && <p className="px-1 text-[16px] leading-relaxed" style={{ color: "var(--d-sub)" }}>{p.tagline}</p>}

      <div className={`grid gap-2.5 ${p.phone && review ? "grid-cols-2" : "grid-cols-1"}`}>
        <a className={act} href={maps} target="_blank" rel="noopener"><MapPin size={16} aria-hidden /> Directions</a>
        {p.phone && <a className={act} href={`tel:${p.phone}`}><Phone size={16} aria-hidden /> Call</a>}
        {review && <a className={act} href={review} target="_blank" rel="noopener"><MessageSquareText size={16} aria-hidden /> Write a review</a>}
        {insta && <a className={act} href={insta} target="_blank" rel="noopener"><Instagram size={16} aria-hidden /> Instagram</a>}
      </div>

      {p.offers.length > 0 && (
        <section aria-label="Offers" className="space-y-3">
          <h2 className="px-1 text-base font-semibold" style={{ color: "var(--d-text)" }}>Offers right now</h2>
          {p.offers.map((o) => <OfferUnlock key={o.id} offer={o} instagram={insta} terms={p.terms} />)}
        </section>
      )}

      {chain && (
        <Link href={`${HUB_PATH}/company/${chain.slug}`} className="d-raise flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm" style={{ borderRadius: 16, color: "var(--d-text)" }}>
          <span><b className="block font-semibold">{chain.name}</b><span className="block text-xs" style={{ color: "var(--d-muted)" }}>See all {chain.branches} branches</span></span>
          <span aria-hidden>›</span>
        </Link>
      )}
      <p className="text-xs" style={{ color: "var(--d-muted)" }}>The rating comes from guests who scanned a plate here, over the last 90 days. When you claim an offer you get a code to show at the counter.</p>
    </div>
  );
}
