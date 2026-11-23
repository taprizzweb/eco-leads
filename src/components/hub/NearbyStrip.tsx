"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PlaceCard, type NearPlace } from "./PlaceCard";
import { HUB_NAME, HUB_PATH } from "@/lib/hub-shared";

/** On a business's own page: places within 5 km of it, as small photo cards that keep sliding past. Nothing is shown when nobody is nearby. */
export function NearbyStrip({ lat, lng, exclude, radius = 5 }: { lat: number; lng: number; exclude: string; radius?: number }) {
  const [places, setPlaces] = useState<NearPlace[]>([]);
  useEffect(() => {
    let live = true;
    supabaseBrowser().rpc("hub_nearby_places", { p_lat: lat, p_lng: lng, p_radius_km: radius, p_exclude: exclude, p_cat: null }).then(({ data }) => { if (live && Array.isArray(data)) setPlaces(data as NearPlace[]); });
    return () => { live = false; };
  }, [lat, lng, radius, exclude]);
  if (places.length === 0) return null;
  const moving = places.length >= 3;
  // each half of the loop must be wider than the screen, so a gap never shows
  const half = Array.from({ length: moving ? Math.max(1, Math.ceil(7 / places.length)) : 1 }).flatMap((_, r) => places.map((p) => ({ p, key: `${r}-${p.slug}` })));
  return (
    <section aria-label={`${HUB_NAME}, places near you`} className="mb-5">
      <div className="mb-2.5 flex items-baseline justify-between px-5">
        <h2 className="text-[15px] font-semibold">Near you</h2>
        <Link href={HUB_PATH} className="text-xs text-muted">{HUB_NAME} · See all</Link>
      </div>
      {moving ? (
        <div className="photo-marquee overflow-hidden pl-4">
          <div className="photo-track" style={{ ["--photo-duration" as string]: `${Math.max(30, half.length * 6)}s` }}>
            <div className="flex shrink-0">{half.map((h) => <PlaceCard key={h.key} p={h.p} size="mini" />)}</div>
            <div className="flex shrink-0" aria-hidden>{half.map((h) => <PlaceCard key={"d" + h.key} p={h.p} size="mini" />)}</div>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar flex overflow-x-auto px-4">{places.map((p) => <PlaceCard key={p.slug} p={p} size="mini" />)}</div>
      )}
    </section>
  );
}
