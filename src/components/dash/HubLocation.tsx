"use client";

import { useState } from "react";
import { Crosshair, Loader2, MapPin, Star } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./Toast";

type Rival = { slug: string; name: string; area: string | null; category: string | null; distance_km: number; rating: number; guests: number; offer: { kind: string; title: string | null } | null };

// Where the business is (so guests nearby find it, and its own page can show who is around), the terms shown with an offer, and who else is close.
export function HubLocation({ clientId, lat, lng, terms, rivals, canEdit }: { clientId: string; lat: number | null; lng: number | null; terms: string | null; rivals: Rival[]; canEdit: boolean }) {
  const toast = useToast();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(lat != null && lng != null ? { lat, lng } : null);
  const [t, setT] = useState(terms ?? "");
  const [busy, setBusy] = useState(false);

  function here() {
    if (!navigator.geolocation) return toast("This phone cannot share its location", true);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); toast("Location captured. Press Save."); },
      () => { setBusy(false); toast("Please allow location for this page, then try again", true); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function save() {
    if (!pos) return toast("Set your location first", true);
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("hub_set_location", { p_client: clientId, p_lat: pos.lat, p_lng: pos.lng, p_terms: t });
    setBusy(false);
    toast(error ? "That did not save. Please try again." : "Saved", !!error);
  }
  return (
    <div className="space-y-4">
      <section className="d-card space-y-3 p-4" aria-label="Your location">
        <h2 className="font-semibold">Your place on the map</h2>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>{pos ? `Saved: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}. Guests within 5 km can find you, and your page shows the places around you.` : "Not set yet. Stand inside your shop and press the button, so guests nearby can find you."}</p>
        {canEdit && <button type="button" className="d-btn d-btn-s" onClick={here} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />} Use my current location</button>}
        <label className="block text-sm">Terms shown with your offers (optional)
          <textarea className="d-input mt-1" rows={3} maxLength={600} value={t} onChange={(e) => setT(e.target.value)} disabled={!canEdit} placeholder="For example: One offer per table. Not valid with other offers." />
        </label>
        {canEdit && <button type="button" className="d-btn d-btn-p" onClick={save} disabled={busy}>Save</button>}
      </section>

      <section className="d-card p-4" aria-label="Places near you">
        <h2 className="font-semibold">Around you, within 5 km</h2>
        <p className="mb-3 text-sm" style={{ color: "var(--d-muted)" }}>Places of your kind that guests near you also see. Use it to keep your offer and rating ahead.</p>
        {rivals.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>{pos ? "No one of your kind is listed nearby yet." : "Set your location to see who is nearby."}</p> : (
          <ul className="space-y-2">
            {rivals.map((r) => (
              <li key={r.slug} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line)" }}>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.name}</p><p className="flex items-center gap-1 truncate text-xs" style={{ color: "var(--d-muted)" }}><MapPin size={11} />{r.distance_km} km{r.area ? ` · ${r.area}` : ""}{r.offer ? ` · offer: ${r.offer.title ?? "running"}` : " · no offer"}</p></div>
                <span className="flex items-center gap-1 text-sm font-semibold"><Star size={13} className="fill-amber-400 text-amber-400" />{r.guests >= 30 ? r.rating.toFixed(1) : "New"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
