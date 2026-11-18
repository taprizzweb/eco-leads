"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { useToast } from "@/components/dash/Toast";
import { slugify } from "@/lib/features";
import { BUTTON_ICONS, ICON_LABEL, LINK_THEMES, type LinkButton, type LinkOutlet, type LinkPhoto, type LinkReview, type LinkSocials, type LinkTheme } from "@/lib/linkpage";

type Row = {
  id: string; slug: string; client_id: string | null; name: string; tagline: string | null; logo_url: string | null; theme: string; tags: string[];
  socials: LinkSocials; photos: LinkPhoto[]; buttons: LinkButton[]; outlets: LinkOutlet[]; reviews: LinkReview[];
  show_client_reviews: boolean; published: boolean; fee_inr: number; billing_note: string | null;
};

// Module level on purpose: defined inside the editor it would remount on every keystroke and the field would lose focus.
function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>{label}</span>{hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{hint}</span>}<span className="mt-1.5 block">{children}</span></label>
  );
}
function Sec({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="d-card space-y-4 p-5"><div><h2 className="font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-sm" style={{ color: "var(--d-muted)" }}>{sub}</p>}</div>{children}</section>;
}
const move = <T,>(a: T[], i: number, d: -1 | 1): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };
const SOCIAL_FIELDS: [keyof LinkSocials, string, string][] = [
  ["instagram", "Instagram", "https://instagram.com/yourcafe"], ["facebook", "Facebook", "https://facebook.com/yourcafe"], ["zomato", "Zomato", "https://zomato.com/..."],
  ["swiggy", "Swiggy", "https://swiggy.com/..."], ["whatsapp", "WhatsApp number", "98765 43210"], ["maps", "Google Maps", "https://maps.google.com/..."],
  ["phone", "Phone number", "+91 98765 43210"], ["website", "Website", "https://"],
];

