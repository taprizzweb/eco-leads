"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Copy, Check, MessageCircle, KeyRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AuthFrame, authBtn, authBtnStrong, authInput, authLabel } from "@/components/dash/AuthFrame";

type Status = { verified: boolean; whatsapp_ready: boolean; phone: string | null; phone_verified: boolean; has_totp: boolean; pending_to: string | null; retry_in: number };
type Mode =
  | { kind: "loading" }
  | { kind: "wa-send" }                       // number on file, waiting for "Send code"
  | { kind: "wa-add" }                        // first time: ask for the WhatsApp number
  | { kind: "wa-code"; sentTo: string }       // code sent, enter it
  | { kind: "totp-verify"; factorId: string }
  | { kind: "totp-enroll"; factorId: string; qr: string; secret: string };

// Second step after Google or password. A WhatsApp code is only sent when the person taps the button,
// and "Trust this device" skips this screen for 30 days, so each code costs money only when needed.
function VerifyInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [copied, setCopied] = useState(false);
  const sb = supabaseBrowser();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function startTotp(s: Status) {
    const { data } = await sb.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === "verified");
    if (verified) return setMode({ kind: "totp-verify", factorId: verified.id });
    if (s.whatsapp_ready) return; // authenticator setup is only forced when WhatsApp is not available
    for (const f of data?.all ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data: en, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Taprizz ${Date.now()}` });
    if (error || !en) return setError("We could not start 2-step setup. Refresh the page to try again.");
    setMode({ kind: "totp-enroll", factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret });
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc("my_security_status");
      if (error || !data) { setError("We could not load your sign-in options. Refresh the page."); return; }
      const s = data as Status;
      setStatus(s);
      if (s.verified) { location.replace(next); return; }
      if (s.whatsapp_ready && s.pending_to) { setWait(s.retry_in); setMode({ kind: "wa-code", sentTo: s.pending_to }); }
      else if (s.whatsapp_ready) setMode({ kind: s.phone_verified ? "wa-send" : "wa-add" });
      else await startTotp(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next]);

  async function sendCode(purpose: "signin" | "enroll") {
    if (purpose === "enroll" && phone.replace(/\D/g, "").length < 10) return setError("Enter your 10-digit mobile number.");
    setBusy(true);
    setError("");
    const { data, error } = await sb.rpc("otp_request", { p_purpose: purpose, p_phone: purpose === "enroll" ? phone : null });
    setBusy(false);
    if (error) return setError(error.message);
    setCode("");
    setWait((data as { retry_in: number }).retry_in ?? 60);
    setMode({ kind: "wa-code", sentTo: (data as { sent_to: string }).sent_to });
  }

  async function finish() {
    if (trust) await fetch("/api/security/trust", { method: "POST" }).catch(() => {});
    location.replace(next);
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError("");
    if (mode.kind === "wa-code") {
      const { data, error } = await sb.rpc("otp_verify", { p_code: code });
      if (error) { setBusy(false); return setError(error.message); }
      if (!data) { setBusy(false); return setError("That code did not match. Check the latest WhatsApp message and try again."); }
    } else if (mode.kind === "totp-verify" || mode.kind === "totp-enroll") {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
      if (error) { setBusy(false); return setError("That code did not work. Codes change every 30 seconds, so try the newest one."); }
    }
    await finish();
  }

  const isWa = mode.kind === "wa-send" || mode.kind === "wa-add" || mode.kind === "wa-code";
  const title = mode.kind === "wa-add" ? "Add your WhatsApp number" : mode.kind === "totp-enroll" ? "Turn on 2-step sign-in" : "Confirm it's you";
  const sub =
    mode.kind === "wa-add" ? "We send a code there when you sign in on a new device." :
    mode.kind === "wa-send" ? "New device, so we need one quick code." :
    mode.kind === "wa-code" ? `We sent a 6-digit code on WhatsApp to ${mode.sentTo}.` :
    mode.kind === "totp-enroll" ? "Scan this with Google Authenticator or any authenticator app." :
    mode.kind === "totp-verify" ? "Open your authenticator app and type the 6-digit code." : "One moment";

  const codeForm = (
    <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="flex flex-col gap-3" noValidate>
      <label>
        <span className={authLabel}>6-digit code</span>
        <input
          className={`${authInput} text-center text-xl tracking-[0.4em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); if (error) setError(""); }}
          autoFocus
        />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm text-gray-300">
        <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="h-5 w-5 accent-white" />
        Trust this device for 30 days
      </label>
      <button className={authBtnStrong} disabled={busy}>
        {busy && <Loader2 size={18} className="animate-spin" />} Verify and continue
      </button>
    </form>
  );

  return (
    <AuthFrame title={title} sub={sub}>
      <div className="flex flex-col gap-4">
        {mode.kind === "loading" && !error && <div className="grid h-24 place-items-center text-white"><Loader2 className="animate-spin" /></div>}

        {mode.kind === "wa-send" && (
          <button onClick={() => sendCode("signin")} disabled={busy} className={authBtnStrong}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />} Send code to {status?.phone}
          </button>
        )}

        {mode.kind === "wa-add" && (
          <form onSubmit={(e) => { e.preventDefault(); sendCode("enroll"); }} className="flex flex-col gap-3" noValidate>
            <label>
              <span className={authLabel}>WhatsApp number</span>
              <input className={authInput} inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => { setPhone(e.target.value); if (error) setError(""); }} autoFocus />
            </label>
            <button className={authBtnStrong} disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />} Send code on WhatsApp
            </button>
          </form>
        )}

        {mode.kind === "wa-code" && (
          <>
            {codeForm}
            <button type="button" onClick={() => sendCode(status?.phone_verified ? "signin" : "enroll")} disabled={wait > 0 || busy} className="min-h-11 text-xs text-gray-400 underline underline-offset-4 hover:text-white disabled:no-underline disabled:opacity-60">
              {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
            </button>
          </>
        )}

        {mode.kind === "totp-enroll" && (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mode.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg bg-white p-2" />
            <button type="button" onClick={() => { navigator.clipboard.writeText(mode.secret).then(() => setCopied(true)).catch(() => {}); }} className="flex min-h-11 items-center gap-2 text-xs text-gray-400 hover:text-white">
              {copied ? <Check size={14} /> : <Copy size={14} />} Can&apos;t scan? Copy the setup key
            </button>
          </div>
        )}
        {(mode.kind === "totp-enroll" || mode.kind === "totp-verify") && codeForm}

        {/* Switch between WhatsApp and the authenticator backup */}
        {isWa && status?.has_totp && (
          <button type="button" onClick={() => { setError(""); setCode(""); startTotp(status); }} className={authBtn}>
            <KeyRound size={16} /> Use authenticator app instead
          </button>
        )}
        {mode.kind === "totp-verify" && status?.whatsapp_ready && (
          <button type="button" onClick={() => { setError(""); setCode(""); setMode({ kind: status.phone_verified ? "wa-send" : "wa-add" }); }} className={authBtn}>
            <MessageCircle size={16} /> Get a code on WhatsApp instead
          </button>
        )}

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <form action="/auth/signout" method="post" className="text-center">
          <button className="min-h-11 text-xs text-gray-400 underline underline-offset-4 hover:text-white">Use a different account</button>
        </form>
      </div>
    </AuthFrame>
  );
}

export default function VerifyPage() {
  return <Suspense><VerifyInner /></Suspense>;
}
