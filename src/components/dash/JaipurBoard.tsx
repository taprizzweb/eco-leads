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
        <h1 className="mt-4 text-xl font-semibold">Aap abhi Jaipur page par nahi hain</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Taprizz team se kahiye ki aapki dukaan Jaipur ke guide mein jodein. Phir yahan se aap khaas offers laga sakte ho aur counter par code check kar sakte ho.</p>
      </div>
    );
  }

  async function create() {
    setErr("");
    if (f.title.trim().length < 3) return setErr("Offer ek line mein likho, kam se kam 3 akshar.");
    if (f.ends < f.starts) return setErr("Aakhri tareekh shuru ki tareekh se pehle nahi ho sakti.");
    setBusy("create");
    const { error } = await sb.rpc("hub_offer_create", { p_client: clientId, p_kind: f.kind, p_title: f.title, p_details: f.details, p_starts: f.starts, p_ends: f.ends, p_follow: hasInstagram ? f.follow : false });
    setBusy(null);
    if (error) return setErr(/45 days/.test(error.message) ? "Offer zyada se zyada 45 din chal sakti hai." : /3 offers/.test(error.message) ? "Aapki 3 offers pehle se khuli hain. Ek khatam hone ka intezaar karo." : /past/.test(error.message) ? "Shuru ki tareekh aaj ya baad ki rakho." : "Offer save nahi hui. Dobara try karo.");
    setF({ ...f, title: "", details: "" });
    toast("Offer team ko bhej di. Approve hote hi Jaipur page par dikhegi.");
    router.refresh();
  }
  async function remove(o: MyOffer) {
    const { error } = await sb.from("hub_offers").delete().eq("id", o.id);
    if (error) return toast("Offer hat nahi paayi.", true);
    toast("Offer hata di"); router.refresh();
  }
  async function lookup(redeem: boolean) {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return toast("Customer ka code likho.", true);
    setBusy(redeem ? "redeem" : "check");
    const { data, error } = await sb.rpc(redeem ? "hub_redeem" : "hub_check_code", { p_client: clientId, p_code: c });
    setBusy(null);
    if (error) return toast("Code check nahi ho paaya. Dobara try karo.", true);
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
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Jaipur page</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>{areaName ?? "Jaipur"}{categoryLabel ? `, ${categoryLabel}` : ""}. Yahan se khaas offer lagao aur counter par customer ka code check karo.</p>
      </div>

      <section className="d-card flex flex-wrap items-center gap-x-6 gap-y-2 p-5" aria-label="Aapka number">
        <div><span className="text-[44px] leading-none font-bold tracking-[-0.045em]" style={{ color: "var(--d-amber)" }}>{rank ? `#${rank}` : "n/a"}</span></div>
        <div className="min-w-0 flex-1"><p className="font-medium" style={{ color: "var(--d-text)" }}>{areaName} {categoryLabel ? `ke ${categoryLabel} mein` : "mein"}{total > 0 ? `, ${total} mein se` : ""}</p>
          <p className="text-sm" style={{ color: "var(--d-muted)" }}>{guests >= 30 ? `Guests ki rating ${rating.toFixed(1)}, ${guests} guests ne di.` : `Abhi ${guests} guests ne rate kiya. 30 ke baad rating dikhegi.`}</p></div>
      </section>

      <section className="d-card space-y-3 p-5" aria-labelledby="live">
        <h2 id="live" className="text-base font-semibold" style={{ color: "var(--d-text)" }}>Aapka live page</h2>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>Ye wahi page hai jo customer dekhta hai. Link Instagram bio, WhatsApp status ya Google profile mein laga sakte ho. Cafe ki plate par bhi &quot;More places and offers in Jaipur&quot; ka card isi list tak le jata hai.</p>
        <div className="flex flex-wrap gap-2">
          <a className="d-btn d-btn-p" href={`/jaipur/${slug}`} target="_blank" rel="noopener"><ExternalLink size={15} /> Live page dekho</a>
          <a className="d-btn d-btn-s" href={areaId ? `/jaipur?area=${areaId}` : "/jaipur"} target="_blank" rel="noopener"><ExternalLink size={15} /> Jaipur ki list dekho</a>
          <button type="button" className="d-btn d-btn-s" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/jaipur/${slug}`).then(() => toast("Link copy ho gaya")).catch(() => toast("Copy nahi hua. Link khol kar address bar se le lo.", true))}><Copy size={15} /> Link copy karo</button>
        </div>
      </section>

      <section aria-labelledby="st">
        <h2 id="st" className="mb-3 text-base font-semibold" style={lt}>Pichhle 30 din</h2>
        <div className="grid grid-cols-2 gap-3">
          {stat(stats.views, "log ne aapki offer dekhi", "Jaipur page par")}
          {stat(stats.follows, "log Instagram par gaye", "Offer kholne ke liye")}
          {stat(stats.claims, "logon ne offer li", "Unhe code mila")}
          {stat(stats.redeems, "dukaan par aaye", "Counter par code dikhaya")}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>Naye followers kitne bane, wo aapke Instagram mein dikhta hai. Hum sirf ye ginte hain ki kitne log yahan se aapke Instagram par gaye.</p>
      </section>

      <section className="d-card space-y-3 p-5" aria-labelledby="cc">
        <h2 id="cc" className="text-base font-semibold" style={lt}>Customer ka code check karo</h2>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>Customer counter par code dikhaye. Yahan likho, offer sahi hai to &quot;Use ho gaya&quot; dabao. Ek code ek hi baar chalta hai.</p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Customer ka code" className="d-input min-w-0 flex-1 !text-[20px] tracking-[0.18em] uppercase" maxLength={6} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="A1B2C3" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "")); setRes(null); }} />
          <button type="button" className="d-btn d-btn-p" disabled={busy === "check"} onClick={() => lookup(false)}>{busy === "check" && <Loader2 size={15} className="animate-spin" />} Check karo</button>
        </div>
        {res && (
          <div className="d-raise p-4" role="status" style={{ boxShadow: `inset 0 0 0 1px ${res.state === "valid" || res.state === "redeemed" ? "var(--d-green)" : "var(--d-red)"}` }}>
            {res.state === "unknown" && <p style={lt}>Ye code galat hai. Customer se dobara poochho.</p>}
            {res.state === "expired" && <p style={lt}>Is code ki offer khatam ho chuki hai: {res.title}.</p>}
            {res.state === "used" && <p style={lt}>Ye code pehle use ho chuka hai: {res.title}.</p>}
            {res.state === "redeemed" && <p className="flex items-center gap-2 font-medium" style={{ color: "var(--d-green)" }}><Check size={16} /> Ho gaya. Customer ko offer do: {res.title}</p>}
            {res.state === "valid" && (
              <div className="space-y-2"><p className="font-medium" style={lt}>Sahi code. Offer: {res.title}</p>{res.details && <p className="text-sm" style={{ color: "var(--d-sub)" }}>{res.details}</p>}
                <button type="button" className="d-btn d-btn-p" disabled={busy === "redeem"} onClick={() => lookup(true)}>{busy === "redeem" && <Loader2 size={15} className="animate-spin" />} Use ho gaya</button></div>
            )}
          </div>
        )}
      </section>

      <section className="d-card space-y-4 p-5" aria-labelledby="mk">
        <div><h2 id="mk" className="text-base font-semibold" style={lt}>Khaas offer lagao</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Sirf bade mauko ke liye: New Year, Diwali, naya launch, naya product. Har chhoti offer yahan nahi lagti. Ye WhatsApp par nahi jaati.</p></div>
        <label className={label}><span className="font-medium" style={lt}>Kis mauke ke liye</span>
          <select className="d-input mt-1.5" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(OFFER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className={label}><span className="font-medium" style={lt}>Offer ek line mein</span>
          <input className="d-input mt-1.5" maxLength={70} placeholder="Diwali par har coffee ke saath ek mithai free" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className={label}><span className="font-medium" style={lt}>Kuch aur batana hai (zaroori nahi)</span>
          <input className="d-input mt-1.5" maxLength={300} placeholder="Shaam 5 se 9 ke beech" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}><span className="font-medium" style={lt}>Kab se</span><input type="date" className="d-input mt-1.5" min={today} value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value, ends: e.target.value > f.ends ? e.target.value : f.ends })} /></label>
          <label className={label}><span className="font-medium" style={lt}>Kab tak</span><input type="date" className="d-input mt-1.5" min={f.starts} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></label>
        </div>
        <label className="d-raise flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm" style={lt}>
          <span>Pehle Instagram follow karwao{!hasInstagram && <span className="block text-xs" style={{ color: "var(--d-muted)" }}>Pehle My Page mein apna Instagram link daalo</span>}</span>
          <input type="checkbox" className="h-5 w-5" checked={hasInstagram && f.follow} disabled={!hasInstagram} onChange={(e) => setF({ ...f, follow: e.target.checked })} />
        </label>
        {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
        <button type="button" className="d-btn d-btn-p w-full" disabled={busy === "create"} onClick={create}>{busy === "create" && <Loader2 size={16} className="animate-spin" />} Team ko bhejo</button>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Offer sirf visit ya follow ke liye ho. Google review ke badle kuch nahi dena. Zyada se zyada 45 din, aur ek saath 3 offers.</p>
      </section>

      <section aria-labelledby="my">
        <h2 id="my" className="mb-3 text-base font-semibold" style={lt}>Aapki offers</h2>
        {offers.length === 0 ? <div className="d-card px-6 py-10 text-center text-sm" style={{ color: "var(--d-muted)" }}>Abhi koi offer nahi.</div> : (
          <ul className="space-y-2.5">{offers.map((o) => {
            const ended = o.ends_on < today;
            const st = o.status === "rejected" ? ["Reject hui", "var(--d-red)"] : o.status === "pending" ? ["Team check kar rahi hai", "var(--d-amber)"] : ended ? ["Khatam", "var(--d-muted)"] : ["Chal rahi hai", "var(--d-green)"];
            return (
              <li key={o.id} className="d-card flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="d-chip" style={{ ["--c" as string]: st[1] }}>{st[0]}</span><span className="text-xs" style={{ color: "var(--d-muted)" }}>{OFFER_KINDS[o.kind]} · {dmy(o.starts_on)} se {dmy(o.ends_on)}</span></div>
                  <p className="mt-1.5 font-medium" style={lt}>{o.title}</p>
                  {o.status === "rejected" && o.admin_note && <p className="mt-1 text-sm" style={{ color: "var(--d-sub)" }}>Team ka jawab: {o.admin_note}</p>}</div>
                {o.status !== "live" && <button type="button" className="grid h-11 w-11 shrink-0 place-items-center" aria-label={`${o.title} hatao`} style={{ color: "var(--d-muted)" }} onClick={() => remove(o)}><Trash2 size={16} /></button>}
              </li>
            );
          })}</ul>
        )}
      </section>
    </div>
  );
}
