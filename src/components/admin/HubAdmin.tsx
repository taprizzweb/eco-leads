"use client";

import { useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugify } from "@/lib/features";
import { OFFER_KINDS } from "@/lib/hub-shared";
import { useToast } from "@/components/dash/Toast";

export type AdminOffer = { id: string; client_id: string; kind: string; title: string; details: string | null; starts_on: string; ends_on: string; follow_first: boolean; status: string; admin_note: string | null; clients: { name: string } | null };
export type AdminSponsor = { id: string; offer_id: string; area: string | null; starts_on: string; ends_on: string; hub_offers: { title: string; clients: { name: string } | null } | null };
export type AdminClient = { id: string; name: string; slug: string; hub_listed: boolean; hub_area: string | null };
export type AdminArea = { id: string; name: string; sort: number; active: boolean };

const ist = (o = 0) => new Date(Date.now() + o * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dmy = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const T = { color: "var(--d-text)" } as const;
const M = { color: "var(--d-muted)" } as const;

export function HubAdmin({ offers: o0, sponsors: s0, clients: c0, areas: a0, withPlate }: { offers: AdminOffer[]; sponsors: AdminSponsor[]; clients: AdminClient[]; areas: AdminArea[]; withPlate: string[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [tab, setTab] = useState<"offers" | "sponsors" | "listed" | "areas">("offers");
  const [offers, setOffers] = useState(o0);
  const [sponsors, setSponsors] = useState(s0);
  const [clients, setClients] = useState(c0);
  const [areas, setAreas] = useState(a0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [sp, setSp] = useState({ offer: "", area: "", from: ist(), to: ist(7) });
  const [newArea, setNewArea] = useState("");
  const today = ist();
  const pending = offers.filter((o) => o.status === "pending");
  const liveOffers = offers.filter((o) => o.status === "live" && o.ends_on >= today);
  const areaName = (id: string | null) => (id ? areas.find((a) => a.id === id)?.name ?? id : "Poora Jaipur");
  const shown = useMemo(() => clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60), [clients, q]);

  async function decide(o: AdminOffer, status: "live" | "rejected") {
    const note = (notes[o.id] ?? "").trim();
    if (status === "rejected" && !note) return toast("Reject karne ka karan ek line mein likho.", true);
    setBusy(o.id);
    const { error } = await sb.from("hub_offers").update({ status, admin_note: note || null }).eq("id", o.id);
    setBusy(null);
    if (error) return toast("Save nahi hua. Dobara try karo.", true);
    setOffers((s) => s.map((x) => (x.id === o.id ? { ...x, status, admin_note: note || null } : x)));
    toast(status === "live" ? "Offer chalu ho gayi" : "Offer reject kar di");
  }
  async function addSponsor() {
    if (!sp.offer) return toast("Pehle ek chalti hui offer chuno.", true);
    if (sp.to < sp.from) return toast("Aakhri tareekh shuru se pehle nahi ho sakti.", true);
    setBusy("sp");
    const { data, error } = await sb.from("hub_sponsors").insert({ offer_id: sp.offer, area: sp.area || null, starts_on: sp.from, ends_on: sp.to }).select("id, offer_id, area, starts_on, ends_on, hub_offers(title, clients(name))").single();
    setBusy(null);
    if (error || !data) return toast("Sponsored jagah save nahi hui.", true);
    setSponsors((s) => [data as unknown as AdminSponsor, ...s]);
    toast("Sponsored jagah lag gayi");
  }
  async function delSponsor(id: string) {
    const { error } = await sb.from("hub_sponsors").delete().eq("id", id);
    if (error) return toast("Hata nahi paaye.", true);
    setSponsors((s) => s.filter((x) => x.id !== id));
  }
  async function saveClient(c: AdminClient, patch: Partial<AdminClient>) {
    const next = { ...c, ...patch };
    if (next.hub_listed && !next.hub_area) return toast("Listing ke liye pehle area chuno.", true);
    if (next.hub_listed && !c.hub_listed && !withPlate.includes(c.id)) return toast("Pehle is business ka plate lagao. Bina setup ke listing nahi hoti.", true);
    setBusy(c.id);
    const { error } = await sb.from("clients").update({ hub_listed: next.hub_listed, hub_area: next.hub_area }).eq("id", c.id);
    setBusy(null);
    if (error) return toast("Save nahi hua.", true);
    setClients((s) => s.map((x) => (x.id === c.id ? next : x)));
    toast(next.hub_listed ? `${c.name} Gulabi Nagar page par hai` : `${c.name} Gulabi Nagar page se hat gayi`);
  }
  async function addArea() {
    const name = newArea.trim(); const id = slugify(name);
    if (name.length < 2 || !/^[a-z0-9-]{2,40}$/.test(id)) return toast("Area ka naam 2 se 40 akshar ka likho.", true);
    setBusy("area");
    const { error } = await sb.from("hub_areas").insert({ id, name, sort: 100 });
    setBusy(null);
    if (error) return toast(/duplicate|unique/i.test(error.message) ? "Ye area pehle se hai." : "Area save nahi hua.", true);
    setAreas((s) => [...s, { id, name, sort: 100, active: true }]); setNewArea(""); toast("Area jud gaya");
  }
  async function toggleArea(a: AdminArea) {
    const { error } = await sb.from("hub_areas").update({ active: !a.active }).eq("id", a.id);
    if (error) return toast("Save nahi hua.", true);
    setAreas((s) => s.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
  }

  const tabs: [typeof tab, string][] = [["offers", `Offers${pending.length ? ` (${pending.length})` : ""}`], ["sponsors", "Sponsored"], ["listed", "Listed jagah"], ["areas", "Areas"]];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <a className="d-btn d-btn-s" href="/jaipur" target="_blank" rel="noopener"><ExternalLink size={15} /> Live Gulabi Nagar page dekho</a>
        <span className="text-sm" style={M}>Customer ko taprizz.in/jaipur par dikhta hai. Instagram bio, plate ka card aur WhatsApp status se khulta hai.</span>
      </div>
      <div className="d-seg w-fit max-w-full overflow-x-auto" role="group" aria-label="Gulabi Nagar page">
        {tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "offers" && (
        <div className="space-y-3">
          {pending.length === 0 && <div className="d-card p-8 text-center text-sm" style={M}>Koi offer check karne ko nahi hai.</div>}
          {pending.map((o) => (
            <div key={o.id} className="d-card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2"><b style={T}>{o.clients?.name ?? "Business"}</b><span className="d-chip" style={{ ["--c" as string]: "var(--d-amber)" }}>{OFFER_KINDS[o.kind]}</span><span className="text-xs" style={M}>{dmy(o.starts_on)} se {dmy(o.ends_on)}{o.follow_first ? " · Instagram follow zaroori" : ""}</span></div>
              <p className="font-medium" style={T}>{o.title}</p>
              {o.details && <p className="text-sm" style={{ color: "var(--d-sub)" }}>{o.details}</p>}
              <input aria-label="Reject ka karan (ya note)" className="d-input" maxLength={300} placeholder="Reject karna ho to karan likho" value={notes[o.id] ?? ""} onChange={(e) => setNotes((s) => ({ ...s, [o.id]: e.target.value }))} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="d-btn d-btn-p" disabled={busy === o.id} onClick={() => decide(o, "live")}>{busy === o.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve</button>
                <button type="button" className="d-btn d-btn-s" disabled={busy === o.id} onClick={() => decide(o, "rejected")}><X size={15} /> Reject</button>
              </div>
            </div>
          ))}
          {liveOffers.length > 0 && <h2 className="pt-2 text-base font-semibold" style={T}>Abhi chal rahi offers</h2>}
          {liveOffers.map((o) => (
            <div key={o.id} className="d-raise flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><b className="block truncate" style={T}>{o.clients?.name} · {o.title}</b><span className="text-xs" style={M}>{OFFER_KINDS[o.kind]} · {dmy(o.starts_on)} se {dmy(o.ends_on)}</span></div>
              <button type="button" className="d-btn d-btn-s !min-h-10 !px-3 !text-[13px]" onClick={() => { setNotes((s) => ({ ...s, [o.id]: notes[o.id] || "Band kar di gayi" })); void decide(o, "rejected"); }}>Band karo</button>
            </div>
          ))}
        </div>
      )}

      {tab === "sponsors" && (
        <div className="space-y-4">
          <div className="d-card space-y-3 p-4">
            <h2 className="font-semibold" style={T}>Sponsored jagah lagao</h2>
            <p className="text-sm" style={M}>Hub ke upar &quot;Sponsored&quot; ke label ke saath dikhegi. Ranking par koi asar nahi. Pehle us business ki offer approve karo.</p>
            <label className="block text-sm"><span style={T}>Offer</span>
              <select className="d-input mt-1.5" value={sp.offer} onChange={(e) => setSp({ ...sp, offer: e.target.value })}><option value="">Offer chuno</option>{liveOffers.map((o) => <option key={o.id} value={o.id}>{o.clients?.name} · {o.title}</option>)}</select></label>
            <label className="block text-sm"><span style={T}>Kahan dikhe</span>
              <select className="d-input mt-1.5" value={sp.area} onChange={(e) => setSp({ ...sp, area: e.target.value })}><option value="">Poora Jaipur</option>{areas.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm"><span style={T}>Kab se</span><input type="date" className="d-input mt-1.5" value={sp.from} onChange={(e) => setSp({ ...sp, from: e.target.value })} /></label>
              <label className="block text-sm"><span style={T}>Kab tak</span><input type="date" className="d-input mt-1.5" min={sp.from} value={sp.to} onChange={(e) => setSp({ ...sp, to: e.target.value })} /></label>
            </div>
            <button type="button" className="d-btn d-btn-p" disabled={busy === "sp"} onClick={addSponsor}>{busy === "sp" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Lagao</button>
          </div>
          {sponsors.length === 0 ? <div className="d-card p-8 text-center text-sm" style={M}>Abhi koi sponsored jagah nahi.</div> : sponsors.map((s) => (
            <div key={s.id} className="d-raise flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><b className="block truncate" style={T}>{s.hub_offers?.clients?.name} · {s.hub_offers?.title}</b><span className="text-xs" style={M}>{areaName(s.area)} · {dmy(s.starts_on)} se {dmy(s.ends_on)}{s.ends_on < today ? " · khatam" : ""}</span></div>
              <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Hatao" style={M} onClick={() => delSponsor(s.id)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "listed" && (
        <div className="space-y-3">
          <div className="relative"><Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={M} aria-hidden /><input aria-label="Business dhoondho" className="d-input !pl-10" placeholder="Business dhoondho" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {shown.map((c) => (
            <div key={c.id} className="d-raise flex flex-wrap items-center gap-3 p-3">
              <b className="min-w-0 flex-1 truncate" style={T}>{c.name}</b>
              {c.hub_listed && <a className="d-btn d-btn-s !min-h-10 !px-3 !text-[13px]" href={`/jaipur/${c.slug}`} target="_blank" rel="noopener" aria-label={`${c.name} ka live page`}><ExternalLink size={14} /> Live</a>}
              <select aria-label={`${c.name} ka area`} className="d-input !w-44 !min-h-10 !text-[13px]" value={c.hub_area ?? ""} disabled={busy === c.id} onChange={(e) => saveClient(c, { hub_area: e.target.value || null, hub_listed: e.target.value ? c.hub_listed : false })}>
                <option value="">Area chuno</option>{areas.filter((a) => a.active || a.id === c.hub_area).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <button type="button" role="switch" aria-checked={c.hub_listed} aria-label={`${c.name} Gulabi Nagar page par`} disabled={busy === c.id || !c.hub_area || (!c.hub_listed && !withPlate.includes(c.id))} className="d-btn d-btn-s !min-h-10 !px-4 !text-[13px]" onClick={() => saveClient(c, { hub_listed: !c.hub_listed })}>{c.hub_listed ? "Listed" : withPlate.includes(c.id) ? "List karo" : "Plate nahi"}</button>
            </div>
          ))}
          {shown.length === 0 && <div className="d-card p-8 text-center text-sm" style={M}>Koi business nahi mila.</div>}
        </div>
      )}

      {tab === "areas" && (
        <div className="space-y-3">
          <div className="flex gap-2"><input aria-label="Naya area" className="d-input min-w-0 flex-1" maxLength={60} placeholder="Naya area, jaise Jagatpura" value={newArea} onChange={(e) => setNewArea(e.target.value)} /><button type="button" className="d-btn d-btn-p" disabled={busy === "area"} onClick={addArea}><Plus size={15} /> Jodo</button></div>
          {areas.map((a) => (
            <div key={a.id} className="d-raise flex items-center gap-3 p-3"><b className="min-w-0 flex-1 truncate" style={T}>{a.name}</b>
              <button type="button" className="d-btn d-btn-s !min-h-10 !px-4 !text-[13px]" onClick={() => toggleArea(a)}>{a.active ? "Chalu" : "Band"}</button></div>
          ))}
        </div>
      )}
    </div>
  );
}
