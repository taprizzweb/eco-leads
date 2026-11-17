"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AuthFrame, authBtn, authBtnStrong, authInput, authLabel } from "@/components/dash/AuthFrame";
import { GoogleMark } from "@/components/ui/modern-stunning-sign-in";

// One sign-in for everyone: business owners and staff, the Taprizz admin and Taprizz employees.
// Where each person lands afterwards depends on their role, not on the login screen.
function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/dashboard";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ? "Google sign-in did not finish. Please try again." : "");
  const devLogin = process.env.NEXT_PUBLIC_DEV_PASSWORD_LOGIN === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function google() {
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      setError("Google sign-in is not available right now. Please try again in a minute.");
    }
  }

  async function passwordSignIn() {
    if (!email || !password) return setError("Enter your email and password.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("That email address looks incomplete.");
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError("That email and password did not match.");
    router.push(`/login/mfa?next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthFrame
      title="Sign in to Taprizz"
      sub="For business owners, their staff and the Taprizz team."
      foot={
        <p className="mb-3 max-w-xs text-sm text-gray-400">
          New business? <span className="font-medium text-white">Taprizz sets up your page</span> and sends you an invite.
        </p>
      }
    >
      <div className="flex flex-col gap-4">
        <button onClick={google} disabled={busy} className={authBtnStrong}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleMark />}
          Continue with Google
        </button>
        <p className="text-center text-xs text-gray-400">Next, you confirm with a 6-digit code from your authenticator app.</p>

        {devLogin && (
          <form onSubmit={(e) => { e.preventDefault(); passwordSignIn(); }} className="flex flex-col gap-3" noValidate>
            <hr className="my-1 opacity-10" />
            <p className="text-xs uppercase tracking-wide text-gray-500">Development sign-in</p>
            <label>
              <span className={authLabel}>Email</span>
              <input className={authInput} type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }} autoComplete="username" />
            </label>
            <label>
              <span className={authLabel}>Password</span>
              <input className={authInput} type="password" value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }} autoComplete="current-password" />
            </label>
            <button className={authBtn} disabled={busy}>Sign in with password</button>
          </form>
        )}

        {error && <p role="alert" className="text-left text-sm text-red-400">{error}</p>}
      </div>
    </AuthFrame>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
