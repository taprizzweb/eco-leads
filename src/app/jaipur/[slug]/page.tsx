import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Phone, Star, Instagram } from "lucide-react";
import Link from "next/link";
import { HUB_NAME, HUB_PATH, MIN_GUESTS, loadPlace, loadPlaceChain } from "@/lib/hub";
import { HubBack } from "@/components/hub/HubBack";
import { OfferUnlock } from "@/components/hub/OfferUnlock";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await loadPlace((await params).slug);
  return p ? { title: `${p.name} · ${HUB_NAME}`, description: `${p.name}, ${p.area}. Guests ki rating aur khaas offers.` } : { title: HUB_NAME };
}

const safeUrl = (u: string | null) => (u && /^https:\/\//.test(u) ? u : null);

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [p, chain] = await Promise.all([loadPlace(slug), loadPlaceChain(slug)]);
  if (!p) notFound();
  const insta = safeUrl(p.instagram);
  const maps = safeUrl(p.maps) ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.area} Jaipur`)}`;
  const month = new Date().toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
  const enough = p.guests >= MIN_GUESTS;
  const top = enough && p.rank != null && p.rank <= 10;
  return (
    <div className="space-y-5">
      <HubBack />

      <section className="d-raise flex min-h-[190px] flex-col justify-end gap-2 p-5" style={{ borderRadius: 24, background: "radial-gradient(120% 90% at 85% 0%, color-mix(in srgb, var(--d-amber) 18%, transparent), transparent 65%), var(--d-raise)" }}>
        {top && (
          <span className="d-chip w-fit" style={{ ["--c" as string]: "var(--d-amber)" }}>
            <b>{p.rank}</b> Top 10 · {p.area} · {month}
          </span>
        )}
        <h1 className="text-[30px] leading-[1.05] font-bold tracking-[-0.045em]" style={{ color: "var(--d-text)" }}>{p.name}</h1>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>{p.area}{p.category ? ` · ${p.category}` : ""}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: "var(--d-amber)" }}>
          {enough ? <><Star size={15} fill="currentColor" aria-hidden /><b>{p.rating.toFixed(1)}</b><span style={{ color: "var(--d-muted)" }}>· {p.guests} guests ne rate kiya</span></> : <span style={{ color: "var(--d-muted)" }}>Naya. Abhi {p.guests} guests ne rate kiya.</span>}
        </p>
      </section>

      {p.offers.length > 0 && (
        <section aria-label="Offers" className="space-y-3">
          {p.offers.map((o) => <OfferUnlock key={o.id} offer={o} instagram={insta} />)}
        </section>
      )}

      {chain && (
        <Link href={`${HUB_PATH}/company/${chain.slug}`} className="d-raise flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm" style={{ borderRadius: 16, color: "var(--d-text)" }}>
          <span><b className="block font-semibold">{chain.name}</b><span className="block text-xs" style={{ color: "var(--d-muted)" }}>Dekho saari {chain.branches} branches</span></span>
          <span aria-hidden>›</span>
        </Link>
      )}

      <div className="grid gap-2.5">
        {insta && <a className="d-btn d-btn-s !min-h-12" href={insta} target="_blank" rel="noopener"><Instagram size={16} aria-hidden /> Instagram dekho</a>}
        <a className="d-btn d-btn-s !min-h-12" href={maps} target="_blank" rel="noopener"><MapPin size={16} aria-hidden /> Directions, Google Maps</a>
        {p.phone && <a className="d-btn d-btn-s !min-h-12" href={`tel:${p.phone}`}><Phone size={16} aria-hidden /> Call karo</a>}
      </div>
      <p className="text-xs" style={{ color: "var(--d-muted)" }}>Rating un guests ki hai jinhone yahan plate scan karke di. Pichhle 90 din. Offer lene par ek code milta hai jo counter par dikhana hai.</p>
    </div>
  );
}
