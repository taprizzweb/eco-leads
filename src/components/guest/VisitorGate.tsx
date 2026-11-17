"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { saveVisitor, type Visitor } from "@/lib/visitor";
import { glassInput, pillPrimary } from "./ui";

// Shown the first time a guest taps an action card. Their name is used to personalise their review.
export function VisitorGate({ clientId, businessName, onDone }: { clientId: string; businessName: string; onDone: (v: Visitor) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [offers, setOffers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    if (!name.trim()) return setErr("Please add your name.");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Enter your 10-digit mobile number.");
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("guest_register_visitor", { p_client: clientId, p_name: name, p_phone: phone, p_marketing: offers });
    setBusy(false);
    if (error) return setErr(error.message || "That did not save. Check your connection and try again.");
    const v = { name: name.trim().split(/\s+/)[0].slice(0, 24), phone: phone.replace(/\D/g, "") };
    saveVisitor(clientId, v);
    onDone(v);
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }} noValidate>
      <p className="text-[15px] text-muted">Welcome to {businessName}. Tell us who you are so we can make this feel like yours.</p>
      <div>
        <label htmlFor="v-name" className="mb-1.5 block text-sm text-muted">Your name</label>
        <input id="v-name" className={glassInput} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} autoComplete="given-name" maxLength={40} autoFocus />
      </div>
      <div>
        <label htmlFor="v-phone" className="mb-1.5 block text-sm text-muted">Mobile number</label>
        <input id="v-phone" className={glassInput} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} placeholder="98765 43210" maxLength={20} />
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={offers} onChange={(e) => setOffers(e.target.checked)} />
        <span>Send me offers from {businessName} on WhatsApp. <span className="text-muted">Optional. You can stop any time.</span></span>
      </label>
      <p className="text-xs text-muted">We use your name to personalise your review and your number so {businessName} can reach you about your feedback. We never share it.</p>
      {err && <p role="alert" className="text-sm text-amber-400">{err}</p>}
      <button className={pillPrimary} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} Continue</button>
    </form>
  );
}
