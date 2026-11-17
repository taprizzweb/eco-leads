"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Paperclip, Info } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ALL_RANGES, defaultShots, type Brief } from "@/lib/creators";
import { chip, glassCard, glassInput, pillPrimary, pillSoft } from "./ui";

type Info = { brief: Brief; barter: string | null; intro: string | null; ranges: string[]; blackout_days: string[] };
type Tab = "brief" | "collab" | "post";
const MAX_BYTES = 10 * 1024 * 1024;
const PLANS = ["Reel", "Story", "Photo post", "Video review of the place"];

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted">{label}{hint && <span className="ml-1.5 text-xs opacity-80">{hint}</span>}</label>
      {children}
    </div>
  );
}

export function CreatorsSheet({ clientId, businessType, businessName, onDone }: { clientId: string; businessType: string | null; businessName: string; onDone: () => void }) {
  const sb = supabaseBrowser();
  const [tab, setTab] = useState<Tab>("brief");
  const [info, setInfo] = useState<Info | null | undefined>(undefined);

  useEffect(() => {
    sb.rpc("guest_creators_info", { p_client: clientId }).then(({ data }) => setInfo((data as Info) ?? null));
  }, [sb, clientId]);

  if (info === undefined) return <div className="grid h-32 place-items-center"><Loader2 className="animate-spin" /></div>;
  if (info === null) return <p className="py-8 text-center text-muted">Creators corner is not open right now.</p>;

  const tabs: { id: Tab; label: string }[] = [{ id: "brief", label: "Shoot brief" }, { id: "collab", label: "Collab with us" }, { id: "post", label: "Submit your post" }];
  const shots = info.brief.shots?.filter(Boolean).length ? info.brief.shots! : defaultShots(businessType);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Creators corner" className="flex gap-1 rounded-full p-1 bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-11 flex-1 rounded-full px-2 text-[13px] font-semibold transition ${tab === t.id ? "bg-fg text-bg shadow" : "text-muted"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "brief" && (
        <div className="space-y-4">
          {info.brief.intro || info.intro ? <p className="text-[15px] leading-relaxed">{info.brief.intro || info.intro}</p> : <p className="text-[15px] leading-relaxed text-muted">Welcome. Here is what we would love to see from your visit to {businessName}.</p>}
          <section className={glassCard}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Five shots we love</h3>
            <ol className="space-y-2.5">
              {shots.slice(0, 5).map((s, i) => (
                <li key={i} className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold bg-[color-mix(in_srgb,var(--text)_12%,transparent)]">{i + 1}</span><span className="text-[15px]">{s}</span></li>
              ))}
            </ol>
          </section>
          <dl className="grid gap-3 text-[15px]">
            {info.brief.tags && <div><dt className="text-xs uppercase tracking-wide text-muted">Tag and use</dt><dd>{info.brief.tags}</dd></div>}
            {info.brief.location && <div><dt className="text-xs uppercase tracking-wide text-muted">Location tag</dt><dd>{info.brief.location}</dd></div>}
            {info.brief.best_hours && <div><dt className="text-xs uppercase tracking-wide text-muted">Best hours to film</dt><dd>{info.brief.best_hours}</dd></div>}
            {info.brief.avoid && <div><dt className="text-xs uppercase tracking-wide text-muted">Please do not film</dt><dd>{info.brief.avoid}</dd></div>}
            {info.barter && <div><dt className="text-xs uppercase tracking-wide text-muted">What you get for a visit</dt><dd>{info.barter}</dd></div>}
          </dl>
          <p className="flex gap-2 rounded-2xl p-3 text-[13px] text-muted bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"><Info size={16} className="mt-0.5 shrink-0" />Collabs here are barter. Please label your post as a collaboration or add #ad or #collab. We do not pay for posts.</p>
          <button className={pillPrimary} onClick={() => setTab("collab")}>Ask to collab</button>
        </div>
      )}
      {tab === "collab" && <CollabForm clientId={clientId} info={info} onDone={onDone} />}
      {tab === "post" && <PostForm clientId={clientId} onDone={onDone} />}
    </div>
  );
}

