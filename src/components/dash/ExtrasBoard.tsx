"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UserPlus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { useToast } from "./Toast";

type S = { id: string; name: string; photo_url: string | null; active: boolean; thanks_total: number };
type P = { id: string; image_url: string; caption: string | null; active: boolean };
type T = { id: string; staff_id: string; note: string | null; created_at: string };

// Owner view: the team guests can thank or report, and the posters behind the red New button.
export function ExtrasBoard({ clientId, staff: s0, posters: p0, thanks }: { clientId: string; staff: S[]; posters: P[]; thanks: T[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [staff, setStaff] = useState(s0);
  const [posters, setPosters] = useState(p0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const photo = useRef<HTMLInputElement>(null);
  const poster = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);

  async function upload(file: File, folder: string, max: number) {
    const blob = await toWebp(file, max);
    const path = `${clientId}/${folder}/${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from("page-assets").upload(path, blob, { contentType: "image/webp" });
    if (error) throw error;
    return sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
  }

  async function addStaff() {
    const n = name.trim();
    if (!n) return toast("Type the staff member's name first.", true);
    if (staff.length >= 30) return toast("You can add up to 30 staff members.", true);
    setBusy("staff");
    const { data, error } = await sb.from("staff").insert({ client_id: clientId, name: n, sort: staff.length }).select("id, name, photo_url, active, thanks_total").single();
    setBusy(null);
    if (error || !data) return toast("That did not save. Please try again.", true);
    setStaff((x) => [...x, data as S]); setName("");
  }
  async function setPhoto(id: string, file: File) {
    setBusy(id);
    try {
      const url = await upload(file, "staff", 400);
      const { error } = await sb.from("staff").update({ photo_url: url }).eq("id", id);
      if (error) throw error;
      setStaff((x) => x.map((m) => (m.id === id ? { ...m, photo_url: url } : m)));
    } catch { toast("The photo did not upload. Please try a smaller one.", true); }
    setBusy(null);
  }
  async function toggleStaff(m: S) {
    const { error } = await sb.from("staff").update({ active: !m.active }).eq("id", m.id);
    if (error) return toast("That did not save.", true);
    setStaff((x) => x.map((y) => (y.id === m.id ? { ...y, active: !m.active } : y)));
  }
  async function removeStaff(m: S) {
    if (!confirm(`Remove ${m.name}? Their thank-you count goes with them.`)) return;
    const { error } = await sb.from("staff").delete().eq("id", m.id);
    if (error) return toast("That did not delete.", true);
    setStaff((x) => x.filter((y) => y.id !== m.id));
  }
  async function addPoster(file: File) {
    if (posters.length >= 8) return toast("Up to 8 posters at a time. Remove one first.", true);
    setBusy("poster");
    try {
      const url = await upload(file, "posters", 1400);
      const { data, error } = await sb.from("posters").insert({ client_id: clientId, image_url: url, sort: posters.length }).select("id, image_url, caption, active").single();
      if (error || !data) throw error;
      setPosters((x) => [...x, data as P]);
    } catch { toast("The poster did not upload. Please try again.", true); }
    setBusy(null);
  }
  async function togglePoster(p: P) {
    const { error } = await sb.from("posters").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast("That did not save.", true);
    setPosters((x) => x.map((y) => (y.id === p.id ? { ...y, active: !p.active } : y)));
  }
  async function removePoster(p: P) {
    if (!confirm("Remove this poster?")) return;
    const { error } = await sb.from("posters").delete().eq("id", p.id);
    if (error) return toast("That did not delete.", true);
    setPosters((x) => x.filter((y) => y.id !== p.id));
  }
  const byId = Object.fromEntries(staff.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-6">
      <section className="d-card space-y-4 p-5" aria-labelledby="staff-h">
        <h2 id="staff-h" className="font-semibold">Staff</h2>
        <input ref={photo} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && photoFor) void setPhoto(photoFor, f); }} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addStaff(); }}>
          <input className="d-input min-w-0 flex-1" aria-label="Staff name" placeholder="Staff member's name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="d-btn d-btn-p" disabled={busy === "staff"}>{busy === "staff" ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Add</button>
        </form>
        {staff.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>No staff yet. Add names so guests can thank them or report a problem. The guest card appears once you add one.</p> : (
          <ul className="space-y-3">
            {staff.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", opacity: m.active ? 1 : 0.55 }}>
                <button type="button" aria-label={`Change photo of ${m.name}`} onClick={() => { setPhotoFor(m.id); photo.current?.click(); }} className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--d-bg)" }}>
                  {busy === m.id ? <Loader2 className="animate-spin" size={18} /> : m.photo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.photo_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={18} style={{ color: "var(--d-muted)" }} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-xs" style={{ color: "var(--d-muted)" }}>{m.thanks_total} thank-yous so far</p>
                </div>
                <button type="button" className="d-btn d-btn-s !px-3" onClick={() => toggleStaff(m)}>{m.active ? "Hide" : "Show"}</button>
                <button type="button" className="d-btn d-btn-s !px-3" aria-label={`Remove ${m.name}`} onClick={() => removeStaff(m)}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Thank-yous are kind words only. A report reaches your Inbox as a complaint with the person&apos;s name on it.</p>
      </section>

      {thanks.length > 0 && (
        <section className="d-card space-y-3 p-5" aria-labelledby="thanks-h">
          <h2 id="thanks-h" className="font-semibold">Recent thank-you notes</h2>
          <ul className="space-y-2 text-sm">
            {thanks.map((t) => (
              <li key={t.id}><span className="font-medium">{byId[t.staff_id] ?? "Staff"}</span>: {t.note} <span className="text-xs" style={{ color: "var(--d-muted)" }}>· {new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></li>
            ))}
          </ul>
          <p className="text-xs" style={{ color: "var(--d-muted)" }}>Notes are removed after 45 days. The thank-you count stays.</p>
        </section>
      )}

      <section className="d-card space-y-4 p-5" aria-labelledby="posters-h">
        <h2 id="posters-h" className="font-semibold">New posters</h2>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>Guests see a red New button on your page. Tapping it shows these posters one by one: a new launch, a festival offer, an event. Up to 8.</p>
        <input ref={poster} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPoster(f); }} />
        <button type="button" className="d-btn d-btn-s" disabled={busy === "poster"} onClick={() => poster.current?.click()}>{busy === "poster" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add a poster</button>
        {posters.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {posters.map((p) => (
              <li key={p.id} className="space-y-2" style={{ opacity: p.active ? 1 : 0.5 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
                <div className="flex gap-2">
                  <button type="button" className="d-btn d-btn-s !min-h-10 flex-1 !px-2" onClick={() => togglePoster(p)}>{p.active ? "Hide" : "Show"}</button>
                  <button type="button" className="d-btn d-btn-s !min-h-10 !px-3" aria-label="Remove poster" onClick={() => removePoster(p)}><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
