"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, ExternalLink, QrCode, Loader2, Plus, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { slugify, LINK_BASE, linkUrl } from "@/lib/features";
import { DEFAULT_BUTTONS, LINK_THEMES, type LinkTheme } from "@/lib/linkpage";
import { Pill } from "./ui";
import { downloadUrlQr } from "./qr";

export type LinkRow = { id: string; slug: string; name: string; logo_url: string | null; theme: string; published: boolean; fee_inr: number; client_id: string | null; views: number; clicks: number };
export type ClientOpt = { id: string; name: string; slug: string };

export function LinksAdmin({ links, clients }: { links: LinkRow[]; clients: ClientOpt[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"registered" | "new">(clients.length ? "registered" : "new");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [theme, setTheme] = useState<LinkTheme>("midnight");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = useMemo(() => links.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase())), [links, q]);

  async function create() {
    setErr("");
    let row: Record<string, unknown>;
    if (mode === "registered") {
      const c = clients.find((x) => x.id === clientId);
      if (!c) return setErr("Pick a business.");
      const { data: cl } = await sb.from("clients").select("name, tagline, logo_url, google_review_url, menu_url, socials, keywords").eq("id", c.id).single();
      const { data: ph } = await sb.from("gallery_photos").select("url, caption").eq("client_id", c.id).order("sort").limit(14);
      const { data: of } = await sb.from("offers").select("title, details, ends_at").eq("client_id", c.id).or(`ends_at.is.null,ends_at.gte.${new Date().toISOString().slice(0, 10)}`).limit(20);
      const socials = (cl?.socials ?? {}) as Record<string, string>;
      const buttons = DEFAULT_BUTTONS.map((b) => (b.icon === "menu" ? { ...b, url: cl?.menu_url ?? "" } : b));
      row = {
        client_id: c.id, name: cl?.name ?? c.name, slug: slugify(slug || c.slug), tagline: cl?.tagline ?? null, logo_url: cl?.logo_url ?? null, theme,
        tags: cl?.keywords ?? [], socials: { instagram: socials.instagram, facebook: socials.facebook, zomato: socials.zomato, swiggy: socials.swiggy, phone: socials.phone, maps: socials.maps },
        photos: (ph ?? []).map((p) => ({ url: p.url, caption: p.caption ?? undefined })), buttons,
        offers: (of ?? []).map((o) => ({ outlet: "", title: o.title, details: o.details ?? undefined, valid_till: o.ends_at ? `Valid till ${new Date(o.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : undefined })),
        outlets: cl?.google_review_url ? [{ name: cl?.name ?? c.name, review_url: cl.google_review_url, map_url: socials.maps ?? "", phone: socials.phone ?? "" }] : [],
      };
    } else {
      if (!name.trim()) return setErr("Add the business name.");
      row = { name: name.trim(), slug: slugify(slug || name), theme, buttons: DEFAULT_BUTTONS };
    }
    if (!/^[a-z0-9-]{3,40}$/.test(String(row.slug))) return setErr("The page link needs 3 to 40 letters, numbers or dashes.");
    setBusy(true);
    const { data, error } = await sb.from("link_pages").insert(row).select("id").single();
    setBusy(false);
    if (error || !data) return setErr(/duplicate|unique/i.test(error?.message ?? "") ? "That page link is already taken. Try another." : "The page was not created. Please try again.");
    toast("Mini link created");
    router.push(`/admin/tools/links/${data.id}`);
  }

  async function copy(l: LinkRow) { try { await navigator.clipboard.writeText(linkUrl(l.slug)); toast("Link copied"); } catch { toast("Could not copy the link.", true); } }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
          <input type="search" aria-label="Search mini links" className="d-input !pl-10" placeholder="Search a mini link" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="d-btn d-btn-p" onClick={() => setOpen((v) => !v)}><Plus size={16} /> New mini link</button>
      </div>

      {open && (
        <section className="d-card space-y-4 p-5">
          <h2 className="font-semibold">Make a mini link</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Business">
            {([["registered", "A registered business"], ["new", "A new business (link only)"]] as const).map(([v, l]) => (
              <button key={v} role="radio" aria-checked={mode === v} type="button" onClick={() => setMode(v)} className="d-btn !min-h-10 !px-4 !text-[13px]" style={mode === v ? { background: "var(--d-text)", color: "var(--d-bg)" } : { background: "var(--d-bg)", color: "var(--d-sub)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>{l}</button>
            ))}
          </div>
          {mode === "registered" ? (
            <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Business</span>
              <select className="d-input mt-1.5" value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <span className="mt-1 block text-xs" style={{ color: "var(--d-muted)" }}>Its name, logo, links, tags, photos and reviews are filled in for you. You can change everything after.</span></label>
          ) : (
            <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Business name</span><input className="d-input mt-1.5" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Town Coffee" /></label>
          )}
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Page link</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{LINK_BASE}/{slugify(slug || (mode === "new" ? name : clients.find((c) => c.id === clientId)?.slug ?? "")) || "name"}</span>
            <input className="d-input mt-1.5" maxLength={40} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="leave empty to use the name" /></label>
          <fieldset><legend className="mb-1.5 text-sm font-medium" style={{ color: "var(--d-text)" }}>Template</legend>
            <div className="flex flex-wrap gap-2">{(Object.keys(LINK_THEMES) as LinkTheme[]).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} className="flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px]" style={{ background: "var(--d-bg)", color: "var(--d-text)", boxShadow: theme === t ? "inset 0 0 0 2px var(--d-text)" : "inset 0 0 0 1px var(--d-line-2)" }}>
                <span className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${LINK_THEMES[t].vars["--l-accent"]}, ${LINK_THEMES[t].vars["--l-bg"]})`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)" }} />{LINK_THEMES[t].label}
              </button>))}</div></fieldset>
          {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
          <button className="d-btn d-btn-p" disabled={busy} onClick={create}>{busy && <Loader2 size={16} className="animate-spin" />} Create and edit</button>
        </section>
      )}

      {list.length === 0 ? (
        <p className="d-card p-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>{links.length === 0 ? "No mini links yet. Make the first one." : `No mini link matches "${q}".`}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((l) => (
            <article key={l.id} className="d-card flex items-center gap-3 p-4">
              {l.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={l.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{l.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <Link href={`/admin/tools/links/${l.id}`} className="block truncate py-1 font-semibold hover:underline">{l.name}</Link>
                <p className="truncate text-xs" style={{ color: "var(--d-muted)" }}>{LINK_BASE.replace(/^https?:\/\//, "")}/{l.slug} · {l.views} views · {l.clicks} taps{l.fee_inr ? ` · Rs ${l.fee_inr.toLocaleString("en-IN")}` : " · free"}</p>
                <div className="mt-1 flex gap-1.5">{l.published ? <Pill tone="green">Live</Pill> : <Pill tone="amber">Draft</Pill>}{l.client_id ? <Pill tone="blue">Registered</Pill> : <Pill tone="gray">Link only</Pill>}</div>
              </div>
              <button className="d-btn d-btn-s !px-3" aria-label={`Copy link for ${l.name}`} onClick={() => copy(l)}><Copy size={15} /></button>
              <button className="d-btn d-btn-s !px-3" aria-label={`Download QR for ${l.name}`} title="Download QR" onClick={() => void downloadUrlQr(linkUrl(l.slug), l.slug)}><QrCode size={15} /></button>
              <a className="d-btn d-btn-s !px-3" aria-label={`Open ${l.name}`} href={`/l/${l.slug}${l.published ? "" : "?preview=1"}`} target="_blank" rel="noopener"><ExternalLink size={15} /></a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
