"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./Toast";

type Offer = { id: string; title: string; details: string | null; starts_at: string | null; ends_at: string | null };

// The one place to announce an offer. What is added here shows on the guest page strip and on the mini link at the same time.
export function AnnouncementsBoard({ clientId, initial, today }: { clientId: string; initial: Offer[]; today: string }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [offers, setOffers] = useState(initial);
  const [d, setD] = useState({ title: "", details: "", starts_at: "", ends_at: "" });
  const [err, setErr] = useState("");

  async function add() {
    if (!d.title.trim()) return setErr("Give the offer a short title, like HAPPY HOURS.");
    if (d.starts_at && d.ends_at && d.ends_at < d.starts_at) return setErr("The end date is before the start date.");
    const { data, error } = await sb.from("offers").insert({ client_id: clientId, title: d.title.trim().toUpperCase(), details: d.details.trim() || null, starts_at: d.starts_at || null, ends_at: d.ends_at || null }).select("id, title, details, starts_at, ends_at").single();
    if (error || !data) return toast("The offer did not save. Please try again.", true);
    setOffers((o) => [data as Offer, ...o]); setD({ title: "", details: "", starts_at: "", ends_at: "" }); setErr(""); toast("Offer is live");
  }
  async function remove(id: string) {
    const { error } = await sb.from("offers").delete().eq("id", id);
    if (error) return toast("The offer was not removed. Please try again.", true);
    setOffers((o) => o.filter((x) => x.id !== id)); toast("Offer removed");
  }
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {offers.length === 0 && <li className="d-card px-4 py-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>No offer is live right now.</li>}
        {offers.map((o) => {
          const ended = o.ends_at && o.ends_at < today;
          return (
            <li key={o.id} className="d-card flex items-center gap-3 p-3" style={{ opacity: ended ? 0.6 : 1 }}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{o.title}</p>
                {o.details && <p className="text-sm" style={{ color: "var(--d-muted)" }}>{o.details}</p>}
                <p className="mt-1 text-xs" style={{ color: ended ? "var(--d-red)" : "var(--d-muted)" }}>{ended ? "Ended" : o.ends_at ? `Till ${new Date(o.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "No end date"}</p>
              </div>
              <button type="button" onClick={() => remove(o.id)} aria-label={`Remove ${o.title}`} className="d-btn d-btn-s !px-2.5"><Trash2 size={16} /></button>
            </li>
          );
        })}
      </ul>
      <form className="d-card grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label className="block text-sm">Title<input className="d-input mt-1" value={d.title} maxLength={30} placeholder="HAPPY HOURS" onChange={(e) => { setD({ ...d, title: e.target.value }); setErr(""); }} /></label>
        <label className="block text-sm">Details<input className="d-input mt-1" value={d.details} maxLength={80} placeholder="20% off on all beverages, 4 to 7 pm" onChange={(e) => setD({ ...d, details: e.target.value })} /></label>
        <label className="block text-sm">Starts (optional)<input type="date" className="d-input mt-1" value={d.starts_at} onChange={(e) => setD({ ...d, starts_at: e.target.value })} /></label>
        <label className="block text-sm">Ends (optional)<input type="date" className="d-input mt-1" min={d.starts_at || today} value={d.ends_at} onChange={(e) => setD({ ...d, ends_at: e.target.value })} /></label>
        {err && <p className="text-sm sm:col-span-2" style={{ color: "var(--d-red)" }}>{err}</p>}
        <button className="d-btn d-btn-p sm:col-span-2"><Plus size={16} /> Announce this offer</button>
      </form>
    </div>
  );
}
