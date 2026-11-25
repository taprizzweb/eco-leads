"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { SortableList, Grip } from "@/components/ui/SortableList";
import { PhoneField } from "@/components/ui/PhoneField";
import { MiniLinks } from "@/components/link/MiniLinks";
import { miniNormalize } from "@/lib/mini";
import { ColorField, BG_SWATCHES } from "@/components/ui/ColorField";
import { logoPalettes, type Palette } from "@/lib/logo-colors";
import { useToast } from "@/components/dash/Toast";
import { slugify, LINK_BASE } from "@/lib/features";
import { downloadUrlQr } from "@/components/admin/qr";
import { BUTTON_ICONS, ICON_LABEL, isHex, isVideo, MAX_VIDEO_BYTES, LINK_THEMES, getLinkTheme, type LinkColors, type LinkButton, type LinkOffer, type LinkOutlet, type LinkPhoto, type LinkReview, type LinkSocials, type LinkTheme } from "@/lib/linkpage";

type Row = {
  id: string; slug: string; client_id: string | null; name: string; tagline: string | null; logo_url: string | null; theme: string; colors?: LinkColors; seo_keywords?: string[]; tags: string[];
  socials: LinkSocials; photos: LinkPhoto[]; buttons: LinkButton[]; outlets: LinkOutlet[]; offers: LinkOffer[]; reviews: LinkReview[];
  show_client_reviews: boolean; ai_review?: boolean; ai_review_label?: string | null; ai_review_pos?: "top" | "bottom"; published: boolean; photo_direction: "forward" | "backward"; fee_inr: number; billing_note: string | null;
};

/** admin: Taprizz team (everything). member: the business owner or manager signed in. token: the private control link, no login. */
export type EditorMode = "admin" | "member" | "token";

/** Shows a feature exactly as it will look, dimmed and locked, with a way to upgrade. Children are not clickable while locked. */
function Gate({ locked, title, text, children }: { locked: boolean; title: string; text: string; children: React.ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden inert style={{ opacity: 0.42, filter: "grayscale(0.4)", pointerEvents: "none" }}>{children}</div>
      <div className="absolute inset-0 flex items-start justify-center p-4 pt-28">
        <div className="max-w-xs rounded-2xl p-4 text-center" style={{ background: "var(--d-surface)", boxShadow: "0 18px 40px -16px rgba(0,0,0,.45), inset 0 0 0 1px var(--d-line-2)" }}>
          <p className="text-2xl" aria-hidden>🔒</p>
          <p className="mt-1 font-semibold">{title} <span className="text-xs font-medium" style={{ color: "var(--d-muted)" }}>Premium</span></p>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>{text}</p>
          <button type="button" className="d-btn d-btn-p mt-3" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Upgrade for Rs 150</button>
        </div>
      </div>
    </div>
  );
}

function LockedCard({ title, text }: { title: string; text: string }) {
  return (
    <section className="d-card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }} aria-hidden>🔒</span>
      <div className="min-w-0 flex-1"><p className="font-semibold">{title} <span className="text-xs font-medium" style={{ color: "var(--d-muted)" }}>Premium</span></p><p className="text-sm" style={{ color: "var(--d-muted)" }}>{text}</p></div>
      <button type="button" className="d-btn d-btn-s shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Upgrade</button>
    </section>
  );
}

// Module level on purpose: defined inside the editor it would remount on every keystroke and the field would lose focus.
function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>{label}</span>{hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{hint}</span>}<span className="mt-1.5 block">{children}</span></label>
  );
}
function Sec({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="d-card space-y-4 p-5"><div><h2 className="font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-sm" style={{ color: "var(--d-muted)" }}>{sub}</p>}</div>{children}</section>;
}
// Quick picks for the background. The round picker next to them reaches every other colour.
const move = <T,>(a: T[], i: number, d: -1 | 1): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };
const SOCIAL_FIELDS: [keyof LinkSocials, string, string][] = [
  ["instagram", "Instagram", "https://instagram.com/yourcafe"], ["facebook", "Facebook", "https://facebook.com/yourcafe"], ["zomato", "Zomato", "https://zomato.com/..."],
  ["swiggy", "Swiggy", "https://swiggy.com/..."], ["whatsapp", "WhatsApp number", "98765 43210"], ["maps", "Google Maps", "https://maps.google.com/..."],
  ["phone", "Phone number", "+91 98765 43210"], ["website", "Website", "https://"],
];

