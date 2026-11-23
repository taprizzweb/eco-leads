"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, Lock, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { OFFER_KINDS } from "@/lib/hub-shared";
import { useToast } from "./Toast";

export type MyOffer = { id: string; kind: string; title: string; details: string | null; starts_on: string; ends_on: string; follow_first: boolean; status: string; admin_note: string | null };
type Check = { state: "valid" | "used" | "expired" | "unknown" | "redeemed"; title?: string; details?: string | null };

const ist = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dmy = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function JaipurBoard({ clientId, slug, areaId, listed, areaName, categoryLabel, rank, total, rating, guests, stats, offers, hasInstagram }: {
  clientId: string; slug: string; areaId: string | null; listed: boolean; areaName: string | null; categoryLabel: string | null; rank: number | null; total: number; rating: number; guests: number;
  stats: { views: number; follows: number; claims: number; redeems: number }; offers: MyOffer[]; hasInstagram: boolean;
}) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ kind: "diwali", title: "", details: "", starts: ist(), ends: ist(7), follow: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Check | null>(null);
  const today = ist();

  if (!listed) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <Lock className="mx-auto" style={{ color: "var(--d-muted)" }} />
        <h1 className="mt-4 text-xl font-semibold">You are not on Gulabi Nagar yet</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Ask the Taprizz team to add your business to the Gulabi Nagar guide. Then you can run special offers here and check guest codes at the counter.</p>
      </div>
    );
  }

  async function create() {
    setErr("");
    if (f.title.trim().length < 3) return setErr("Write the offer in one line, at least 3 characters.");
    if (f.ends < f.starts) return setErr("The end date cannot be before the start date.");
    setBusy("create");
    const { error } = await sb.rpc("hub_offer_create", { p_client: clientId, p_kind: f.kind, p_title: f.title, p_details: f.details, p_starts: f.starts, p_ends: f.ends, p_follow: hasInstagram ? f.follow : false });
    setBusy(null);
    if (error) return setErr(/45 days/.test(error.message) ? "An offer can run for 45 days at most." : /3 offers/.test(error.message) ? "You already have 3 offers open. Wait for one to end." : /past/.test(error.message) ? "Choose today or a later date to start." : "The offer did not save. Please try again.");
    setF({ ...f, title: "", details: "" });
    toast("Offer sent to the team. It appears on Gulabi Nagar as soon as it is approved.");
    router.refresh();
  }
  async function remove(o: MyOffer) {
    const { error } = await sb.from("hub_offers").delete().eq("id", o.id);
    if (error) return toast("The offer was not removed.", true);
    toast("Offer removed"); router.refresh();
  }
  async function lookup(redeem: boolean) {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return toast("Enter the guest code.", true);
    setBusy(redeem ? "redeem" : "check");
    const { data, error } = await sb.rpc(redeem ? "hub_redeem" : "hub_check_code", { p_client: clientId, p_code: c });
    setBusy(null);
    if (error) return toast("The code could not be checked. Please try again.", true);
    setRes(data as Check);
    if (redeem) router.refresh();
  }

  const stat = (n: number, label: string, sub: string) => (
    <div className="d-card p-4"><div className="text-[34px] leading-none font-bold tracking-[-0.04em]" style={{ color: "var(--d-text)" }}>{n.toLocaleString("en-IN")}</div><p className="mt-2 text-sm font-medium" style={{ color: "var(--d-text)" }}>{label}</p><p className="text-xs" style={{ color: "var(--d-muted)" }}>{sub}</p></div>
  );
  const label = "block text-sm";
  const lt = { color: "var(--d-text)" } as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Gulabi Nagar page</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>{areaName ?? "Jaipur"}{categoryLabel ? `, ${categoryLabel}` : ""}. Run special offers here and check guest codes at the counter. Everyday offers are added in Announcements and show here automatically.</p>
      </div>

      <section className="d-card flex flex-wrap items-center gap-x-6 gap-y-2 p-5" aria-label="Your rank">
        <div><span className="text-[44px] leading-none font-bold tracking-[-0.045em]" style={{ color: "var(--d-amber)" }}>{rank ? `#${rank}` : "n/a"}</span></div>
        <div className="min-w-0 flex-1"><p className="font-medium" style={{ color: "var(--d-text)" }}>{categoryLabel ?? "Places"} in {areaName}{total > 0 ? `, out of ${total}` : ""}</p>
          <p className="text-sm" style={{ color: "var(--d-muted)" }}>{guests >= 30 ? `Guest rating ${rating.toFixed(1)}, from ${guests} guests.` : `${guests} guests have rated so far. The rating shows after 30.`}</p></div>
      </section>

      <section className="d-card space-y-3 p-5" aria-labelledby="live">
        <h2 id="live" className="text-base font-semibold" style={{ color: "var(--d-text)" }}>Your live page</h2>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>This is the page guests see. Put the link in your Instagram bio, WhatsApp status or Google profile.</p>
        <div className="flex flex-wrap gap-2">
          <a className="d-btn d-btn-p" href={`/jaipur/${slug}`} target="_blank" rel="noopener"><ExternalLink size={15} /> View live page</a>
          <a className="d-btn d-btn-s" href={areaId ? `/jaipur?area=${areaId}` : "/jaipur"} target="_blank" rel="noopener"><ExternalLink size={15} /> View the Gulabi Nagar list</a>
          <button type="button" className="d-btn d-btn-s" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/jaipur/${slug}`).then(() => toast("Link copied")).catch(() => toast("Could not copy. Open the link and copy it from the address bar.", true))}><Copy size={15} /> Copy link</button>
        </div>
      </section>

      <section aria-labelledby="st">
        <h2 id="st" className="mb-3 text-base font-semibold" style={lt}>Last 30 days</h2>
        <div className="grid grid-cols-2 gap-3">
          {stat(stats.views, "people saw your offer", "on Gulabi Nagar")}
          {stat(stats.follows, "people went to Instagram", "to open the offer")}
          {stat(stats.claims, "people claimed the offer", "They got a code")}
          {stat(stats.redeems, "came to the shop", "Showed the code at the counter")}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>Your Instagram shows how many new followers you got. We only count how many people went from here to your Instagram.</p>
      </section>

      <section className="d-card space-y-3 p-5" aria-labelledby="cc">
        <h2 id="cc" className="text-base font-semibold" style={lt}>Check a guest code</h2>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>The guest shows the code at the counter. Type it here and, if the offer is right, press &quot;Mark as used&quot;. One code works only once.</p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Guest code" className="d-input min-w-0 flex-1 !text-[20px] tracking-[0.18em] uppercase" maxLength={6} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="A1B2C3" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "")); setRes(null); }} />
          <button type="button" className="d-btn d-btn-p" disabled={busy === "check"} onClick={() => lookup(false)}>{busy === "check" && <Loader2 size={15} className="animate-spin" />} Check</button>
        </div>
        {res && (
          <div className="d-raise p-4" role="status" style={{ boxShadow: `inset 0 0 0 1px ${res.state === "valid" || res.state === "redeemed" ? "var(--d-green)" : "var(--d-red)"}` }}>
            {res.state === "unknown" && <p style={lt}>This code is not valid. Ask the guest to check it.</p>}
            {res.state === "expired" && <p style={lt}>This offer has ended: {res.title}.</p>}
            {res.state === "used" && <p style={lt}>This code was already used: {res.title}.</p>}
            {res.state === "redeemed" && <p className="flex items-center gap-2 font-medium" style={{ color: "var(--d-green)" }}><Check size={16} /> Done. Give the guest the offer: {res.title}</p>}
            {res.state === "valid" && (
              <div className="space-y-2"><p className="font-medium" style={lt}>Valid code. Offer: {res.title}</p>{res.details && <p className="text-sm" style={{ color: "var(--d-sub)" }}>{res.details}</p>}
                <button type="button" className="d-btn d-btn-p" disabled={busy === "redeem"} onClick={() => lookup(true)}>{busy === "redeem" && <Loader2 size={15} className="animate-spin" />} Mark as used</button></div>
            )}
          </div>
        )}
      </section>

      <section className="d-card space-y-4 p-5" aria-labelledby="mk">
        <div><h2 id="mk" className="text-base font-semibold" style={lt}>Add a special offer</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>For big occasions only: New Year, Diwali, a launch, a new product. The team reviews it before it goes live. For everyday offers use Announcements.</p></div>
        <label className={label}><span className="font-medium" style={lt}>Occasion</span>
          <select className="d-input mt-1.5" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(OFFER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className={label}><span className="font-medium" style={lt}>The offer in one line</span>
          <input className="d-input mt-1.5" maxLength={70} placeholder="A free sweet with every coffee this Diwali" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className={label}><span className="font-medium" style={lt}>Anything else to add (optional)</span>
          <input className="d-input mt-1.5" maxLength={300} placeholder="Between 5 and 9 pm" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}><span className="font-medium" style={lt}>From</span><input type="date" className="d-input mt-1.5" min={today} value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value, ends: e.target.value > f.ends ? e.target.value : f.ends })} /></label>
          <label className={label}><span className="font-medium" style={lt}>Until</span><input type="date" className="d-input mt-1.5" min={f.starts} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></label>
        </div>
        <label className="d-raise flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm" style={lt}>
          <span>Ask guests to follow on Instagram first{!hasInstagram && <span className="block text-xs" style={{ color: "var(--d-muted)" }}>Add your Instagram link in My Page first</span>}</span>
          <input type="checkbox" className="h-5 w-5" checked={hasInstagram && f.follow} disabled={!hasInstagram} onChange={(e) => setF({ ...f, follow: e.target.checked })} />
        </label>
        {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
        <button type="button" className="d-btn d-btn-p w-full" disabled={busy === "create"} onClick={create}>{busy === "create" && <Loader2 size={16} className="animate-spin" />} Send to the team</button>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>An offer is for visiting or following only. Never give anything in return for a Google review. At most 45 days, and 3 offers at a time.</p>
      </section>

      <section aria-labelledby="my">
        <h2 id="my" className="mb-3 text-base font-semibold" style={lt}>Your offers</h2>
        {offers.length === 0 ? <div className="d-card px-6 py-10 text-center text-sm" style={{ color: "var(--d-muted)" }}>No offers yet.</div> : (
          <ul className="space-y-2.5">{offers.map((o) => {
            const ended = o.ends_on < today;
            const st = o.status === "rejected" ? ["Rejected", "var(--d-red)"] : o.status === "pending" ? ["Under review", "var(--d-amber)"] : ended ? ["Ended", "var(--d-muted)"] : ["Running", "var(--d-green)"];
            return (
              <li key={o.id} className="d-card flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="d-chip" style={{ ["--c" as string]: st[1] }}>{st[0]}</span><span className="text-xs" style={{ color: "var(--d-muted)" }}>{OFFER_KINDS[o.kind]} · {dmy(o.starts_on)} to {dmy(o.ends_on)}</span></div>
                  <p className="mt-1.5 font-medium" style={lt}>{o.title}</p>
                  {o.status === "rejected" && o.admin_note && <p className="mt-1 text-sm" style={{ color: "var(--d-sub)" }}>Team reply: {o.admin_note}</p>}</div>
                {o.status !== "live" && <button type="button" className="grid h-11 w-11 shrink-0 place-items-center" aria-label={`Remove ${o.title}`} style={{ color: "var(--d-muted)" }} onClick={() => remove(o)}><Trash2 size={16} /></button>}
              </li>
            );
          })}</ul>
        )}
      </section>
    </div>
  );
}
