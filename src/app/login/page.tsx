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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function google() {
    setBusy(true);
    setError("");
    // If Google is not switched on in Supabase yet, say so here instead of leaving the guest on a raw error page.
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      });
      const settings = await res.json();
      if (!settings?.external?.google) {
        setBusy(false);
        setError("Google sign-in is not switched on yet. Use your email and password for now.");
        return;
      }
    } catch {
      // If the check itself fails, try Google anyway.
    }
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
    // The dashboard guard asks for a WhatsApp code only on a new or untrusted device.
    router.push(next);
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
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <hr className="flex-1 opacity-10" /> or use your email <hr className="flex-1 opacity-10" />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); passwordSignIn(); }} className="flex flex-col gap-3" noValidate>
          <label>
              <span className={authLabel}>Email</span>
              <input className={authInput} type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }} autoComplete="username" />
            </label>
            <label>
              <span className={authLabel}>Password</span>
              <input className={authInput} type="password" value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }} autoComplete="current-password" />
            </label>
            <button className={authBtn} disabled={busy}>Sign in</button>
            <a href="/login/forgot" className="min-h-11 py-3 text-center text-xs text-gray-400 underline underline-offset-4 hover:text-white">Forgot password?</a>
          </form>

        {error && <p role="alert" className="text-left text-sm text-red-400">{error}</p>}
      </div>
    </AuthFrame>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