export function LinkEditor({ initial, clientName }: { initial: Row; clientName: string | null }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [r, setR] = useState<Row>(initial);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<string | null>(null);
  const [ver, setVer] = useState(0);
  const logoIn = useRef<HTMLInputElement>(null);
  const photoIn = useRef<HTMLInputElement>(null);
  const outletTarget = useRef<number>(0);
  const outletIn = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Row>(k: K, v: Row[K]) => setR((s) => ({ ...s, [k]: v }));

  async function upload(file: File, max: number): Promise<string> {
    const blob = await toWebp(file, max);
    const path = `links/${r.id}/${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from("page-assets").upload(path, blob, { contentType: "image/webp" });
    if (error) throw error;
    return sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    const slug = slugify(r.slug);
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return toast("The page link needs 3 to 40 letters, numbers or dashes.", true);
    if (!r.name.trim()) return toast("Add the business name.", true);
    const tags = tagText.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const socials = Object.fromEntries(Object.entries(r.socials).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, String(v).trim()]));
    setBusy(true);
    const { error } = await sb.from("link_pages").update({
      slug, name: r.name.trim(), tagline: r.tagline?.trim() || null, logo_url: r.logo_url, theme: r.theme, tags, socials,
      photos: r.photos.slice(0, 30), buttons: r.buttons.filter((b) => b.label.trim()).slice(0, 12), outlets: r.outlets.filter((o) => o.name.trim()).slice(0, 30),
      reviews: r.reviews.filter((x) => x.author.trim() && x.body.trim()).slice(0, 30), show_client_reviews: r.show_client_reviews, published: r.published,
      fee_inr: Math.max(0, Math.floor(Number(r.fee_inr) || 0)), billing_note: r.billing_note?.trim() || null, updated_at: new Date().toISOString(),
    }).eq("id", r.id);
    setBusy(false);
    if (error) return toast(/duplicate|unique/i.test(error.message) ? "That page link is already taken." : "That did not save. Please try again.", true);
    setR((s) => ({ ...s, slug, tags }));
    setVer((v) => v + 1);
    toast("Saved");
    router.refresh();
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
        <Sec title="Page" sub={clientName ? `Linked to the registered business ${clientName}.` : "A link-only business. It is not registered in Taprizz."}>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Page link" hint={`/l/${slugify(r.slug) || "name"}`}><input className="d-input" maxLength={40} value={r.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></F>
            <F label="Status"><select className="d-input" value={r.published ? "live" : "draft"} onChange={(e) => set("published", e.target.value === "live")}><option value="live">Live</option><option value="draft">Draft (hidden)</option></select></F>
            <F label="Fee for this page" hint="Rs, 0 means free"><input className="d-input" type="number" min={0} value={r.fee_inr} onChange={(e) => set("fee_inr", Number(e.target.value))} /></F>
            <F label="Billing note"><input className="d-input" maxLength={200} value={r.billing_note ?? ""} onChange={(e) => set("billing_note", e.target.value)} placeholder="Paid till March, free as a service..." /></F>
          </div>
        </Sec>

        <Sec title="Template" sub="The colours of the page.">
          <div className="flex flex-wrap gap-2">{(Object.keys(LINK_THEMES) as LinkTheme[]).map((t) => (
            <button key={t} type="button" aria-pressed={r.theme === t} onClick={() => set("theme", t)} className="flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px]" style={{ background: "var(--d-bg)", color: "var(--d-text)", boxShadow: r.theme === t ? "inset 0 0 0 2px var(--d-text)" : "inset 0 0 0 1px var(--d-line-2)" }}>
              <span className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${LINK_THEMES[t].vars["--l-accent"]}, ${LINK_THEMES[t].vars["--l-bg"]})`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)" }} />{LINK_THEMES[t].label}
            </button>))}</div>
        </Sec>

        <Sec title="Profile">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => logoIn.current?.click()} aria-label="Change logo" className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
              {up === "logo" ? <Loader2 className="animate-spin" /> : r.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.logo_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} style={{ color: "var(--d-muted)" }} />}
            </button>
            <input ref={logoIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void guard("logo", async () => set("logo_url", await upload(f, 500))); }} />
            <p className="text-sm" style={{ color: "var(--d-muted)" }}>Square logo works best. It is shrunk for fast loading.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Name"><input className="d-input" maxLength={80} value={r.name} onChange={(e) => set("name", e.target.value)} /></F>
            <F label="Tagline"><input className="d-input" maxLength={120} value={r.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder="Great Coffee . Great Food . Great Vibe" /></F>
          </div>
        </Sec>

        <Sec title="Icons under the name" sub="Instagram, Zomato, Swiggy and the rest. Empty ones are hidden.">
          <div className="grid gap-4 sm:grid-cols-2">{SOCIAL_FIELDS.map(([k, label, ph]) => (
            <F key={k} label={label}><input className="d-input" inputMode={k === "phone" || k === "whatsapp" ? "tel" : "url"} maxLength={300} value={r.socials[k] ?? ""} onChange={(e) => set("socials", { ...r.socials, [k]: e.target.value })} placeholder={ph} /></F>
          ))}</div>
        </Sec>

        <Sec title="Scrolling tags" sub="Short words that keep scrolling, like offers.">
          <F label="Tags" hint="comma separated"><textarea className="d-input" rows={2} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Specialty Coffee, Pet Friendly, All-Day Dining" /></F>
        </Sec>

        <Sec title="Photos" sub="They keep moving on the page, in the opposite direction to the tags. Three or more look best.">
          <input ref={photoIn} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) void guard("photos", async () => { const urls: LinkPhoto[] = []; for (const f of fs.slice(0, 30 - r.photos.length)) urls.push({ url: await upload(f, 1200) }); setR((s) => ({ ...s, photos: [...s.photos, ...urls] })); }); }} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {r.photos.map((p, i) => (
              <div key={p.url + i} className="space-y-1">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl" style={{ background: "var(--d-bg)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? `Photo ${i + 1}`} className="h-full w-full object-cover" />
                </div>
                <div className="flex justify-between">
                  <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => set("photos", move(r.photos, i, -1))} style={{ color: "var(--d-muted)" }}><ArrowUp size={15} /></button>
                  <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Remove photo ${i + 1}`} onClick={() => set("photos", r.photos.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={15} /></button>
                  <button type="button" className="grid h-9 w-9 place-items-center" aria-label={`Move photo ${i + 1} later`} disabled={i === r.photos.length - 1} onClick={() => set("photos", move(r.photos, i, 1))} style={{ color: "var(--d-muted)" }}><ArrowDown size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={up === "photos" || r.photos.length >= 30} onClick={() => photoIn.current?.click()}>{up === "photos" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add photos ({r.photos.length} of 30)</button>
        </Sec>

        <Sec title="Link buttons" sub='Each one opens a link. Choose "Opens the outlets list" for the Our Outlets button.'>
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
                {b.url === "#outlets" ? (
                  <div className="flex items-center justify-between gap-2 text-sm" style={{ color: "var(--d-muted)" }}><span>Opens the outlets list{r.outlets.length === 0 ? " (add outlets below first)" : ""}.</span><button type="button" className="underline underline-offset-4" onClick={() => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: "" } : x)))}>Use a link instead</button></div>
                ) : (
                  <div className="flex gap-2"><input aria-label={`Button ${i + 1} link`} className="d-input !min-h-10" inputMode="url" maxLength={500} value={b.url} onChange={(e) => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} placeholder="https://, tel: or mailto:" />
                    <button type="button" className="d-btn d-btn-s !min-h-10 shrink-0" onClick={() => set("buttons", r.buttons.map((x, k) => (k === i ? { ...x, url: "#outlets", icon: "outlets" } : x)))}>Outlets</button></div>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={r.buttons.length >= 12} onClick={() => set("buttons", [...r.buttons, { label: "", url: "", icon: "link" }])}><Plus size={15} /> Add button</button>
        </Sec>

        <Sec title="Outlets" sub="One card per store, with a photo, address and buttons for directions, WhatsApp, call and Google review.">
          <input ref={outletIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; const i = outletTarget.current; e.target.value = ""; if (f) void guard(`outlet${i}`, async () => { const u = await upload(f, 1200); setR((s) => ({ ...s, outlets: s.outlets.map((o, k) => (k === i ? { ...o, image_url: u } : o)) })); }); }} />
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
                    <input aria-label={`Outlet ${i + 1} phone`} className="d-input !min-h-10" inputMode="tel" maxLength={20} value={o.phone ?? ""} onChange={(e) => upd({ phone: e.target.value })} placeholder="Call number" />
                    <input aria-label={`Outlet ${i + 1} WhatsApp`} className="d-input !min-h-10" inputMode="tel" maxLength={20} value={o.whatsapp ?? ""} onChange={(e) => upd({ whatsapp: e.target.value })} placeholder="WhatsApp number" />
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className="d-btn d-btn-s" disabled={r.outlets.length >= 30} onClick={() => set("outlets", [...r.outlets, { name: "" }])}><Plus size={15} /> Add outlet</button>
        </Sec>

        <Sec title="Reviews" sub="Shown as a moving row of Google review cards.">
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
        </Sec>

        <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-2xl p-2 backdrop-blur" style={{ background: "color-mix(in srgb, var(--d-bg) 80%, transparent)" }}>
          <button className="d-btn d-btn-p" disabled={busy || !!up} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
          <a className="d-btn d-btn-s" href={`/l/${slugify(initial.slug)}${initial.published ? "" : "?preview=1"}`} target="_blank" rel="noopener">Open page</a>
          <button className="d-btn d-btn-s ml-auto" onClick={remove}>Delete</button>
        </div>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-4">
          <p className="mb-2 text-xs" style={{ color: "var(--d-muted)" }}>Preview. Updates when you press Save.</p>
          <div className="overflow-hidden rounded-[34px] p-2" style={{ background: "#000", boxShadow: "0 0 0 1px var(--d-line-2)" }}>
            <iframe key={ver} title="Preview of the mini link" src={`/l/${slugify(initial.slug)}?preview=1`} className="h-[740px] w-full rounded-[28px] bg-black" />
          </div>
        </div>
      </aside>
    </div>
  );
}
