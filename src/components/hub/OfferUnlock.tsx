"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Instagram, Lock, Loader2 } from "lucide-react";
import { OFFER_KINDS, endsLabel, type HubOffer } from "@/lib/hub-shared";

type Claim = { code: string; title: string; details: string | null; ends_on: string; name: string; used?: boolean };
const deviceId = () => {
  try {
    let d = localStorage.getItem("hub_device");
    if (!d) { d = (crypto.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now()).replace(/[^a-zA-Z0-9-]/g, ""); localStorage.setItem("hub_device", d); }
    return d;
  } catch { return "no-storage-" + Math.random().toString(36).slice(2, 12); }
};
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The offer stays closed until the guest has opened the business's Instagram page and come back. We cannot see who really followed (Instagram does not tell us), so this is a nudge, not a proof.
export function OfferUnlock({ offer, instagram }: { offer: HubOffer; instagram: string | null }) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [step, setStep] = useState<"locked" | "away" | "back">("locked");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const left = useRef<number>(0);
  const needFollow = offer.follow_first && !!instagram;

  useEffect(() => {
    try { const s = localStorage.getItem("hub_claim_" + offer.id); if (s) setClaim(JSON.parse(s) as Claim); } catch {}
    try { if (!sessionStorage.getItem("hub_view_" + offer.id)) { sessionStorage.setItem("hub_view_" + offer.id, "1"); void post("/api/jaipur/track", { offerId: offer.id, kind: "view" }); } } catch {}
  }, [offer.id]);

  async function open() {
    setBusy(true); setErr("");
    try {
      const res = await post("/api/jaipur/claim", { offerId: offer.id, device: deviceId() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Offer abhi nahi khul paayi.");
      setClaim(j as Claim);
      try { localStorage.setItem("hub_claim_" + offer.id, JSON.stringify(j)); } catch {}
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (step !== "away") return;
    const back = () => {
      if (document.visibilityState !== "visible") { left.current = left.current || Date.now(); return; }
      if (left.current && Date.now() - left.current >= 2500) { setStep("back"); void open(); }
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

  if (claim) {
    return (
      <div className="d-raise space-y-3 p-4" style={{ borderRadius: 18, boxShadow: "inset 0 0 0 1px var(--d-amber)" }}>
        <span className="d-chip w-fit" style={{ ["--c" as string]: "var(--d-green)" }}><Check size={12} aria-hidden /> Offer khul gayi</span>
        <p className="text-[20px] leading-tight font-semibold tracking-[-0.025em]" style={{ color: "var(--d-text)" }}>{claim.title}</p>
        {claim.details && <p className="text-sm" style={{ color: "var(--d-sub)" }}>{claim.details}</p>}
        <div className="rounded-2xl p-4 text-center" style={{ background: "var(--d-chip-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
          <span className="text-xs" style={{ color: "var(--d-muted)" }}>Counter par ye code dikhao</span>
          <b className="mt-1 block text-[34px] tracking-[0.14em]" style={{ color: "var(--d-text)" }} aria-label={`Code ${claim.code.split("").join(" ")}`}>{claim.code}</b>
        </div>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>{claim.used ? "Ye code use ho chuka hai." : `${endsLabel(claim.ends_on)}. Ek code, ek baar.`}</p>
      </div>
    );
  }

  return (
    <div className="d-raise space-y-3 p-4" style={{ borderRadius: 18, background: "radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--d-amber) 14%, transparent), transparent 60%), var(--d-raise)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="d-chip" style={{ ["--c" as string]: "var(--d-amber)" }}>{OFFER_KINDS[offer.kind] ?? "Special offer"}</span>
        <span className="text-xs" style={{ color: "var(--d-muted)" }}>{endsLabel(offer.ends_on)}</span>
      </div>
      <p className="flex items-center gap-2 text-[18px] leading-tight font-semibold tracking-[-0.02em]" style={{ color: "var(--d-text)" }}>
        {offer.title ?? <><Lock size={16} aria-hidden style={{ color: "var(--d-muted)" }} /> Khaas offer, band hai</>}
      </p>
      {needFollow ? (
        step === "locked" ? (
          <button type="button" className="d-btn d-btn-p w-full" onClick={follow}><Instagram size={16} aria-hidden /> Offer kholne ke liye Instagram follow karo</button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: "var(--d-sub)" }}>Instagram par follow karke wapas aao. Offer apne aap khul jayegi.</p>
            <button type="button" className="d-btn d-btn-s w-full" disabled={busy} onClick={() => { setStep("back"); void open(); }}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} Maine follow kar liya</button>
          </div>
        )
      ) : (
        <button type="button" className="d-btn d-btn-p w-full" disabled={busy} onClick={() => void open()}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Offer kholo</button>
      )}
      {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
    </div>
  );
}
