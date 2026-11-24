"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, ImagePlus, X, Smartphone, Lock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { THEMES, type ThemeId } from "@/lib/themes";
import { SortableList, Grip } from "@/components/ui/SortableList";
import { ColorField, BG_SWATCHES } from "@/components/ui/ColorField";
import { logoPalettes, type Palette } from "@/lib/logo-colors";
import { toWebp } from "@/lib/image";
import type { DashClient } from "@/lib/dash";
import type { GuestPageData } from "@/lib/types";
import { GuestPage } from "@/components/guest/GuestPage";
import { useToast } from "./Toast";

type Photo = { id: string; url: string; label: string | null; caption: string | null; sort: number };
type Offer = { id: string; title: string; details: string | null; starts_at: string | null; ends_at: string | null; claimable: boolean };
type Ev = { id: string; title: string; details: string | null; starts_at: string };
type Lnk = { id: string; label: string; url: string; sort: number };

const SOCIALS = [
  ["instagram", "Instagram link"],
  ["facebook", "Facebook link"],
  ["maps", "Google Maps link"],
  ["phone", "Phone number"],
  ["zomato", "Zomato link"],
  ["swiggy", "Swiggy link"],
] as const;

const moveItem = <T,>(a: T[], i: number, d: -1 | 1): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };

