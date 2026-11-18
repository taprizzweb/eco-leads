"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { newPlateCode, slugify } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";

type Tpl = { id: string; label: string };
type Pkg = { id: string; name: string; price_inr: number };

const plus = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const validUrl = (v: string) => { if (!v) return true; try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };

// Defined at module level on purpose: inside the form component it would be a new component on every keystroke and the field would lose focus.
function L({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>{label}</span>
      {hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
      {error && <span role="alert" className="mt-1 block text-sm" style={{ color: "var(--d-red)" }}>{error}</span>}
    </label>
  
  );
}

export function NewClientForm({ templates, packages }: { templates: Tpl[]; packages: Pkg[] }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ name: "", slug: "", type: templates[0]?.id ?? "", review: "", pkg: packages[0]?.id ?? "starter", expires: plus(30), plates: "1", label: "Counter", owner: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}) }));

  async function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Add the business name.";
    if (!/^[a-z0-9-]{3,40}$/.test(f.slug)) e.slug = "Use 3 to 40 letters, numbers or dashes.";
    if (!validUrl(f.review)) e.review = "This needs to be a full link starting with https://";
    if (f.owner && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.owner)) e.owner = "That email looks incomplete.";
    if (!f.expires) e.expires = "Pick the plan end date.";
    setErr(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    const sb = supabaseBrowser();
    const { data: c, error } = await sb.from("clients").insert({
      name: f.name.trim(), slug: f.slug, business_type: f.type || null, google_review_url: f.review.trim() || null,
      package_id: f.pkg, expires_at: f.expires, theme: "graphite",
    }).select("id, slug").single();
    if (error || !c) {
      setBusy(false);
      return /duplicate|unique/i.test(error?.message ?? "") ? setErr({ slug: "That link name is taken. Try another." }) : toast("The client was not created. Please try again.", true);
    }
    const n = Math.max(0, Math.min(10, parseInt(f.plates) || 0));
    for (let i = 0; i < n; i++) {
      const label = n === 1 ? f.label : `${f.label || "Table"} ${i + 1}`;
      for (let tries = 0; tries < 5; tries++) {
        const { error: pe } = await sb.from("plates").insert({ code: newPlateCode(), client_id: c.id, label: label || null });
        if (!pe) break;
        if (!/duplicate|unique/i.test(pe.message)) { toast("The client was created, but a plate did not save.", true); break; }
      }
    }
    if (f.owner) {
      const { error: ie } = await sb.from("invites").insert({ email: f.owner.trim().toLowerCase(), kind: "client", client_id: c.id, member_role: "owner" });
      if (ie) toast("The client was created, but the owner invite did not save.", true);
    }
    toast("Client created");
    router.push(`/admin/clients/${c.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="d-card max-w-3xl space-y-5 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <L label="Business name" error={err.name}><input className="d-input" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={60} autoFocus /></L>
        <L label="Page link" hint={`taprizz.in/e/${f.slug || "name"}`} error={err.slug}><input className="d-input" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} /></L>
        <L label="Business type" hint="fills the wording, review chips and offers"><select className="d-input" value={f.type} onChange={(e) => set("type", e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></L>
        <L label="Google review link" hint="optional now" error={err.review}><input className="d-input" inputMode="url" value={f.review} onChange={(e) => set("review", e.target.value)} placeholder="https://g.page/r/..." /></L>
        <L label="Package"><select className="d-input" value={f.pkg} onChange={(e) => set("pkg", e.target.value)}>{packages.map((p) => <option key={p.id} value={p.id}>{p.name} · Rs {p.price_inr.toLocaleString("en-IN")}</option>)}</select></L>
        <L label="Plan ends on" error={err.expires}><input type="date" className="d-input" value={f.expires} onChange={(e) => set("expires", e.target.value)} /></L>
        <L label="Plates to create" hint="0 to 10, each gets its own link"><input type="number" min={0} max={10} className="d-input" value={f.plates} onChange={(e) => set("plates", e.target.value)} /></L>
        <L label="Plate label" hint="Table 1, Table 2 and so on"><input className="d-input" value={f.label} onChange={(e) => set("label", e.target.value)} maxLength={30} /></L>
      </div>
      <L label="Owner's email" hint="they get access the first time they sign in with it" error={err.owner}><input type="email" className="d-input" value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="owner@cafe.com" /></L>
      <div className="flex gap-2 pt-1">
        <button className="d-btn d-btn-p" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Create client</button>
        <button type="button" className="d-btn d-btn-s" onClick={() => router.push("/admin/clients")}>Cancel</button>
      </div>
    </form>
  );
}