export function LinkEditor({ initial, clientName, mode = "admin", token, mini = false, premium = false }: { initial: Row; clientName: string | null; mode?: EditorMode; token?: string; mini?: boolean; premium?: boolean }) {
  const admin = mode === "admin";
  const maxPhotos = mini ? (premium ? 10 : 3) : 30;
  const [step, setStep] = useState(1);
  const goStep = (n: number) => { setStep(n); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Uploads: the team uses links/<page>, a signed-in business uses its own folder, the control link uses a folder named by its secret.
  const folder = mode === "token" ? `link-edit/${token}` : mode === "member" ? `${initial.client_id}/links` : `links/${initial.id}`;
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [r, setR] = useState<Row>(initial);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [seoText, setSeoText] = useState((initial.seo_keywords ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<string | null>(null);
  const [ver, setVer] = useState(0);
  const logoIn = useRef<HTMLInputElement>(null);
  const [looks, setLooks] = useState<Palette[] | null>(null);
  const [lookBusy, setLookBusy] = useState(false);
  async function pickFromLogo(src: Blob | string, quiet = false) {
    setLookBusy(true);
    try {
      const list = await logoPalettes(src);
      setLooks(list);
      if (!list.length) toast("No clear colours found in this logo.", true);
      else if (quiet) toast("Colour ideas ready from your logo. See Colours.");
    } catch {
      if (!quiet) toast("Taprizz could not read this logo's colours. Upload the logo here again and try once more.", true);
    } finally { setLookBusy(false); }
  }
  const photoIn = useRef<HTMLInputElement>(null);
  const outletTarget = useRef<number>(0);
  const outletIn = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Row>(k: K, v: Row[K]) => setR((s) => ({ ...s, [k]: v }));

  async function upload(file: File, max: number): Promise<string> {
    const blob = await toWebp(file, max);
    const path = `${folder}/${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from("page-assets").upload(path, blob, { contentType: "image/webp" });
    if (error) throw error;
    return sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
  }

  async function uploadVideo(file: File): Promise<string> {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("big");
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("page-assets").upload(path, file, { contentType: file.type || "video/mp4" });
    if (error) throw error;
    return sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    if (!r.name.trim()) return toast("Add the business name.", true);
    const tags = tagText.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const seo_keywords = seoText.split(",").map((t) => t.trim().slice(0, 60)).filter(Boolean).slice(0, 8);
    const socials = Object.fromEntries(Object.entries(r.socials).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, String(v).trim()]));
    const norm = mini ? miniNormalize(socials as Record<string, string>, r.buttons) : null;
    if (norm?.error) return toast(norm.error, true);
    const content = {
      name: r.name.trim(), tagline: r.tagline?.trim() || null, logo_url: r.logo_url, theme: r.theme, colors: Object.fromEntries(Object.entries(r.colors ?? {}).filter(([, v]) => isHex(v))), tags, seo_keywords, socials: norm ? norm.socials : socials, photo_direction: r.photo_direction,
      photos: r.photos.slice(0, maxPhotos), buttons: (norm ? norm.buttons : r.buttons).filter((b) => b.label.trim()).slice(0, 12), outlets: r.outlets.filter((o) => o.name.trim()).slice(0, 30), offers: r.offers.filter((o) => o.title.trim()).slice(0, 60),
    };
    setBusy(true);
    let message: string | null = null;
    if (admin) {
      const slug = slugify(r.slug);
      if (!/^[a-z0-9-]{3,40}$/.test(slug)) { setBusy(false); return toast("The page link needs 3 to 40 letters, numbers or dashes.", true); }
      const { error } = await sb.from("link_pages").update({
        ...content, slug, reviews: r.reviews.filter((x) => x.author.trim() && x.body.trim()).slice(0, 30), show_client_reviews: r.show_client_reviews, ai_review: !!r.client_id && !!r.ai_review, ai_review_label: r.ai_review_label?.trim().slice(0, 30) || null, ai_review_pos: r.ai_review_pos === "bottom" ? "bottom" : "top", published: r.published,
        fee_inr: Math.max(0, Math.floor(Number(r.fee_inr) || 0)), billing_note: r.billing_note?.trim() || null, updated_at: new Date().toISOString(),
      }).eq("id", r.id);
      if (error) message = /duplicate|unique/i.test(error.message) ? "That page link is already taken." : "That did not save. Please try again.";
      else setR((st) => ({ ...st, slug, tags }));
    } else {
      const { error } = mode === "token" ? await sb.rpc("link_edit_save", { p_token: token, p_patch: content }) : await sb.rpc("link_my_save", { p_id: r.id, p_patch: content });
      if (error) message = /bad .* link/i.test(error.message) ? "One of the links is not a web address. Links start with https://, tel: or mailto:." : "That did not save. Please try again.";
      else setR((st) => ({ ...st, tags }));
    }
    setBusy(false);
    if (message) return toast(message, true);
    setVer((v) => v + 1);
    toast("Saved");
    if (admin) router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete the mini link for ${r.name}? The link stops working.`)) return;
    const { error } = await sb.from("link_pages").delete().eq("id", r.id);
    if (error) return toast("That could not be deleted.", true);
    router.push("/admin/tools/links");
  }

  const guard = async (key: string, fn: () => Promise<void>) => { setUp(key); try { await fn(); } catch { toast("The image did not upload. Try a JPG or PNG.", true); } finally { setUp(null); } };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {mini && (
          <div className="d-card p-3" role="group" aria-label="Steps">
            <div className="grid grid-cols-3 gap-2">
              {([[1, "Your look"], [2, "Your links"], [3, "Photos and more"]] as const).map(([n, label]) => (
                <button key={n} type="button" aria-pressed={step === n} onClick={() => goStep(n)} className="rounded-xl px-2 py-2.5 text-center text-sm font-medium" style={{ background: step === n ? "var(--d-text)" : "var(--d-bg)", color: step === n ? "var(--d-bg)" : "var(--d-text)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
                  <span className="block text-[11px] opacity-70">Step {n}</span>{label}
                </button>
              ))}
            </div>
          </div>
        )}
        {admin && (        <Sec title="Page" sub={clientName ? `Linked to the registered business ${clientName}.` : "A link-only business. It is not registered in Taprizz."}>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Page link" hint={`${LINK_BASE.replace(/^https?:\/\//, "")}/${slugify(r.slug) || "name"}`}><input className="d-input" maxLength={40} value={r.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></F>
            <F label="Status"><select className="d-input" value={r.published ? "live" : "draft"} onChange={(e) => set("published", e.target.value === "live")}><option value="live">Live</option><option value="draft">Draft (hidden)</option></select></F>
            <div className="sm:col-span-2">
              <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" disabled={!r.client_id} checked={!!r.ai_review && !!r.client_id} onChange={(e) => set("ai_review", e.target.checked)} />Allow &ldquo;AI Review by Tap&rdquo; on this page (Google review)</label>
              <p className="d-muted text-xs">{r.client_id ? "Guests pick stars and get an AI-written review for the registered business. Every rating gets the same flow; the business needs a Google review link." : "Needs a page linked to a registered business with a Google review link."}</p>
            </div>
            {!!r.client_id && !!r.ai_review && (<>
              <F label="Review button name" hint="Empty = AI Review by Tap"><input className="d-input" maxLength={30} value={r.ai_review_label ?? ""} onChange={(e) => set("ai_review_label", e.target.value)} placeholder="Rate us on Google" /></F>
              <F label="Review button position"><select className="d-input" value={r.ai_review_pos ?? "top"} onChange={(e) => set("ai_review_pos", e.target.value as "top" | "bottom")}><option value="top">Above the other buttons</option><option value="bottom">Below the other buttons</option></select></F>
            </>)}
            <F label="Fee for this page" hint="Rs, 0 means free"><input className="d-input" type="number" min={0} value={r.fee_inr} onChange={(e) => set("fee_inr", Number(e.target.value))} /></F>
            <F label="Billing note"><input className="d-input" maxLength={200} value={r.billing_note ?? ""} onChange={(e) => set("billing_note", e.target.value)} placeholder="Paid till March, free as a service..." /></F>
          </div>
        </Sec>)}

        {(!mini || step === 1) && (<Sec title="Template" sub={mini && !premium ? "Pick one of the templates. Premium also lets you set your own colours." : "The colours of the page."}>
          <div className="flex flex-wrap gap-2">{(Object.keys(LINK_THEMES) as LinkTheme[]).map((t) => (
            <button key={t} type="button" aria-pressed={r.theme === t} onClick={() => set("theme", t)} className="flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px]" style={{ background: "var(--d-bg)", color: "var(--d-text)", boxShadow: r.theme === t ? "inset 0 0 0 2px var(--d-text)" : "inset 0 0 0 1px var(--d-line-2)" }}>
              <span className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${LINK_THEMES[t].vars["--l-accent"]}, ${LINK_THEMES[t].vars["--l-bg"]})`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)" }} />{LINK_THEMES[t].label}
            </button>))}</div>
        </Sec>)}

        {(!mini || step === 1) && (<Gate locked={mini && !premium} title="Your own colours" text="Set any background colour, glow and button colour, or take them from your logo. Free pages use the templates above."><Sec title="Colours" sub="Pick any colour for the background, the glow and the buttons. Text turns light or dark by itself so it stays readable. Leave a colour empty to keep the template's.">
          {(() => { const t = getLinkTheme(r.theme, r.colors); const c = r.colors ?? {}; return (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="d-btn d-btn-p" disabled={!r.logo_url || lookBusy} onClick={() => r.logo_url && void pickFromLogo(r.logo_url)}>{lookBusy && <Loader2 size={15} className="animate-spin" />} Pick colours from my logo</button>
                  {!r.logo_url && <span className="text-xs" style={{ color: "var(--d-muted)" }}>Add a logo first.</span>}
                </div>
                {looks && looks.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Looks made from your logo">
                    {looks.map((p) => { const lt = getLinkTheme("midnight", { bg: p.bg, accent: p.accent, button: p.button }); const on = r.colors?.bg === p.bg && r.colors?.accent === p.accent && r.colors?.button === p.button; return (
                      <button key={p.name} type="button" aria-pressed={on} onClick={() => set("colors", { bg: p.bg, accent: p.accent, button: p.button })} className="overflow-hidden rounded-xl text-left" style={{ boxShadow: on ? "0 0 0 2px var(--d-bg), 0 0 0 4px var(--d-text)" : "inset 0 0 0 1px var(--d-line-2)" }}>
                        <span className="block px-3 pt-3 pb-3" style={{ background: `radial-gradient(90% 70px at 50% -20px, ${lt.vars["--l-glow"]}, transparent 70%), ${lt.vars["--l-bg"]}`, color: lt.vars["--l-text"] }}>
                          <span className="block text-[11px] font-semibold uppercase tracking-wide">{r.name || "Name"}</span>
                          <span className="mt-2 block rounded-full py-1.5 text-center text-[11px] font-semibold uppercase" style={{ background: lt.vars["--l-pill"], color: lt.vars["--l-pill-text"] }}>Button</span>
                        </span>
                        <span className="block px-3 py-2 text-xs" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{p.name}</span>
                      </button>); })}
                  </div>
                )}
                <p className="text-xs" style={{ color: "var(--d-muted)" }}>Or keep a template above and fine-tune any colour below.</p>
              </div>
              <ColorField label="Background" value={c.bg} fallback={getLinkTheme(r.theme).vars["--l-bg"]} swatches={BG_SWATCHES} onChange={(v) => setR((st) => ({ ...st, colors: { ...st.colors, bg: v } }))} />
              <ColorField label="Accent and glow" hint="the soft light at the top" value={c.accent} fallback={getLinkTheme(r.theme).vars["--l-accent"]} onChange={(v) => setR((st) => ({ ...st, colors: { ...st.colors, accent: v } }))} />
              <ColorField label="Buttons" hint="the big link buttons" value={c.button} fallback={getLinkTheme(r.theme).vars["--l-pill"]} onChange={(v) => setR((st) => ({ ...st, colors: { ...st.colors, button: v } }))} />
              <div className="rounded-2xl p-4" style={{ background: `radial-gradient(90% 120px at 50% -30px, ${t.vars["--l-glow"]}, transparent 70%), ${t.vars["--l-bg"]}`, color: t.vars["--l-text"] }}>
                <p className="text-center text-xs" style={{ color: t.vars["--l-muted"] }}>How it looks</p>
                <p className="mt-1 text-center text-xl font-semibold uppercase tracking-wide">{r.name || "Your name"}</p>
                <div className="mx-auto mt-3 max-w-xs rounded-full py-2.5 text-center text-sm font-semibold uppercase" style={{ background: t.vars["--l-pill"], color: t.vars["--l-pill-text"] }}>A link button</div>
              </div>
              <button type="button" className="d-btn d-btn-s" disabled={!Object.keys(c).length} onClick={() => set("colors", {})}>Reset all colours</button>
            </>
          ); })()}
        </Sec></Gate>)}

        {(!mini || step === 1) && (<Sec title="Profile">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => logoIn.current?.click()} aria-label="Change logo" className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
              {up === "logo" ? <Loader2 className="animate-spin" /> : r.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.logo_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} style={{ color: "var(--d-muted)" }} />}
            </button>
            <input ref={logoIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void guard("logo", async () => { set("logo_url", await upload(f, 500)); if (!mini || premium) void pickFromLogo(f, true); }); }} />
            <p className="text-sm" style={{ color: "var(--d-muted)" }}>Square logo works best. It is shrunk for fast loading.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Name"><input className="d-input" maxLength={80} value={r.name} onChange={(e) => set("name", e.target.value)} /></F>
            <F label="Tagline"><input className="d-input" maxLength={120} value={r.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder="Great Coffee . Great Food . Great Vibe" /></F>
          </div>
        </Sec>)}

        {mini ? (step === 2 && <MiniLinks socials={r.socials} setSocials={(v) => set("socials", v)} buttons={r.buttons} setButtons={(v) => set("buttons", v)} hasOutlets={r.outlets.length > 0} hasOffers={r.offers.length > 0} canOffers={premium} maxExtra={premium ? 6 : 1} />) : (<Sec title="Icons under the name" sub="Instagram, Zomato, Swiggy and the rest. Empty ones are hidden.">
          <div className="grid gap-4 sm:grid-cols-2">{SOCIAL_FIELDS.map(([k, label, ph]) => (
            <F key={k} label={label}>
              {k === "phone" || k === "whatsapp"
                ? <PhoneField label={label} value={r.socials[k] ?? ""} onChange={(v) => set("socials", { ...r.socials, [k]: v })} />
                : <input className="d-input" inputMode="url" maxLength={300} value={r.socials[k] ?? ""} onChange={(e) => set("socials", { ...r.socials, [k]: e.target.value })} placeholder={ph} />}
            </F>
          ))}</div>
        </Sec>)}

        {!mini && (<Sec title="Search keywords" sub="Phrases people type into Google to find this place, for example: cafe in C-Scheme Jaipur. They go into the page's search description. Up to 8, separated by commas. Use real phrases that describe the place, and do not repeat them.">
          <input className="d-input" maxLength={600} value={seoText} onChange={(e) => setSeoText(e.target.value)} placeholder="cafe in C-Scheme Jaipur, fresh fruits delivery Jaipur" aria-label="Search keywords" />
        </Sec>)}

        {(!mini || (step === 3 && premium)) && (<Sec title="Scrolling tags" sub="Short words that keep scrolling, like offers.">
          <F label="Tags" hint="comma separated"><textarea className="d-input" rows={2} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Specialty Coffee, Pet Friendly, All-Day Dining" /></F>
        </Sec>)}

        {(!mini || step === 3) && (<Sec title={mini ? "Photos" : "Photos and videos"} sub={mini ? (premium ? "Up to 10 photos and 2 videos (up to 20 MB each). One at a time with dots; they slide on their own. Press and hold the dots on a photo and drag to move it." : "Up to 3 photos. One at a time with dots; they slide on their own. Premium adds videos and up to 10 photos.") : "One at a time with dots. It slides on its own. Press and hold the dots on a photo and drag to move it. Videos play muted and loop. Images are shrunk automatically; videos can be up to 20 MB (MP4, WebM or MOV)."}>
          <F label="Which way it moves"><select className="d-input !w-auto" value={r.photo_direction} onChange={(e) => set("photo_direction", e.target.value as Row["photo_direction"])}><option value="forward">Forward (the next one comes from the right)</option><option value="backward">Backward (the next one comes from the left)</option></select></F>
          <input ref={photoIn} type="file" accept={mini && !premium ? "image/*" : "image/*,video/mp4,video/webm,video/quicktime"} multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (!fs.length) return; void guard("photos", async () => { const items: LinkPhoto[] = []; for (const f of fs.slice(0, maxPhotos - r.photos.length)) { if (f.type.startsWith("video/")) { if (mini && r.photos.filter(isVideo).length + items.filter(isVideo).length >= 2) { toast("A Premium page can have 2 videos.", true); continue; } if (f.size > MAX_VIDEO_BYTES) { toast(`${f.name} is over 20 MB. Use a shorter clip.`, true); continue; } items.push({ url: await uploadVideo(f), kind: "video" }); } else items.push({ url: await upload(f, 1200) }); } setR((s) => ({ ...s, photos: [...s.photos, ...items] })); }); }} />
          <SortableList className="grid grid-cols-3 gap-2 sm:grid-cols-5" items={r.photos} keyOf={(p, i) => p.url + i} onChange={(n) => set("photos", n)} render={(p, i, grip) => (
            <div className="space-y-1">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl" style={{ background: "var(--d-bg)" }}>
                {isVideo(p)
                  ? <><video src={p.url} muted playsInline preload="metadata" aria-label={`Clip ${i + 1}`} className="h-full w-full object-cover" /><span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">VIDEO</span></>
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={p.url} alt={p.caption ?? `Photo ${i + 1}`} className="h-full w-full object-cover" />}
                <Grip label={`Drag item ${i + 1} to move it`} className="absolute top-1 left-1 !bg-black/55 !text-white" {...grip} style={{ ...grip.style, color: "#fff" }} />
              </div>
              <div className="flex justify-between">
                <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => set("photos", move(r.photos, i, -1))} style={{ color: "var(--d-muted)" }}><ArrowUp size={15} /></button>
                <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Remove photo ${i + 1}`} onClick={() => set("photos", r.photos.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={15} /></button>
                <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Move photo ${i + 1} later`} disabled={i === r.photos.length - 1} onClick={() => set("photos", move(r.photos, i, 1))} style={{ color: "var(--d-muted)" }}><ArrowDown size={15} /></button>
              </div>
            </div>
          )} />
          <button type="button" className="d-btn d-btn-s" disabled={up === "photos" || r.photos.length >= maxPhotos} onClick={() => photoIn.current?.click()}>{up === "photos" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} {mini && !premium ? "Add photos" : "Add photos or videos"} ({r.photos.length} of {maxPhotos})</button>
        </Sec>)}

        {!mini && (<Sec title="Link buttons" sub="Each one opens a link. The Outlets and Offers shortcuts open a list on the page instead.">
          <div className="space-y-3">
            {r.buttons.map((b, i) => (
              <div key={i} className="d-raise space-y-2 p-3">
                <div className="flex gap-2">
                  <input aria-label={`Button ${i + 1} label`} className="d-input !min-h-10" maxLength={40} value={b.label} onChange={(e) => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder="Food Menu" />
                  <select aria-label={`Button ${i + 1} icon`} className="d-input !min-h-10 !w-36" value={b.icon} onChange={(e) => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, icon: e.target.value } : x)))}>{BUTTON_ICONS.map((ic) => <option key={ic} value={ic}>{ICON_LABEL[ic]}</option>)}</select>
                  <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move button ${i + 1} up`} disabled={i === 0} onClick={() => set("buttons", move(r.buttons, i, -1))} style={{ color: "var(--d-muted)" }}><ArrowUp size={16} /></button>
                  <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move button ${i + 1} down`} disabled={i === r.buttons.length - 1} onClick={() => set("buttons", move(r.buttons, i, 1))} style={{ color: "var(--d-muted)" }}><ArrowDown size={16} /></button>
                  <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Remove button ${i + 1}`} onClick={() => set("buttons", r.buttons.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={16} /></button>
                </div>
                {b.url === "#outlets" || b.url === "#offers" ? (
                  <div className="flex items-center justify-between gap-2 text-sm" style={{ color: "var(--d-muted)" }}><span>{b.url === "#offers" ? `Opens the offers list, outlet by outlet${r.offers.length === 0 ? " (add offers below first)" : ""}.` : `Opens the outlets list${r.outlets.length === 0 ? " (add outlets below first)" : ""}.`}</span><button type="button" className="underline underline-offset-4" onClick={() => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: "" } : x)))}>Use a link instead</button></div>
                ) : (
                  <div className="flex gap-2"><input aria-label={`Button ${i + 1} link`} className="d-input !min-h-10" inputMode="url" maxLength={500} value={b.url} onChange={(e) => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} placeholder="https://, tel: or mailto:" />
                    <button type="button" className="d-btn d-btn-s !min-h-10 shrink-0" onClick={() => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: "#outlets", icon: "outlets" } : x)))}>Outlets</button>
                    <button type="button" className="d-btn d-btn-s !min-h-10 shrink-0" onClick={() => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: "#offers", icon: "gift" } : x)))}>Offers</button></div>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={r.buttons.length >= 12} onClick={() => set("buttons", [...r.buttons, { label: "", url: "", icon: "link" }])}><Plus size={15} /> Add button</button>
        </Sec>)}

        {(!mini || step === 3) && (<Sec title="Outlets" sub="One card per store, with a photo, address and buttons for directions, WhatsApp, call and Google review.">
          <input ref={outletIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; const i = outletTarget.current; e.target.value = ""; if (f) void guard(`outlet${i}`, async () => { const u = await upload(f, 1200); setR((s) => ({ ...s, outlets: s.outlets.map((o, k) => (k === i ? { ...o, image_url: u } : o)) })); }); }} />
          <datalist id="outlet-tags">{[...new Set(r.outlets.map((o) => (o.city ?? "").trim()).filter(Boolean))].map((t) => <option key={t} value={t} />)}</datalist>
          <p className="text-xs" style={{ color: "var(--d-muted)" }}>The <b>filter tag</b> is the short name guests see in the dropdown at the top of the outlets list (All, Jaipur, Delhi...). Give outlets of the same area the same tag. Leave it empty on every outlet to hide the dropdown. Keep it short: a city or area, not the full address.</p>
          <div className="space-y-4">
            {r.outlets.map((o, i) => {
              const upd = (p: Partial<LinkOutlet>) => set("outlets", r.outlets.map((x, k) => (k === i ? { ...x, ...p } : x)));
              return (
                <div key={i} className="d-raise space-y-3 p-3">
                  <div className="flex gap-3">
                    <button type="button" aria-label={`Change photo of outlet ${i + 1}`} onClick={() => { outletTarget.current = i; outletIn.current?.click(); }} className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
                      {up === `outlet${i}` ? <Loader2 className="animate-spin" /> : o.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={o.image_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={20} style={{ color: "var(--d-muted)" }} />}
                    </button>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input aria-label={`Outlet ${i + 1} name`} className="d-input !min-h-10" maxLength={80} value={o.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Town Coffee 1.0" />
                      <input aria-label={`Outlet ${i + 1} address`} className="d-input !min-h-10" maxLength={200} value={o.address ?? ""} onChange={(e) => upd({ address: e.target.value })} placeholder="Address" />
                      <input aria-label={`Outlet ${i + 1} filter tag`} list="outlet-tags" className="d-input !min-h-10" maxLength={30} value={o.city ?? ""} onChange={(e) => upd({ city: e.target.value })} placeholder="Filter tag, e.g. Malviya Nagar or Jaipur" />
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Move outlet ${i + 1} up`} disabled={i === 0} onClick={() => set("outlets", move(r.outlets, i, -1))} style={{ color: "var(--d-muted)" }}><ArrowUp size={15} /></button>
                      <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Move outlet ${i + 1} down`} disabled={i === r.outlets.length - 1} onClick={() => set("outlets", move(r.outlets, i, 1))} style={{ color: "var(--d-muted)" }}><ArrowDown size={15} /></button>
                      <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Remove outlet ${i + 1}`} onClick={() => set("outlets", r.outlets.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label={`Outlet ${i + 1} map link`} className="d-input !min-h-10" inputMode="url" maxLength={400} value={o.map_url ?? ""} onChange={(e) => upd({ map_url: e.target.value })} placeholder="Google Maps link" />
                    <input aria-label={`Outlet ${i + 1} review link`} className="d-input !min-h-10" inputMode="url" maxLength={400} value={o.review_url ?? ""} onChange={(e) => upd({ review_url: e.target.value })} placeholder="Google review link" />
                    <input aria-label={`Outlet ${i + 1} Instagram`} className="d-input !min-h-10" inputMode="url" maxLength={300} value={o.instagram ?? ""} onChange={(e) => upd({ instagram: e.target.value })} placeholder="Instagram link of this outlet" />
                    <span className="hidden sm:block" aria-hidden />
                    <PhoneField label={`Outlet ${i + 1} phone`} value={o.phone ?? ""} onChange={(v) => upd({ phone: v })} placeholder="Call number" />
                    <PhoneField label={`Outlet ${i + 1} WhatsApp`} value={o.whatsapp ?? ""} onChange={(v) => upd({ whatsapp: v })} placeholder="WhatsApp number" />
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={r.outlets.length >= 30} onClick={() => set("outlets", [...r.outlets, { name: "" }])}><Plus size={15} /> Add outlet</button>
        </Sec>)}

        {(!mini || (step === 3 && premium)) && (<Sec title="Offers" sub="Pick the outlet, write the offer. Guests press the Offers button and see the offers outlet by outlet, with no photos. Each offer can have its own link.">
          <div className="space-y-3">
            {r.offers.map((o, i) => {
              const upd = (p: Partial<LinkOffer>) => set("offers", r.offers.map((x, k) => (k === i ? { ...x, ...p } : x)));
              const names = r.outlets.map((x) => x.name.trim()).filter(Boolean);
              return (
                <div key={i} className="d-raise space-y-2 p-3">
                  <div className="flex gap-2">
                    <select aria-label={`Offer ${i + 1} outlet`} className="d-input !min-h-10" value={o.outlet} onChange={(e) => upd({ outlet: e.target.value })}>
                      <option value="">Every outlet</option>
                      {names.map((n) => <option key={n} value={n}>{n}</option>)}
                      {o.outlet && !names.includes(o.outlet) && <option value={o.outlet}>{o.outlet} (removed)</option>}
                    </select>
                    <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move offer ${i + 1} up`} disabled={i === 0} onClick={() => set("offers", move(r.offers, i, -1))} style={{ color: "var(--d-muted)" }}><ArrowUp size={16} /></button>
                    <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move offer ${i + 1} down`} disabled={i === r.offers.length - 1} onClick={() => set("offers", move(r.offers, i, 1))} style={{ color: "var(--d-muted)" }}><ArrowDown size={16} /></button>
                    <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Remove offer ${i + 1}`} onClick={() => set("offers", r.offers.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={16} /></button>
                  </div>
                  <input aria-label={`Offer ${i + 1} title`} className="d-input !min-h-10" maxLength={80} value={o.title} onChange={(e) => upd({ title: e.target.value })} placeholder="2% off on the final bill" />
                  <textarea aria-label={`Offer ${i + 1} details`} className="d-input" rows={2} maxLength={300} value={o.details ?? ""} onChange={(e) => upd({ details: e.target.value })} placeholder="Details: timing, conditions" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label={`Offer ${i + 1} valid till`} className="d-input !min-h-10" maxLength={40} value={o.valid_till ?? ""} onChange={(e) => upd({ valid_till: e.target.value })} placeholder="Valid till 30 Nov" />
                    <input aria-label={`Offer ${i + 1} link`} className="d-input !min-h-10" inputMode="url" maxLength={500} value={o.link ?? ""} onChange={(e) => upd({ link: e.target.value })} placeholder="Link for this offer (optional)" />
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={r.offers.length >= 60} onClick={() => set("offers", [...r.offers, { outlet: r.outlets[0]?.name.trim() ?? "", title: "" }])}><Plus size={15} /> Add offer</button>
          {r.offers.length > 0 && !r.buttons.some((b) => b.url === "#offers") && <p className="text-xs" style={{ color: "var(--d-amber)" }}>There is no Offers button yet. Add one in Link buttons and press the Offers shortcut, or guests will not see these.</p>}
        </Sec>)}

        {mini && step === 3 && !premium && (
          <>
            <LockedCard title="Videos" text="Add up to 2 videos to your photo slider." />
            <LockedCard title="Offers" text="Show your offers on the page, with an Offers button." />
            <LockedCard title="Keywords line" text="A scrolling line of words under your name, like Specialty Coffee, Pet Friendly." />
          </>
        )}
        {mini && (
          <div className="flex justify-between gap-2">
            <button type="button" className="d-btn d-btn-s" disabled={step === 1} onClick={() => goStep(step - 1)}>Back</button>
            {step < 3 ? <button type="button" className="d-btn d-btn-p" onClick={() => goStep(step + 1)}>Next</button> : <span className="self-center text-sm" style={{ color: "var(--d-muted)" }}>That is all. Press Save.</span>}
          </div>
        )}
        {admin && (        <Sec title="Reviews" sub="Shown as a moving row of Google review cards.">
          {r.client_id && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={r.show_client_reviews} onChange={(e) => set("show_client_reviews", e.target.checked)} />Also show the reviews pasted for the registered business</label>}
          <div className="space-y-3">
            {r.reviews.map((x, i) => (
              <div key={i} className="d-raise space-y-2 p-3">
                <div className="flex gap-2">
                  <input aria-label={`Review ${i + 1} author`} className="d-input !min-h-10" maxLength={60} value={x.author} onChange={(e) => set("reviews", r.reviews.map((y, k) => (k === i ? { ...y, author: e.target.value } : y)))} placeholder="Reviewer name" />
                  <select aria-label={`Review ${i + 1} stars`} className="d-input !min-h-10 !w-24" value={x.rating} onChange={(e) => set("reviews", r.reviews.map((y, k) => (k === i ? { ...y, rating: Number(e.target.value) } : y)))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select>
                  <input aria-label={`Review ${i + 1} date`} className="d-input !min-h-10 !w-36" maxLength={20} value={x.date ?? ""} onChange={(e) => set("reviews", r.reviews.map((y, k) => (k === i ? { ...y, date: e.target.value } : y)))} placeholder="6 Nov 2026" />
                  <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Remove review ${i + 1}`} onClick={() => set("reviews", r.reviews.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={16} /></button>
                </div>
                <textarea aria-label={`Review ${i + 1} text`} className="d-input" rows={2} maxLength={400} value={x.body} onChange={(e) => set("reviews", r.reviews.map((y, k) => (k === i ? { ...y, body: e.target.value } : y)))} placeholder="What the guest wrote" />
              </div>
            ))}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={r.reviews.length >= 30} onClick={() => set("reviews", [...r.reviews, { author: "", rating: 5, body: "" }])}><Plus size={15} /> Add a review</button>
          <p className="text-xs" style={{ color: "var(--d-muted)" }}>Only add real reviews that guests wrote.</p>
        </Sec>)}

        <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-2xl p-2 backdrop-blur" style={{ background: "color-mix(in srgb, var(--d-bg) 80%, transparent)" }}>
          <button className="d-btn d-btn-p" disabled={busy || !!up} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
          <a className="d-btn d-btn-s" href={`/l/${slugify(initial.slug)}${initial.published ? "" : mode === "token" ? `?preview=${token}` : "?preview=1"}`} target="_blank" rel="noopener">Open page</a>
          <button className="d-btn d-btn-s" onClick={() => void downloadUrlQr(`${LINK_BASE}/${slugify(initial.slug)}`, slugify(initial.slug))}>Download QR</button>
          {admin && <button className="d-btn d-btn-s ml-auto" onClick={remove}>Delete</button>}
        </div>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-4">
          <p className="mb-2 text-xs" style={{ color: "var(--d-muted)" }}>Preview. Updates when you press Save.</p>
          <div className="overflow-hidden rounded-[34px] p-2" style={{ background: "#000", boxShadow: "0 0 0 1px var(--d-line-2)" }}>
            <iframe key={ver} title="Preview of the mini link" src={`/l/${slugify(initial.slug)}?preview=${mode === "token" ? token : "1"}`} className="h-[740px] w-full rounded-[28px] bg-black" />
          </div>
        </div>
      </aside>
    </div>
  );
}