function Section({ id, title, sub, children }: { id?: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="d-card scroll-mt-24 p-5">
      <h2 className="font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>{sub}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>{label}</span>
      {hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

export function PageEditor({
  client,
  features,
  template,
  initialGallery,
  initialOffers,
  initialEvents,
  initialLinks,
}: {
  client: DashClient;
  features: Record<string, unknown>;
  template: { review_chips: string[]; card_copy: Record<string, { title?: string; help?: string }>; keywords: string[]; tagline: string | null } | null;
  initialGallery: Photo[];
  initialOffers: Offer[];
  initialEvents: Ev[];
  initialLinks: Lnk[];
}) {
  const toast = useToast();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [f, setF] = useState({
    name: client.name,
    tagline: client.tagline ?? "",
    google_review_url: client.google_review_url ?? "",
    menu_url: client.menu_url ?? "",
    theme: client.theme as ThemeId,
    colors: { ...(client.colors ?? {}) } as { bg?: string; accent?: string; button?: string },
    logo_url: client.logo_url,
    socials: { ...client.socials } as Record<string, string>,
    keywords: client.keywords.length ? client.keywords : template?.keywords ?? [],
    seo_keywords: client.seo_keywords ?? [],
  });
  const [saved, setSaved] = useState(JSON.stringify(f));
  const dirty = JSON.stringify(f) !== saved;
  const [saving, setSaving] = useState(false);
  const [kw, setKw] = useState("");
  const [gallery, setGallery] = useState(initialGallery);
  const [offers, setOffers] = useState(initialOffers);
  const [events, setEvents] = useState(initialEvents);
  const [links, setLinks] = useState(initialLinks);
  const [linkDraft, setLinkDraft] = useState({ label: "", url: "" });
  const linkLimit = Number(features.custom_links ?? 0);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [offerDraft, setOfferDraft] = useState({ title: "", details: "", starts_at: "", ends_at: "" });
  const [eventDraft, setEventDraft] = useState({ title: "", details: "", starts_at: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoLimit = Number(features.photo_limit ?? 5);
  const today = new Date().toISOString().slice(0, 10);

  const [looks, setLooks] = useState<Palette[] | null>(null);
  const [lookBusy, setLookBusy] = useState(false);
  async function pickFromLogo() {
    if (!f.logo_url) return;
    setLookBusy(true);
    try {
      const list = await logoPalettes(f.logo_url);
      setLooks(list);
      if (!list.length) toast("No clear colours found in this logo.", true);
    } catch { toast("We could not read this logo's colours. Upload the logo again and try once more.", true); }
    finally { setLookBusy(false); }
  }
  const setColor = (k: "bg" | "accent" | "button", v: string | undefined) => setF((s) => { const c = { ...s.colors }; if (v) c[k] = v; else delete c[k]; return { ...s, colors: c }; });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function validUrl(v: string) {
    if (!v) return true;
    try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
  }
  function checkUrl(key: string, v: string) {
    setErrors((e) => ({ ...e, [key]: validUrl(v) ? "" : "This needs to be a full link starting with https://" }));
  }

  async function save() {
    const bad = ["google_review_url", "menu_url"].some((k) => !validUrl(f[k as "menu_url"])) || !validUrl(f.socials.membership_url ?? "");
    if (!f.name.trim()) return toast("Your business name cannot be empty.", true);
    if (bad) return toast("One of the links needs fixing before you publish.", true);
    setSaving(true);
    const socials = Object.fromEntries(Object.entries(f.socials).filter(([, v]) => v.trim()));
    const { error } = await sb.from("clients").update({
      name: f.name.trim(),
      tagline: f.tagline.trim() || null,
      google_review_url: f.google_review_url.trim() || null,
      menu_url: f.menu_url.trim() || null,
      theme: f.theme,
      colors: Object.fromEntries(Object.entries(f.colors).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v ?? ""))),
      logo_url: f.logo_url,
      socials,
      keywords: f.keywords,
      seo_keywords: f.seo_keywords.map((k) => k.trim()).filter(Boolean).slice(0, 8),
    }).eq("id", client.id);
    setSaving(false);
    if (error) return toast("Your changes did not publish. Please try again.", true);
    setSaved(JSON.stringify(f));
    toast("Published. Guests see the new page now.");
    router.refresh();
  }

  async function uploadAsset(file: File, folder: string) {
    const blob = await toWebp(file, folder === "logo" ? 400 : 1200);
    const path = `${client.id}/${folder}/${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from("page-assets").upload(path, blob, { contentType: "image/webp" });
    if (error) throw error;
    return sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
  }

  const menuInput = useRef<HTMLInputElement>(null);
  async function uploadMenuPdf(file: File) {
    if (file.type !== "application/pdf") return toast("Please choose a PDF file.", true);
    if (file.size > 10 * 1024 * 1024) return toast("That PDF is over 10 MB. Compress it and try again.", true);
    const path = `${client.id}/menu/${crypto.randomUUID()}.pdf`;
    const { error } = await sb.storage.from("page-assets").upload(path, file, { contentType: "application/pdf" });
    if (error) return toast("The PDF did not upload. Try again.", true);
    set("menu_url", sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl);
    toast("Menu PDF ready. Publish to show it.");
  }

  const isClip = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
  async function uploadClip(file: File) {
    if (file.size > 20 * 1024 * 1024) throw new Error("big");
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
    const path = `${client.id}/gallery/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("page-assets").upload(path, file, { contentType: file.type || "video/mp4" });
    if (error) throw error;
    return sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
  }
  async function reorderPhotos(next: Photo[]) {
    const prev = gallery;
    const numbered = next.map((p, i) => ({ ...p, sort: i + 1 }));
    setGallery(numbered);
    const changed = numbered.filter((p) => prev.find((q) => q.id === p.id)?.sort !== p.sort);
    const r = await Promise.all(changed.map((p) => sb.from("gallery_photos").update({ sort: p.sort }).eq("id", p.id)));
    if (r.some((x) => x.error)) { setGallery(prev); toast("The new order did not save. Please try again.", true); }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = photoLimit - gallery.length;
    if (room <= 0) return toast(`Your plan allows ${photoLimit} photos or clips. Remove one to add another.`, true);
    setUploading(true);
    let added = 0;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const clip = file.type.startsWith("video/");
        const url = clip ? await uploadClip(file) : await uploadAsset(file, "gallery");
        const sort = (gallery.at(-1)?.sort ?? 0) + 1 + added;
        const { data, error } = await sb.from("gallery_photos").insert({ client_id: client.id, url, sort }).select("id, url, label, caption, sort").single();
        if (error) throw error;
        setGallery((g) => [...g, data]);
        added++;
      } catch {
        toast(file.type.startsWith("video/") ? `${file.name} did not upload. Clips can be up to 20 MB (MP4, WebM or MOV).` : `${file.name} did not upload. Try a JPG or PNG photo.`, true);
      }
    }
    setUploading(false);
    if (added) toast(added === 1 ? "Added" : `${added} added`);
  }

  async function updatePhoto(id: string, patch: Partial<Photo>) {
    setGallery((g) => g.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await sb.from("gallery_photos").update(patch).eq("id", id);
    if (error) toast("That photo change did not save.", true);
  }

  async function removePhoto(id: string) {
    const prev = gallery;
    setGallery((g) => g.filter((p) => p.id !== id));
    const { error } = await sb.from("gallery_photos").delete().eq("id", id);
    if (error) { setGallery(prev); return toast("The photo was not removed. Please try again.", true); }
    toast("Photo removed");
  }

  async function addOffer() {
    if (!offerDraft.title.trim()) return setErrors((e) => ({ ...e, offer: "Give the offer a short title, like HAPPY HOURS." }));
    if (offerDraft.starts_at && offerDraft.ends_at && offerDraft.ends_at < offerDraft.starts_at) return setErrors((e) => ({ ...e, offer: "The end date is before the start date." }));
    const { data, error } = await sb.from("offers").insert({
      client_id: client.id,
      title: offerDraft.title.trim().toUpperCase(),
      details: offerDraft.details.trim() || null,
      starts_at: offerDraft.starts_at || null,
      ends_at: offerDraft.ends_at || null,
    }).select("id, title, details, starts_at, ends_at, claimable").single();
    if (error) return toast("The offer did not save. Please try again.", true);
    setOffers((o) => [data, ...o]);
    setOfferDraft({ title: "", details: "", starts_at: "", ends_at: "" });
    toast("Offer is live");
  }

  async function removeOffer(id: string) {
    const { error } = await sb.from("offers").delete().eq("id", id);
    if (error) return toast("The offer was not removed. Please try again.", true);
    setOffers((o) => o.filter((x) => x.id !== id));
    toast("Offer removed");
  }

  async function addEvent() {
    if (!eventDraft.title.trim() || !eventDraft.starts_at) return setErrors((e) => ({ ...e, event: "Add a title and a date and time." }));
    const { data, error } = await sb.from("events").insert({
      client_id: client.id,
      title: eventDraft.title.trim(),
      details: eventDraft.details.trim() || null,
      starts_at: new Date(eventDraft.starts_at).toISOString(),
    }).select("id, title, details, starts_at").single();
    if (error) return toast("The event did not save. Please try again.", true);
    setEvents((v) => [...v, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setEventDraft({ title: "", details: "", starts_at: "" });
    toast("Event added");
  }

  async function removeEvent(id: string) {
    const { error } = await sb.from("events").delete().eq("id", id);
    if (error) return toast("The event was not removed. Please try again.", true);
    setEvents((v) => v.filter((x) => x.id !== id));
    toast("Event removed");
  }

  // Extra link buttons: the admin sets how many are allowed; the database enforces it too.
  const normUrl = (v: string) => {
    const t = v.trim();
    if (/^(https?:\/\/|tel:|mailto:)/i.test(t)) return t;
    if (/^\+?[\d\s-]{8,15}$/.test(t)) return "tel:" + t.replace(/[\s-]/g, "");
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "mailto:" + t;
    return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? "https://" + t : "";
  };
  async function addLink() {
    const label = linkDraft.label.trim();
    const url = normUrl(linkDraft.url);
    if (!label) return setErrors((e) => ({ ...e, link: "Give the button a name, like Book a table." }));
    if (!url) return setErrors((e) => ({ ...e, link: "That link does not look right. Use a web address like https://example.com, or a phone number." }));
    if (links.length >= linkLimit) return setErrors((e) => ({ ...e, link: `You can add ${linkLimit} link${linkLimit === 1 ? "" : "s"}. Remove one to add another.` }));
    const sort = (links.at(-1)?.sort ?? 0) + 1;
    const { data, error } = await sb.from("client_links").insert({ client_id: client.id, label, url, sort }).select("id, label, url, sort").single();
    if (error || !data) return toast(/limit|switched on/i.test(error?.message ?? "") ? "Extra links are not switched on for you, or the limit is used up." : "The link did not save. Please try again.", true);
    setLinks((l) => [...l, data]);
    setLinkDraft({ label: "", url: "" });
    setErrors((e) => ({ ...e, link: "" }));
    toast("Button added. It is live on your page.");
  }
  async function removeLink(id: string) {
    const { error } = await sb.from("client_links").delete().eq("id", id);
    if (error) return toast("The button was not removed. Please try again.", true);
    setLinks((l) => l.filter((x) => x.id !== id));
    toast("Button removed");
  }
  async function moveLink(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= links.length) return;
    const a = links[i], b = links[j];
    const next = links.map((x, k) => (k === i ? { ...x, sort: b.sort } : k === j ? { ...x, sort: a.sort } : x)).sort((x, y) => x.sort - y.sort);
    setLinks(next);
    const r = await Promise.all([sb.from("client_links").update({ sort: b.sort }).eq("id", a.id), sb.from("client_links").update({ sort: a.sort }).eq("id", b.id)]);
    if (r.some((x) => x.error)) toast("The new order did not save.", true);
  }

  // The preview runs the real guest page component on the unsaved values.
  const preview: GuestPageData = useMemo(() => ({
    live: client.status === "active",
    plate: { code: "preview", label: "Table 1" },
    client: {
      id: client.id, slug: client.slug, name: f.name || "Your business", tagline: f.tagline || template?.tagline || null,
      logo_url: f.logo_url, theme: f.theme, colors: f.colors, google_review_url: f.google_review_url || null, menu_url: f.menu_url || null,
      business_type: client.business_type, socials: f.socials, keywords: f.keywords,
      review_chips: template?.review_chips ?? [], card_config: {}, card_copy: template?.card_copy ?? {},
    },
    features: features as GuestPageData["features"],
    gallery: gallery.slice(0, photoLimit),
    offers: offers.filter((o) => (!o.starts_at || o.starts_at <= today) && (!o.ends_at || o.ends_at >= today)),
    events: events.filter((e) => new Date(e.starts_at).getTime() > Date.now() - 6 * 36e5),
    reviews: [],
    links: links.slice(0, linkLimit).map((l) => ({ label: l.label, url: l.url })),
  }), [f, gallery, offers, events, links, linkLimit, features, client, template, photoLimit, today]);

  const phoneFrame = (
    <div className="mx-auto w-[340px] overflow-hidden rounded-[36px] p-2" style={{ background: "linear-gradient(223deg,rgba(207,207,207,.25),rgba(60,60,60,.25))", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
      <div className="h-[680px] overflow-y-auto rounded-[28px] [&_.min-h-dvh]:min-h-full" inert>
        <GuestPage data={preview} code="preview" />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">My Page</h1>
          <p className="mt-1" style={{ color: "var(--d-muted)" }}>What guests see when they tap your plate.</p>
        </div>
        <button onClick={() => setShowPreview(true)} className="d-btn d-btn-s lg:hidden"><Smartphone size={16} /> Preview</button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_356px]">
        <div className="space-y-4">
          <Section title="Basics">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => logoInput.current?.click()} className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }} aria-label="Change logo">
                {f.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.logo_url} alt="" className="h-full w-full object-cover" />
                ) : <ImagePlus size={20} />}
              </button>
              <input ref={logoInput} type="file" accept="image/*" hidden onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = "";
                if (!file) return;
                try { set("logo_url", await uploadAsset(file, "logo")); toast("Logo ready. Publish to show it."); } catch { toast("The logo did not upload. Try a JPG or PNG.", true); }
              }} />
              <div className="text-sm" style={{ color: "var(--d-muted)" }}>Square logo works best. We shrink it for fast loading.</div>
            </div>
            <Field label="Business name"><input className="d-input" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={60} /></Field>
            <Field label="Tagline" hint="One short line"><input className="d-input" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={80} placeholder={template?.tagline ?? ""} /></Field>
          </Section>

          <Section title="Look" sub="Pick the theme guests see.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Theme">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const t = THEMES[id];
                const on = f.theme === id;
                return (
                  <button key={id} role="radio" aria-checked={on} onClick={() => set("theme", id)} className="rounded-lg p-2 text-left text-sm" style={{ boxShadow: `inset 0 0 0 ${on ? 2 : 1}px ${on ? "var(--d-blue)" : "var(--d-line-2)"}` }}>
                    <span className="mb-2 flex h-14 flex-col justify-end gap-1 rounded-md p-1.5" style={{ background: t.vars["--bg"] }}>
                      <span className="h-2 rounded-sm" style={{ background: t.vars["--surface"] }} />
                      <span className="h-2 w-2/3 rounded-sm" style={{ background: t.vars["--surface-2"] }} />
                    </span>
                    <span style={{ color: on ? "var(--d-text)" : "var(--d-sub)" }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Colours" sub="Pick any colour for the background, the soft glow at the top and the buttons. Text turns light or dark by itself so it stays readable. Leave a colour empty to keep the theme's.">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="d-btn d-btn-p" disabled={!f.logo_url || lookBusy} onClick={() => void pickFromLogo()}>{lookBusy && <Loader2 size={15} className="animate-spin" />} Pick colours from my logo</button>
              {!f.logo_url && <span className="text-xs" style={{ color: "var(--d-muted)" }}>Add a logo first.</span>}
            </div>
            {looks && looks.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Looks made from your logo">
                {looks.map((p) => { const on = f.colors.bg === p.bg && f.colors.accent === p.accent && f.colors.button === p.button; return (
                  <button key={p.name} type="button" aria-pressed={on} onClick={() => set("colors", { bg: p.bg, accent: p.accent, button: p.button })} className="overflow-hidden rounded-xl text-left" style={{ boxShadow: on ? "0 0 0 2px var(--d-bg), 0 0 0 4px var(--d-text)" : "inset 0 0 0 1px var(--d-line-2)" }}>
                    <span className="block px-3 pt-3 pb-3" style={{ background: p.bg, color: "#fff" }}>
                      <span className="block h-1.5 w-10 rounded-full" style={{ background: p.accent }} />
                      <span className="mt-2 block rounded-full py-1.5 text-center text-[11px] font-semibold" style={{ background: p.button, color: "#111" }}>Button</span>
                    </span>
                    <span className="block px-3 py-2 text-xs" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{p.name}</span>
                  </button>); })}
              </div>
            )}
            <ColorField label="Background" value={f.colors.bg} fallback={THEMES[f.theme].vars["--bg"]} swatches={BG_SWATCHES} onChange={(v) => setColor("bg", v)} />
            <ColorField label="Accent and glow" hint="the soft light at the top" value={f.colors.accent} fallback={THEMES[f.theme].vars["--top"] ?? THEMES[f.theme].vars["--surface-2"]} onChange={(v) => setColor("accent", v)} />
            <ColorField label="Buttons" hint="the big buttons and chosen options" value={f.colors.button} fallback={THEMES[f.theme].vars["--text"]} onChange={(v) => setColor("button", v)} />
            <button type="button" className="d-btn d-btn-s" disabled={!Object.keys(f.colors).length} onClick={() => set("colors", {})}>Reset all colours</button>
          </Section>

          <Section title="Links">
            <Field label="Google review link" hint="Where the review button opens">
              <input className="d-input" inputMode="url" value={f.google_review_url} onChange={(e) => { set("google_review_url", e.target.value); if (errors.google_review_url) checkUrl("google_review_url", e.target.value); }} onBlur={(e) => checkUrl("google_review_url", e.target.value)} placeholder="https://g.page/r/..." />
              {errors.google_review_url && <span className="mt-1 block text-sm" style={{ color: "var(--d-red)" }}>{errors.google_review_url}</span>}
            </Field>
            <Field label="Menu" hint="Paste the link your table QR opens, or upload your menu as a PDF">
              <input className="d-input" inputMode="url" value={f.menu_url} onChange={(e) => { set("menu_url", e.target.value); if (errors.menu_url) checkUrl("menu_url", e.target.value); }} onBlur={(e) => checkUrl("menu_url", e.target.value)} placeholder="https://" />
              {errors.menu_url && <span className="mt-1 block text-sm" style={{ color: "var(--d-red)" }}>{errors.menu_url}</span>}
              <input ref={menuInput} type="file" accept="application/pdf" hidden onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ""; if (x) void uploadMenuPdf(x); }} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="d-btn d-btn-s" onClick={() => menuInput.current?.click()}>Upload a PDF menu</button>
                {f.menu_url && <button type="button" className="d-btn d-btn-s" onClick={() => set("menu_url", "")}>Remove menu</button>}
              </div>
            </Field>
            <Field label="Membership card link" hint="Where the membership card opens: your sign-up form, loyalty page or WhatsApp link. Leave empty to hide the card.">
              <input className="d-input" inputMode="url" value={f.socials.membership_url ?? ""} onChange={(e) => { set("socials", { ...f.socials, membership_url: e.target.value }); if (errors.membership_url) checkUrl("membership_url", e.target.value); }} onBlur={(e) => checkUrl("membership_url", e.target.value)} placeholder="https://" />
              {errors.membership_url && <span className="mt-1 block text-sm" style={{ color: "var(--d-red)" }}>{errors.membership_url}</span>}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIALS.map(([k, label]) => (
                <Field key={k} label={label}>
                  <input className="d-input" inputMode={k === "phone" ? "tel" : "url"} value={f.socials[k] ?? ""} onChange={(e) => set("socials", { ...f.socials, [k]: e.target.value })} placeholder={k === "phone" ? "+91 98765 43210" : "https://"} />
                </Field>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wi-Fi name" hint="Guests see a Wi-Fi card with a QR code. Leave empty to hide it.">
                <input className="d-input" autoComplete="off" value={f.socials.wifi_name ?? ""} onChange={(e) => set("socials", { ...f.socials, wifi_name: e.target.value })} placeholder="Network name" />
              </Field>
              <Field label="Wi-Fi password" hint="Anyone who opens your page can see it. Use a guest network.">
                <input className="d-input" autoComplete="off" value={f.socials.wifi_password ?? ""} onChange={(e) => set("socials", { ...f.socials, wifi_password: e.target.value })} placeholder="Password" />
              </Field>
            </div>
          </Section>

          <Section title="Keywords" sub="Short words about your place. They slide under your photos.">
            <div className="flex flex-wrap gap-2">
              {f.keywords.map((k) => (
                <span key={k} className="d-raise flex items-center gap-1 py-1 pr-1 pl-3 text-sm" style={{ color: "var(--d-text)" }}>
                  {k}
                  <button onClick={() => set("keywords", f.keywords.filter((x) => x !== k))} aria-label={`Remove ${k}`} className="grid h-11 w-11 place-items-center -my-1.5" style={{ color: "var(--d-muted)" }}><X size={14} /></button>
                </span>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = kw.trim(); if (v && !f.keywords.includes(v) && f.keywords.length < 12) set("keywords", [...f.keywords, v]); setKw(""); }}>
              <label className="sr-only" htmlFor="kw">New keyword</label>
              <input id="kw" className="d-input" value={kw} onChange={(e) => setKw(e.target.value)} maxLength={24} placeholder="Pet Friendly" />
              <button className="d-btn d-btn-s">Add keyword</button>
            </form>
          </Section>

          <Section title="Search phrases" sub="What people type into Google to find you, for example: cafe in C-Scheme Jaipur. We use one of these now and then in replies to good reviews, only where it fits. Up to 8, one per line. Real phrases only, no repeats.">
            <label className="sr-only" htmlFor="seo">Search phrases</label>
            <textarea id="seo" className="d-input min-h-28" maxLength={600} value={f.seo_keywords.join("\n")} onChange={(e) => set("seo_keywords", e.target.value.split("\n").slice(0, 8).map((x) => x.slice(0, 60)))} placeholder={"cafe in C-Scheme Jaipur\nbest coffee in Jaipur"} />
          </Section>

          <Section title="Photos and videos" sub={`${gallery.length} of ${photoLimit} on your plan. Guests see them in this order. Press and hold the dots on the left and drag to move one. Clips play muted and loop; up to 20 MB each (MP4, WebM or MOV).`}>
            {gallery.length === 0 && <p className="text-sm" style={{ color: "var(--d-muted)" }}>Nothing yet. Your best dish or your favourite corner is a great first photo.</p>}
            <SortableList className="space-y-2" items={gallery} keyOf={(p) => p.id} onChange={(n) => void reorderPhotos(n)} render={(p, i, grip) => (
              <div className="d-raise flex items-center gap-2 p-2">
                <Grip label={`Drag item ${i + 1} to move it`} {...grip} />
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md" style={{ background: "var(--d-bg)" }}>
                  {isClip(p.url)
                    ? <><video src={p.url} muted playsInline preload="metadata" aria-label={`Clip ${i + 1}`} className="h-full w-full object-cover" /><span className="absolute bottom-0.5 left-0.5 rounded-full bg-black/70 px-1.5 text-[9px] font-semibold text-white">VIDEO</span></>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={p.url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <label className="sr-only" htmlFor={`cap-${p.id}`}>Caption</label>
                  <input id={`cap-${p.id}`} className="d-input" defaultValue={p.caption ?? ""} placeholder="Dish or caption" onBlur={(e) => e.target.value !== (p.caption ?? "") && updatePhoto(p.id, { caption: e.target.value || null })} />
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={p.label === "BEST SELLER"} onChange={(e) => updatePhoto(p.id, { label: e.target.checked ? "BEST SELLER" : null })} />
                    Best seller label
                  </label>
                </div>
                <div className="flex shrink-0 flex-col">
                  <button type="button" className="grid h-8 w-8 place-items-center" aria-label={`Move item ${i + 1} earlier`} disabled={i === 0} onClick={() => void reorderPhotos(moveItem(gallery, i, -1))} style={{ color: "var(--d-muted)" }}><ArrowUp size={15} /></button>
                  <button type="button" className="grid h-8 w-8 place-items-center" aria-label={`Move item ${i + 1} later`} disabled={i === gallery.length - 1} onClick={() => void reorderPhotos(moveItem(gallery, i, 1))} style={{ color: "var(--d-muted)" }}><ArrowDown size={15} /></button>
                </div>
                <button onClick={() => removePhoto(p.id)} aria-label="Remove" className="grid h-11 w-11 shrink-0 place-items-center" style={{ color: "var(--d-muted)" }}><Trash2 size={17} /></button>
              </div>
            )} />
            <input ref={photoInput} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            <button onClick={() => photoInput.current?.click()} disabled={uploading || gallery.length >= photoLimit} className="d-btn d-btn-s">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} {uploading ? "Uploading" : "Add photos or videos"}
            </button>
          </Section>

          <Section id="offers" title="Live offers (announcements)" sub="These run in the black strip on your guest page and on your mini link, and they disappear on their end date.">
            <ul className="space-y-2">
              {offers.map((o) => {
                const ended = o.ends_at && o.ends_at < today;
                return (
                  <li key={o.id} className="d-raise flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" style={{ color: "var(--d-text)" }}>{o.title}</p>
                      {o.details && <p className="text-sm" style={{ color: "var(--d-muted)" }}>{o.details}</p>}
                      <p className="mt-1 text-xs" style={{ color: ended ? "var(--d-red)" : "var(--d-muted)" }}>
                        {ended ? "Ended" : o.ends_at ? `Till ${new Date(o.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "No end date"}
                      </p>
                    </div>
                    <button onClick={() => removeOffer(o.id)} aria-label={`Remove ${o.title}`} className="grid h-11 w-11 place-items-center" style={{ color: "var(--d-muted)" }}><Trash2 size={17} /></button>
                  </li>
                );
              })}
            </ul>
            <form className="d-raise grid gap-3 p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErrors((x) => ({ ...x, offer: "" })); addOffer(); }}>
              <Field label="Title"><input className="d-input" value={offerDraft.title} onChange={(e) => { setOfferDraft({ ...offerDraft, title: e.target.value }); setErrors((x) => ({ ...x, offer: "" })); }} maxLength={30} placeholder="HAPPY HOURS" /></Field>
              <Field label="Details"><input className="d-input" value={offerDraft.details} onChange={(e) => setOfferDraft({ ...offerDraft, details: e.target.value })} maxLength={80} placeholder="20% off on all beverages, 4 to 7 pm" /></Field>
              <Field label="Starts" hint="optional"><input type="date" className="d-input" value={offerDraft.starts_at} onChange={(e) => setOfferDraft({ ...offerDraft, starts_at: e.target.value })} /></Field>
              <Field label="Ends" hint="optional"><input type="date" className="d-input" min={offerDraft.starts_at || today} value={offerDraft.ends_at} onChange={(e) => setOfferDraft({ ...offerDraft, ends_at: e.target.value })} /></Field>
              {errors.offer && <p className="text-sm sm:col-span-2" style={{ color: "var(--d-red)" }}>{errors.offer}</p>}
              <button className="d-btn d-btn-s sm:col-span-2"><Plus size={16} /> Add offer</button>
            </form>
          </Section>

          {linkLimit > 0 ? (
            <Section id="links" title="Extra links" sub={`Add a button with a name and a link, for example Book a table or Order on Swiggy. ${links.length} of ${linkLimit} used.`}>
              <ul className="space-y-2">
                {links.map((l, i) => (
                  <li key={l.id} className="d-raise flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" style={{ color: "var(--d-text)" }}>{l.label}</p>
                      <p className="truncate text-xs" style={{ color: "var(--d-muted)" }}>{l.url}</p>
                    </div>
                    <button className="d-btn d-btn-s !min-h-10 !px-3" disabled={i === 0} aria-label={`Move ${l.label} up`} onClick={() => moveLink(i, -1)}>↑</button>
                    <button className="d-btn d-btn-s !min-h-10 !px-3" disabled={i === links.length - 1} aria-label={`Move ${l.label} down`} onClick={() => moveLink(i, 1)}>↓</button>
                    <button onClick={() => removeLink(l.id)} aria-label={`Remove ${l.label}`} className="grid h-11 w-11 place-items-center" style={{ color: "var(--d-muted)" }}><Trash2 size={17} /></button>
                  </li>
                ))}
              </ul>
              {links.length < linkLimit ? (
                <form className="d-raise grid gap-3 p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); addLink(); }} noValidate>
                  <Field label="Button name"><input className="d-input" value={linkDraft.label} maxLength={40} onChange={(e) => { setLinkDraft({ ...linkDraft, label: e.target.value }); setErrors((x) => ({ ...x, link: "" })); }} placeholder="Book a table" /></Field>
                  <Field label="Link"><input className="d-input" inputMode="url" value={linkDraft.url} onChange={(e) => { setLinkDraft({ ...linkDraft, url: e.target.value }); setErrors((x) => ({ ...x, link: "" })); }} placeholder="https://example.com/book" /></Field>
                  {errors.link && <p role="alert" className="text-sm sm:col-span-2" style={{ color: "var(--d-red)" }}>{errors.link}</p>}
                  <button className="d-btn d-btn-s sm:col-span-2"><Plus size={16} /> Add button</button>
                </form>
              ) : (
                <p className="text-sm" style={{ color: "var(--d-muted)" }}>You have used all {linkLimit}. Remove one to add another, or ask Taprizz for more.</p>
              )}
            </Section>
          ) : (
            <div className="d-card flex items-center gap-3 p-5 text-sm" style={{ color: "var(--d-muted)" }}>
              <Lock size={16} /> Want extra link buttons, like Book a table? Ask Taprizz to switch them on.
            </div>
          )}

          {features.events ? (
            <Section title="Events" sub="Upcoming nights, workshops and gatherings.">
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id} className="d-raise flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" style={{ color: "var(--d-text)" }}>{ev.title}</p>
                      <p className="text-xs" style={{ color: "var(--d-muted)" }}>{new Date(ev.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                    </div>
                    <button onClick={() => removeEvent(ev.id)} aria-label={`Remove ${ev.title}`} className="grid h-11 w-11 place-items-center" style={{ color: "var(--d-muted)" }}><Trash2 size={17} /></button>
                  </li>
                ))}
              </ul>
              <form className="d-raise grid gap-3 p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErrors((x) => ({ ...x, event: "" })); addEvent(); }}>
                <Field label="Title"><input className="d-input" value={eventDraft.title} onChange={(e) => setEventDraft({ ...eventDraft, title: e.target.value })} maxLength={50} placeholder="Open mic night" /></Field>
                <Field label="Date and time"><input type="datetime-local" className="d-input" value={eventDraft.starts_at} onChange={(e) => setEventDraft({ ...eventDraft, starts_at: e.target.value })} /></Field>
                <div className="sm:col-span-2"><Field label="Details" hint="optional"><input className="d-input" value={eventDraft.details} onChange={(e) => setEventDraft({ ...eventDraft, details: e.target.value })} maxLength={100} /></Field></div>
                {errors.event && <p className="text-sm sm:col-span-2" style={{ color: "var(--d-red)" }}>{errors.event}</p>}
                <button className="d-btn d-btn-s sm:col-span-2"><Plus size={16} /> Add event</button>
              </form>
            </Section>
          ) : (
            <div className="d-card flex items-center gap-3 p-5 text-sm" style={{ color: "var(--d-muted)" }}>
              <Lock size={16} /> Events come with the Premium plan.
            </div>
          )}
        </div>

        <aside className="sticky top-24 hidden lg:block" aria-label="Live preview">
          <p className="mb-3 text-center text-sm" style={{ color: "var(--d-muted)" }}>Live preview</p>
          {phoneFrame}
        </aside>
      </div>

      {/* Publish bar: appears when there are unsaved page changes */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 md:bottom-6">
          <div className="d-raise mx-auto flex max-w-xl items-center justify-between gap-3 p-3 pl-4 shadow-2xl">
            <span className="text-sm" style={{ color: "var(--d-text)" }}>You have unpublished changes</span>
            <div className="flex gap-2">
              <button onClick={() => setF(JSON.parse(saved))} className="d-btn d-btn-s">Discard</button>
              <button onClick={save} disabled={saving} className="d-btn d-btn-p">{saving && <Loader2 size={16} className="animate-spin" />} Publish</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 lg:hidden" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="mb-3 flex justify-end">
            <button onClick={() => setShowPreview(false)} className="d-btn d-btn-s"><X size={16} /> Close preview</button>
          </div>
          {phoneFrame}
        </div>
      )}
    </div>
  );
}
