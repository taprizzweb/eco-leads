"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PlaceCard, type NearPlace } from "./PlaceCard";

type State = "idle" | "asking" | "loading" | "done" | "denied";

/** "Places near you": asks for the phone's location once, then lists everything listed within 5 km, nearest first. */
export function NearMe({ radius = 5 }: { radius?: number }) {
  const [state, setState] = useState<State>("idle");
  const [places, setPlaces] = useState<NearPlace[]>([]);

  const find = useCallback(() => {
    if (!navigator.geolocation) return setState("denied");
    setState("asking");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setState("loading");
      const { data } = await supabaseBrowser().rpc("hub_nearby_places", { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_radius_km: radius, p_exclude: null, p_cat: null });
      setPlaces(Array.isArray(data) ? (data as NearPlace[]) : []);
      setState("done");
    }, () => setState("denied"), { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }, [radius]);

  // If the person has already allowed location for this site, there is nothing to ask: show the places at once.
  useEffect(() => {
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((r) => { if (r.state === "granted") find(); }).catch(() => {});
  }, [find]);

  return (
    <section aria-label="Places near you" className="space-y-4">
      {state !== "done" && (
        <div className="d-card flex flex-col items-center gap-3 px-5 py-7 text-center" style={{ borderRadius: 24 }}>
          <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--d-chip-bg)" }}><LocateFixed size={22} aria-hidden /></span>
          <div>
            <p className="text-[17px] font-semibold" style={{ color: "var(--d-text)" }}>See what is around you</p>
            <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Cafes, salons, gyms and more within {radius} km, with the offers running there today. Your location is used only to find places and is not saved.</p>
          </div>
          <button type="button" className="d-btn d-btn-p !min-h-12 w-full max-w-xs" onClick={find} disabled={state === "asking" || state === "loading"}>
            {state === "asking" || state === "loading" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <LocateFixed size={16} aria-hidden />} Show places near me
          </button>
          {state === "denied" && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>We could not get your location. Allow it in your browser settings, or choose an area below.</p>}
        </div>
      )}
      {state === "done" && (
        places.length === 0
          ? <div className="d-card p-6 text-center text-sm" style={{ color: "var(--d-muted)", borderRadius: 24 }}>No listed places within {radius} km of you yet. Choose an area below to see the rest of Jaipur.</div>
          : (<>
              <h2 className="text-base font-semibold" style={{ color: "var(--d-text)" }}>{places.length} place{places.length === 1 ? "" : "s"} within {radius} km</h2>
              <ul className="space-y-4">{places.map((p) => <li key={p.slug}><PlaceCard p={p} /></li>)}</ul>
            </>)
      )}
    </section>
  );
}
