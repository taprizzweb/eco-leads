"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Copy, Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AuthFrame, authBtnStrong, authInput, authLabel } from "@/components/dash/AuthFrame";

type Mode = { kind: "loading" } | { kind: "verify"; factorId: string } | { kind: "enroll"; factorId: string; qr: string; secret: string };

function MfaInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { location.replace(next); return; }
      const { data } = await sb.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) { setMode({ kind: "verify", factorId: verified.id }); return; }
      // Clear half-finished enrolments, then start a fresh one.
      for (const f of data?.all ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Taprizz ${Date.now()}` });
      if (error || !en) { setError("We could not start 2-step setup. Refresh the page to try again."); return; }
      setMode({ kind: "enroll", factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret });
    })();
  }, [next]);

  async function verify() {
    if (mode.kind === "loading") return;
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your app."); return; }
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
    if (error) { setBusy(false); setError("That code did not work. Codes change every 30 seconds, so try the newest one."); return; }
    location.replace(next);
  }

  const enrolling = mode.kind === "enroll";
  return (
    <AuthFrame
      title={enrolling ? "Turn on 2-step sign-in" : "Enter your code"}
      sub={enrolling ? "Scan this with Google Authenticator or any authenticator app." : "Open your authenticator app and type the 6-digit code."}
    >
      {mode.kind === "loading" && !error && <div className="grid h-24 place-items-center text-white"><Loader2 className="animate-spin" /></div>}
      {mode.kind === "enroll" && (
        <div className="mb-5 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mode.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg bg-white p-2" />
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(mode.secret).then(() => setCopied(true)).catch(() => {}); }}
            className="flex min-h-11 items-center gap-2 text-xs text-gray-400 hover:text-white"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} Can&apos;t scan? Copy the setup key
          </button>
        </div>
      )}
      {mode.kind !== "loading" && (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
          <label className="block">
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
          <button className={authBtnStrong} disabled={busy}>
            {busy && <Loader2 size={18} className="animate-spin" />}
            {enrolling ? "Turn on and continue" : "Verify and continue"}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      <form action="/auth/signout" method="post" className="mt-4 text-center">
        <button className="min-h-11 text-xs text-gray-400 underline underline-offset-4 hover:text-white">Use a different account</button>
      </form>
    </AuthFrame>
  );
}

export default function MfaPage() {
  return <Suspense><MfaInner /></Suspense>;
}
