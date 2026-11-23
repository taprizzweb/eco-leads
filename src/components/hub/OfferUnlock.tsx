"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gift, Instagram, Lock, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { OFFER_KINDS, endsLabel, type HubOffer } from "@/lib/hub-shared";

type Revealed = { title: string; details: string | null; ends_on: string; name: string; terms: string | null };
type Claim = Revealed & { code: string; used?: boolean };
const deviceId = () => {
  try {
    let d = localStorage.getItem("hub_device");
    if (!d) { d = (crypto.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now()).replace(/[^a-zA-Z0-9-]/g, ""); localStorage.setItem("hub_device", d); }
    return d;
  } catch { return "no-storage-" + Math.random().toString(36).slice(2, 12); }
};
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Three steps. 1) The offer is closed until the guest has opened the business's Instagram and come back (Instagram does not tell us who really
// followed, so this is a nudge, not proof). 2) The offer opens. 3) Claiming it gives a code to show at the counter, kept on the guest's phone.
export function OfferUnlock({ offer, instagram, terms }: { offer: HubOffer; instagram: string | null; terms?: string | null }) {
  const [shown, setShown] = useState<Revealed | null>(offer.title ? { title: offer.title, details: offer.details ?? null, ends_on: offer.ends_on, name: "", terms: terms ?? null } : null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [step, setStep] = useState<"locked" | "away">("locked");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const left = useRef<number>(0);
  const needFollow = offer.follow_first && !!instagram && !shown;

  useEffect(() => {
    try { const s = localStorage.getItem("hub_claim_" + offer.id); if (s) setClaim(JSON.parse(s) as Claim); } catch {}
    try { if (!sessionStorage.getItem("hub_view_" + offer.id)) { sessionStorage.setItem("hub_view_" + offer.id, "1"); void post("/api/jaipur/track", { offerId: offer.id, kind: "view" }); } } catch {}
  }, [offer.id]);

  async function reveal() {
    setBusy(true); setErr("");
    const { data, error } = await supabaseBrowser().rpc("hub_offer_reveal", { p_offer: offer.id });
    setBusy(false);
    if (error || !data) return setErr("The offer could not be opened. Please try again.");
    setShown(data as Revealed);
  }
  async function claimIt() {
    setBusy(true); setErr("");
    try {
      const res = await post("/api/jaipur/claim", { offerId: offer.id, device: deviceId() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "The offer could not be claimed.");
      setClaim(j as Claim);
      try { localStorage.setItem("hub_claim_" + offer.id, JSON.stringify(j)); } catch {}
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (step !== "away") return;
    const back = () => {
      if (document.visibilityState !== "visible") { left.current = left.current || Date.now(); return; }
      if (left.current && Date.now() - left.current >= 2500) void reveal();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function follow() {
    void post("/api/jaipur/track", { offerId: offer.id, kind: "follow" });
    left.current = 0;
    setStep("away");
    window.open(instagram!, "_blank", "noopener");
  }

  const card = { borderRadius: 22 } as const;
  if (claim) {
    return (
      <div className="d-raise space-y-3 p-5" style={{ ...card, boxShadow: "inset 0 0 0 1.5px var(--d-green)" }}>
        <span className="d-chip w-fit" style={{ ["--c" as string]: "var(--d-green)" }}><Check size={12} aria-hidden /> You claimed this offer</span>
        <p className="text-[21px] leading-tight font-semibold tracking-[-0.025em]" style={{ color: "var(--d-text)" }}>{claim.title}</p>
        {claim.details && <p className="text-sm" style={{ color: "var(--d-sub)" }}>{claim.details}</p>}
        <div className="rounded-2xl p-4 text-center" style={{ background: "var(--d-chip-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
          <span className="text-xs" style={{ color: "var(--d-muted)" }}>Show this code at the counter</span>
          <b className="mt-1 block text-[36px] tracking-[0.14em]" style={{ color: "var(--d-text)" }} aria-label={`Code ${claim.code.split("").join(" ")}`}>{claim.code}</b>
        </div>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>{claim.used ? "This code has already been used." : `${endsLabel(claim.ends_on)}. One code, one use.`}</p>
        {(claim.terms ?? terms) && <p className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: "var(--d-chip-bg)", color: "var(--d-sub)" }}><b>Terms: </b>{claim.terms ?? terms}</p>}
      </div>
    );
  }
  if (shown) {
    return (
      <div className="d-raise space-y-3 p-5" style={{ ...card, background: "radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--d-amber) 16%, transparent), transparent 60%), var(--d-raise)" }}>
        <div className="flex flex-wrap items-center gap-2"><span className="d-chip" style={{ ["--c" as string]: "var(--d-amber)" }}><Gift size={12} aria-hidden /> {OFFER_KINDS[offer.kind] ?? "Special offer"}</span><span className="text-xs" style={{ color: "var(--d-muted)" }}>{endsLabel(offer.ends_on)}</span></div>
        <p className="text-[21px] leading-tight font-semibold tracking-[-0.025em]" style={{ color: "var(--d-text)" }}>{shown.title}</p>
        {shown.details && <p className="text-sm" style={{ color: "var(--d-sub)" }}>{shown.details}</p>}
        <button type="button" className="d-btn d-btn-p !min-h-12 w-full" disabled={busy} onClick={() => void claimIt()}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Claim this offer</button>
        {(shown.terms ?? terms) && <p className="text-xs leading-relaxed" style={{ color: "var(--d-muted)" }}><b>Terms: </b>{shown.terms ?? terms}</p>}
        {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
      </div>
    );
  }
  return (
    <div className="d-raise space-y-3 p-5" style={{ ...card, background: "radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--d-amber) 14%, transparent), transparent 60%), var(--d-raise)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="d-chip" style={{ ["--c" as string]: "var(--d-amber)" }}><Gift size={12} aria-hidden /> {OFFER_KINDS[offer.kind] ?? "Special offer"}</span>
        <span className="text-xs" style={{ color: "var(--d-muted)" }}>{endsLabel(offer.ends_on)}</span>
      </div>
      <p className="flex items-center gap-2 text-[18px] leading-tight font-semibold tracking-[-0.02em]" style={{ color: "var(--d-text)" }}><Lock size={16} aria-hidden style={{ color: "var(--d-muted)" }} /> A special offer is waiting</p>
      {needFollow ? (
        step === "locked" ? (
          <button type="button" className="d-btn d-btn-p !min-h-12 w-full" onClick={follow}><Instagram size={16} aria-hidden /> Follow on Instagram to see the offer</button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: "var(--d-sub)" }}>Follow on Instagram and come back here. The offer opens by itself.</p>
            <button type="button" className="d-btn d-btn-s w-full" disabled={busy} onClick={() => void reveal()}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} I have followed</button>
          </div>
        )
      ) : (
        <button type="button" className="d-btn d-btn-p !min-h-12 w-full" disabled={busy} onClick={() => void reveal()}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden />} See the offer</button>
      )}
      {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
    </div>
  );
}
