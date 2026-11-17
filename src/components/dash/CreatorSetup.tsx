"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ALL_RANGES, defaultShots, mentionsReviews, normHandle, type CreatorSettings } from "@/lib/creators";
import { useToast } from "./Toast";

export function CreatorSetup({ clientId, businessType, initial }: { clientId: string; businessType: string | null; initial: CreatorSettings }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const b = initial.brief ?? {};
  const [f, setF] = useState({
    intro: b.intro ?? "",
    shots: Array.from({ length: 5 }, (_, i) => b.shots?.[i] ?? ""),
    tags: b.tags ?? "", location: b.location ?? "", best_hours: b.best_hours ?? "", avoid: b.avoid ?? "",
    barter: initial.barter ?? "", cap: String(initial.monthly_cap ?? 8),
    ranges: initial.ranges ?? ALL_RANGES, blackout: initial.blackout_days ?? [], welcome: (initial.always_welcome ?? []).join(", "),
  });
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((s) => ({ ...s, [k]: v })); if (err) setErr(""); };
  const sample = defaultShots(businessType);

  async function save() {
    const texts = [f.intro, ...f.shots, f.tags, f.location, f.best_hours, f.avoid, f.barter];
    if (texts.some((t) => mentionsReviews(t))) return setErr("Do not mention Google or reviews in the brief or the offer. Creators must never be promised anything for a review.");
    const cap = Math.max(0, Math.min(200, parseInt(f.cap) || 0));
    const settings: CreatorSettings = {
      brief: { intro: f.intro.trim(), shots: f.shots.map((s) => s.trim()).filter(Boolean), tags: f.tags.trim(), location: f.location.trim(), best_hours: f.best_hours.trim(), avoid: f.avoid.trim() },
      barter: f.barter.trim(), monthly_cap: cap, ranges: f.ranges.length ? f.ranges : ALL_RANGES, blackout_days: f.blackout,
      always_welcome: f.welcome.split(/[,\s]+/).map(normHandle).filter((h) => /^[a-z0-9._]{1,30}$/.test(h)),
    };
    setBusy(true);
    const { error } = await sb.from("clients").update({ creator_settings: settings }).eq("id", clientId);
    setBusy(false);
    if (error) return toast("Your setup did not save. Please try again.", true);
    toast("Creators corner saved. It is live on your page now.");
  }

  const L = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>{label}</span>{hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{hint}</span>}<span className="mt-1.5 block">{children}</span></label>
  );

  return (
    <form className="d-card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
      <div>
        <h2 className="font-semibold">Creators corner setup</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>You write this once. Creators read it on your page before they ask to collab.</p>
      </div>
      <L label="Welcome line" hint="optional"><textarea className="d-input" rows={2} maxLength={240} value={f.intro} onChange={(e) => set("intro", e.target.value)} placeholder="We love local creators. Here is what we would love to see." /></L>
      <fieldset>
        <legend className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Five shot ideas</legend>
        <div className="mt-1.5 space-y-2">
          {f.shots.map((s, i) => <input key={i} aria-label={`Shot idea ${i + 1}`} className="d-input" maxLength={80} value={s} onChange={(e) => set("shots", f.shots.map((x, j) => (j === i ? e.target.value : x)))} placeholder={sample[i]} />)}
        </div>
        <button type="button" className="mt-2 text-xs underline underline-offset-4" style={{ color: "var(--d-muted)" }} onClick={() => set("shots", Array.from({ length: 5 }, (_, i) => sample[i] ?? ""))}>Fill with suggestions for your business type</button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <L label="Tags to use"><input className="d-input" maxLength={120} value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="@yourcafe #yourcity" /></L>
        <L label="Location to tag"><input className="d-input" maxLength={80} value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Your Cafe, Area" /></L>
        <L label="Best hours to film"><input className="d-input" maxLength={80} value={f.best_hours} onChange={(e) => set("best_hours", e.target.value)} placeholder="11 am to 1 pm, weekdays" /></L>
        <L label="What not to film"><input className="d-input" maxLength={120} value={f.avoid} onChange={(e) => set("avoid", e.target.value)} placeholder="Other guests' faces, the kitchen" /></L>
        <L label="Offer for each visit" hint="barter, never cash"><input className="d-input" maxLength={120} value={f.barter} onChange={(e) => set("barter", e.target.value)} placeholder="One coffee and one dessert" /></L>
        <L label="Collabs you will approve a month" hint="0 means no limit"><input type="number" min={0} max={200} className="d-input" value={f.cap} onChange={(e) => set("cap", e.target.value)} /></L>
      </div>
      <fieldset>
        <legend className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Follower ranges you welcome</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ALL_RANGES.map((r) => {
            const on = f.ranges.includes(r);
            return <button type="button" key={r} aria-pressed={on} onClick={() => set("ranges", on ? f.ranges.filter((x) => x !== r) : [...f.ranges, r])} className="d-btn !min-h-10 !px-4 !text-[13px]" style={on ? { background: "var(--d-text)", color: "var(--d-bg)" } : { background: "var(--d-bg)", color: "var(--d-sub)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>{r}</button>;
          })}
        </div>
      </fieldset>
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Days with no creators</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {f.blackout.map((d) => <span key={d} className="d-raise flex items-center gap-1 py-1 pr-1 pl-3 text-sm" style={{ color: "var(--d-text)" }}>{new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}<button type="button" aria-label={`Remove ${d}`} className="grid h-8 w-8 place-items-center" style={{ color: "var(--d-muted)" }} onClick={() => set("blackout", f.blackout.filter((x) => x !== d))}><X size={14} /></button></span>)}
        </div>
        <div className="mt-2 flex gap-2">
          <label className="sr-only" htmlFor="bd">Add a blocked day</label>
          <input id="bd" type="date" className="d-input !w-52" min={new Date().toISOString().slice(0, 10)} value={day} onChange={(e) => setDay(e.target.value)} />
          <button type="button" className="d-btn d-btn-s" disabled={!day || f.blackout.includes(day)} onClick={() => { set("blackout", [...f.blackout, day].sort()); setDay(""); }}><Plus size={15} /> Block day</button>
        </div>
      </div>
      <L label="Creators who are always welcome" hint="Instagram handles, separated by commas"><input className="d-input" value={f.welcome} onChange={(e) => set("welcome", e.target.value)} placeholder="foodiepriya, jaipurwalks" /></L>
      {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
      <p className="text-xs" style={{ color: "var(--d-muted)" }}>Rules built in: this is barter only, posts must be labelled as a collaboration or ad, Taprizz never pays creators, and nobody is ever promised anything for a Google review.</p>
      <button className="d-btn d-btn-p" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Save setup</button>
    </form>
  );
}
