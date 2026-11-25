"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useBackToClose } from "@/lib/sheet-back";

/** The contact form of a mini link. Name, email, phone and message are saved only because the visitor typed them and ticked the box. */
export function ContactSheet({ linkId, onClose, onSent }: { linkId: string; onClose: () => void; onSent?: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useBackToClose(true, onClose);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "", agree: false, site: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", key); };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.site) { setDone(true); return; }   // a hidden field only a robot fills
    const ph = f.phone.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
    if (f.name.trim().length < 2) return setErr("Please type your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr("Please type a correct email.");
    if (!/^[6-9]\d{9}$/.test(ph)) return setErr("Please type a 10 digit mobile number.");
    if (f.message.trim().length < 3) return setErr("Please type your message.");
    if (!f.agree) return setErr("Please tick the box so they can contact you.");
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().rpc("link_contact_submit", { p_id: linkId, p_name: f.name.trim(), p_email: f.email.trim(), p_phone: ph, p_message: f.message.trim(), p_consent: true });
    setBusy(false);
    if (error) return setErr(/busy/.test(error.message) ? "Too many messages right now. Please try again in a little while." : "Your message did not send. Check your connection and try again.");
    setDone(true); onSent?.();
  }

  const input = "w-full rounded-xl px-3 py-2.5 text-[15px] outline-none focus:ring-2";
  const st = { background: "rgba(255,255,255,0.7)", color: "#0f172a", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.15)" } as const;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Contact form">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div ref={panel} className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ background: "#dbe2ee", color: "#0f172a" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contact form</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}><X size={18} /></button>
        </div>
        {done ? (
          <p className="py-8 text-center text-[15px]">Thank you. Your message has been sent. They will get back to you.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <label className="block text-xs font-medium">Name *<input className={input} style={st} maxLength={80} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="block text-xs font-medium">Email *<input className={input} style={st} type="email" maxLength={120} autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
            <label className="block text-xs font-medium">Phone *<input className={input} style={st} inputMode="numeric" maxLength={14} autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label className="block text-xs font-medium">Message *<textarea className={input} style={st} rows={4} maxLength={1000} value={f.message} onChange={(e) => set("message", e.target.value)} /></label>
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.site} onChange={(e) => set("site", e.target.value)} />
            <label className="flex min-h-10 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={f.agree} onChange={(e) => set("agree", e.target.checked)} />I agree to be contacted about my inquiry.</label>
            {err && <p role="alert" className="text-sm font-medium text-red-700">{err}</p>}
            <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold" style={{ background: "rgba(255,255,255,0.8)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.15)" }}>{busy && <Loader2 size={16} className="animate-spin" />}Submit</button>
          </form>
        )}
      </div>
    </div>
  );
}
