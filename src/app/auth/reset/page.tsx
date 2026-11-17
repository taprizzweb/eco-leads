"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AuthFrame, authBtnStrong, authInput, authLabel } from "@/components/dash/AuthFrame";

// Reached from the reset email. Setting a new password does not skip the WhatsApp / authenticator step.
export default function ResetPage() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords do not match.");
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(/same/i.test(error.message) ? "That is your current password. Pick a new one." : "The new password did not save. Open the link from your email again.");
    location.replace("/dashboard");
  }

  return (
    <AuthFrame title="Set a new password" sub="At least 8 characters. A short sentence works well.">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3" noValidate>
        <label>
          <span className={authLabel}>New password</span>
          <input className={authInput} type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); if (error) setError(""); }} autoFocus />
        </label>
        <label>
          <span className={authLabel}>Type it again</span>
          <input className={authInput} type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); if (error) setError(""); }} />
        </label>
        <button className={authBtnStrong} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} Save password</button>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </form>
    </AuthFrame>
  );
}