function CollabForm({ clientId, info, onDone }: { clientId: string; info: Info; onDone: () => void }) {
  const sb = supabaseBrowser();
  const ranges = (info.ranges?.length ? info.ranges : ALL_RANGES);
  const [f, setF] = useState({ name: "", handle: "", range: "", city: "", phone: "", plan: "Reel", day: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => { setF((s) => ({ ...s, [k]: v })); if (err) setErr(""); };
  const today = new Date().toISOString().slice(0, 10);

  async function submit() {
    if (!f.name.trim()) return setErr("Add your name.");
    if (!f.handle.trim()) return setErr("Add your Instagram handle.");
    if (!f.range) return setErr("Pick your follower range.");
    if (f.phone.replace(/\D/g, "").length < 10) return setErr("Enter your 10-digit WhatsApp number.");
    if (!f.consent) return setErr("Please tick the box so the business can message you.");
    if (f.day && info.blackout_days?.includes(f.day)) return setErr("We are not hosting creators on that day. Please pick another.");
    setBusy(true);
    const { error } = await sb.rpc("guest_submit_collab", { p_client: clientId, p_name: f.name, p_handle: f.handle, p_range: f.range, p_city: f.city || null, p_phone: f.phone, p_plan: f.plan, p_day: f.day || null, p_consent: f.consent });
    setBusy(false);
    if (error) return setErr(error.message || "Your request did not send. Check your connection and try again.");
    setSent(true);
  }

  if (sent) return (
    <div className="space-y-4 py-4 text-center">
      <CheckCircle2 size={48} className="mx-auto text-green-400" />
      <p className="text-lg font-semibold">Request sent</p>
      <p className="text-sm text-muted">If it is a fit, the owner will message you on WhatsApp with a visit code and the offer.</p>
      <button className={pillSoft} onClick={onDone}>Back to the page</button>
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
      <Field id="c-name" label="Your name"><input id="c-name" className={glassInput} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} /></Field>
      <Field id="c-handle" label="Instagram handle"><input id="c-handle" className={glassInput} value={f.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@yourname" autoCapitalize="none" maxLength={31} /></Field>
      <fieldset>
        <legend className="mb-1.5 text-sm text-muted">Followers</legend>
        <div className="flex flex-wrap gap-2">{ranges.map((r) => <button type="button" key={r} aria-pressed={f.range === r} className={chip(f.range === r)} onClick={() => set("range", r)}>{r}</button>)}</div>
      </fieldset>
      <Field id="c-city" label="City"><input id="c-city" className={glassInput} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" maxLength={60} /></Field>
      <Field id="c-phone" label="WhatsApp number"><input id="c-phone" className={glassInput} inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" maxLength={20} /></Field>
      <fieldset>
        <legend className="mb-1.5 text-sm text-muted">What will you make?</legend>
        <div className="flex flex-wrap gap-2">{PLANS.map((p) => <button type="button" key={p} aria-pressed={f.plan === p} className={chip(f.plan === p)} onClick={() => set("plan", p)}>{p}</button>)}</div>
      </fieldset>
      <Field id="c-day" label="Preferred day" hint="optional"><input id="c-day" type="date" className={glassInput} min={today} value={f.day} onChange={(e) => set("day", e.target.value)} /></Field>
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />The business may message me on WhatsApp about this collab.</label>
      {err && <p role="alert" className="text-sm text-amber-400">{err}</p>}
      <button className={pillPrimary} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />}{busy ? "Sending" : "Send collab request"}</button>
    </form>
  );
}

function PostForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const sb = supabaseBrowser();
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ handle: "", url: "", code: "", consent: false });
  const [clip, setClip] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => { setF((s) => ({ ...s, [k]: v })); if (err) setErr(""); };

  async function submit() {
    if (!f.handle.trim()) return setErr("Add your Instagram handle.");
    if (!/^https:\/\/(www\.)?instagram\.com\//i.test(f.url.trim())) return setErr("Paste the link of your reel or post. It starts with https://www.instagram.com/");
    if (!f.consent) return setErr("Please tick the box so the business can repost your clip.");
    setBusy(true);
    let path: string | null = null;
    if (clip) {
      path = `${clientId}/creators/${crypto.randomUUID()}.${clip.name.split(".").pop() || "mp4"}`;
      const { error: up } = await sb.storage.from("guest-uploads").upload(path, clip, { contentType: clip.type });
      if (up) { setBusy(false); return setErr("Your clip did not upload. Try a shorter clip, or skip it and send just the link."); }
    }
    const { error } = await sb.rpc("guest_submit_creator_post", { p_client: clientId, p_handle: f.handle, p_url: f.url.trim(), p_media: path, p_consent: f.consent, p_code: f.code || null });
    setBusy(false);
    if (error) return setErr(error.message || "Your post did not send. Check your connection and try again.");
    setSent(true);
  }

  if (sent) return (
    <div className="space-y-4 py-4 text-center">
      <CheckCircle2 size={48} className="mx-auto text-green-400" />
      <p className="text-lg font-semibold">Thank you</p>
      <p className="text-sm text-muted">The owner will check your post and may share it, tagging you.</p>
      <button className={pillSoft} onClick={onDone}>Back to the page</button>
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
      <Field id="p-handle" label="Instagram handle"><input id="p-handle" className={glassInput} value={f.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@yourname" autoCapitalize="none" maxLength={31} /></Field>
      <Field id="p-url" label="Link to your reel or post"><input id="p-url" className={glassInput} inputMode="url" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.instagram.com/reel/..." /></Field>
      <Field id="p-code" label="Visit code" hint="optional, from your WhatsApp message"><input id="p-code" className={glassInput} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="TZ-1A2B3" maxLength={12} /></Field>
      <div>
        <input ref={file} type="file" accept="video/*,image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ""; if (!x) return; if (x.size > MAX_BYTES) return setErr("That file is over 10 MB. Send just the link, or a shorter clip."); setClip(x); setErr(""); }} />
        <button type="button" className={pillSoft} onClick={() => file.current?.click()}><Paperclip size={16} />{clip ? clip.name : "Attach the raw clip (optional, up to 10 MB)"}</button>
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />The business may repost this and tag me.</label>
      {err && <p role="alert" className="text-sm text-amber-400">{err}</p>}
      <button className={pillPrimary} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />}{busy ? "Sending" : "Submit my post"}</button>
    </form>
  );
}
