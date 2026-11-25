"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugify, LINK_BASE } from "@/lib/features";

const ERR: Record<string, string> = {
  "bad name": "Please type your business or page name.",
  "bad slug": "The link name needs 3 to 40 letters, numbers or dashes.",
  "slug taken": "That link name is taken. Try another.",
  "bad phone": "Please type a 10 digit Indian mobile number.",
  "bad email": "That email looks incomplete.",
  "terms needed": "Please accept the terms to continue.",
  "busy": "Many people are creating pages right now. Please try again in a few minutes.",
  "too many pages": "This number has already created 3 pages. Message us on WhatsApp if you need more.",
};

/** Name, link name and phone: that is all it takes to start. The page opens in the editor straight away. */
export function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [free, setFree] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [mkt, setMkt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!touched) setSlug(slugify(name));
  }, [name, touched]);
  useEffect(() => {
    setFree(null);
    if (slug.length < 3) return;
    const t = setTimeout(async () => {
      const { data } = await supabaseBrowser().rpc("mini_slug_free", { p_slug: slug });
      setFree(data === true);
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function submit() {
    setErr(null);
    if (!terms) return setErr(ERR["terms needed"]);
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("mini_create", { p_name: name, p_slug: slug, p_phone: phone, p_email: email, p_terms: terms, p_marketing: mkt });
    setBusy(false);
    if (error || !data) {
      const k = Object.keys(ERR).find((e) => (error?.message ?? "").includes(e));
      return setErr(k ? ERR[k] : "That did not work. Please try again.");
    }
    const t = (data as { token: string }).token;
    try { localStorage.setItem("tz_mini_edit", t); } catch { /* fine */ }
    router.push(`/edit/${t}`);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="d-card space-y-4 p-5" noValidate>
      <label className="block text-sm"><span className="font-medium">Your business or page name</span>
        <input className="d-input mt-1.5" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Blue Door Cafe" autoComplete="organization" /></label>
      <label className="block text-sm"><span className="font-medium">Your link</span>
        <span className="mt-1.5 flex items-center gap-2"><span className="text-xs" style={{ color: "var(--d-muted)" }}>{LINK_BASE.replace(/^https?:\/\//, "")}/</span>
          <input className="d-input" value={slug} maxLength={40} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} placeholder="bluedoorcafe" /></span>
        {slug.length >= 3 && free !== null && <span className="mt-1 block text-xs" style={{ color: free ? "var(--d-green)" : "var(--d-red)" }}>{free ? "Available" : "Taken. Try another."}</span>}</label>
      <label className="block text-sm"><span className="font-medium">Mobile number</span>
        <span className="mt-1.5 flex"><span className="grid shrink-0 place-items-center rounded-l-xl px-3 text-sm font-medium" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>+91</span>
          <input className="d-input !rounded-l-none" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98765 43210" /></span></label>
      <label className="block text-sm"><span className="font-medium">Email</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>optional</span>
        <input className="d-input mt-1.5" type="email" autoComplete="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>I agree to the <a className="underline" href="/create/terms" target="_blank">terms, refund and privacy notes</a>.</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={mkt} onChange={(e) => setMkt(e.target.checked)} /><span>Taprizz may message me on WhatsApp or email about my page and new offers. I can say stop anytime.</span></label>
      {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
      <button className="d-btn d-btn-p w-full justify-center" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Start building my page</button>
      <p className="text-center text-xs" style={{ color: "var(--d-muted)" }}>Building and previewing is free. You pay only to put the page live.</p>
    </form>
  );
}
