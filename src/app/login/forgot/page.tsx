"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AuthFrame, authBtn, authBtnStrong, authInput, authLabel } from "@/components/dash/AuthFrame";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter the email you sign in with.");
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
    });
    setBusy(false);
    // Same message whether or not the account exists, so nobody can test which emails are registered.
    if (error && !/rate|limit/i.test(error.message)) return setError("We could not send the email right now. Please try again in a minute.");
    if (error) return setError("Too many reset emails asked for. Please wait a few minutes.");
    setSent(true);
  }

  return (
    <AuthFrame title="Reset your password" sub="We email you a link to set a new one.">
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="text-white" />
          <p className="text-sm text-gray-300">If {email} has a Taprizz account, the reset link is on its way. Check spam too.</p>
          <a href="/login" className={authBtn}>Back to sign in</a>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex flex-col gap-3" noValidate>
          <label>
            <span className={authLabel}>Email</span>
            <input className={authInput} type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }} autoFocus />
          </label>
          <button className={authBtnStrong} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} Send reset link</button>
          <a href="/login" className="min-h-11 py-3 text-center text-xs text-gray-400 underline underline-offset-4 hover:text-white">Back to sign in</a>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </AuthFrame>
  );
}
