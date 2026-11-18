"use client";

import { useRef, useState } from "react";
import { AtSign, CheckCircle2, Copy, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { glassCard, glassInput, pillPrimary, pillSoft } from "./ui";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3;
type Att = { file: File; preview?: string };

/** "https://instagram.com/brewbloom/?hl=en" -> "brewbloom". Returns null when it is not an Instagram profile link. */
export function instagramHandle(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const h = u.pathname.split("/").filter(Boolean)[0];
    return h && /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
  } catch { return null; }
}

// Creators corner: tag the place on Instagram, follow it, and send your own photos and clips with a caption.
// What guests send goes to the owner's dashboard (and to the Taprizz team), who can post it or ask for changes.
export function CreatorsSheet({ clientId, businessName, instagramUrl, onDone }: { clientId: string; businessName: string; instagramUrl?: string | null; onDone: () => void }) {
  const handle = instagramHandle(instagramUrl);
  const file = useRef<HTMLInputElement>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [caption, setCaption] = useState("");
  const [mine, setMine] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyHandle() {
    try { await navigator.clipboard.writeText(`@${handle}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the handle is shown on screen */ }
  }

  function add(list: FileList | null) {
    if (!list) return;
    setErr("");
    const next: Att[] = [];
    for (const f of Array.from(list)) {
      if (atts.length + next.length >= MAX_FILES) { setErr(`You can add up to ${MAX_FILES} files.`); break; }
      if (!/^(image|video)\//.test(f.type)) { setErr(`${f.name} is not a photo or video.`); continue; }
      if (f.size > MAX_BYTES) { setErr(`${f.name} is over 10 MB. Try a shorter clip or a photo.`); continue; }
      next.push({ file: f, preview: f.type.startsWith("image") ? URL.createObjectURL(f) : undefined });
    }
    setAtts((s) => [...s, ...next]);
  }

  async function submit() {
    if (atts.length === 0) return setErr("Add at least one photo or video.");
    if (!consent) return setErr("Please tick the box so the business can use these.");
    const h = mine.trim().replace(/^@/, "");
    if (h && !/^[A-Za-z0-9._]{1,30}$/.test(h)) return setErr("Your Instagram username can have letters, numbers, dots and underscores.");
    setBusy(true);
    setErr("");
    const sb = supabaseBrowser();
    try {
      const paths: string[] = [];
      for (const a of atts) {
        const ext = a.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const path = `${clientId}/moments/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("guest-uploads").upload(path, a.file, { contentType: a.file.type });
        if (error) throw new Error("upload");
        paths.push(path);
      }
      const { error } = await sb.rpc("guest_submit_moment", { p_client: clientId, p_handle: h, p_caption: caption, p_media: paths, p_consent: consent });
      if (error) throw new Error(error.message);
      setSent(true);
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === "upload" ? "A file did not upload. Try a shorter clip, or check your connection." : m || "That did not send. Nothing you added was lost.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) return (
    <div className="space-y-4 py-4 text-center">
      <CheckCircle2 size={48} className="mx-auto text-green-400" />
      <p className="text-lg font-semibold">Sent to {businessName}</p>
      <p className="text-sm text-muted">They will look at it and may post it, tagging you.</p>
      <button className={pillSoft} onClick={onDone}>Back to the page</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {handle && (
        <section className={`${glassCard} space-y-3`}>
          <h3 className="text-[17px] font-semibold">Share your visit on Instagram</h3>
          <p className="text-[15px] leading-relaxed text-muted">Post a glimpse of your visit to {businessName} on your story and tag <span className="font-semibold text-fg">@{handle}</span>.</p>
          <div className="flex gap-2">
            <a href={`https://www.instagram.com/${handle}/`} target="_blank" rel="noopener" className={`${pillPrimary} flex-1`}><AtSign size={18} />Follow @{handle}</a>
            <button type="button" onClick={copyHandle} className={`${pillSoft} !w-auto px-5`} aria-label={`Copy @${handle}`}><Copy size={16} />{copied ? "Copied" : "Copy"}</button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-[17px] font-semibold">Add your photos and videos</h3>
        <p className="-mt-1 text-sm text-muted">Send us your best shots with a caption. If they are great, {businessName} may post them and tag you.</p>
        <input ref={file} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <button type="button" className={pillSoft} onClick={() => file.current?.click()} disabled={atts.length >= MAX_FILES}><ImagePlus size={18} />Add from gallery ({atts.length} of {MAX_FILES})</button>
        {atts.length > 0 && (
          <ul className="space-y-2">
            {atts.map((a, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
                {a.preview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  : <span className="grid h-12 w-12 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--text)_10%,transparent)] text-xs">Video</span>}
                <span className="flex-1 truncate text-sm">{a.file.name}</span>
                <button type="button" aria-label={`Remove ${a.file.name}`} className="grid h-11 w-11 place-items-center text-muted" onClick={() => setAtts((s) => s.filter((_, k) => k !== i))}><Trash2 size={18} /></button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <label htmlFor="m-cap" className="mb-1.5 block text-sm text-muted">Caption <span className="text-xs opacity-80">optional</span></label>
          <textarea id="m-cap" className={`${glassInput} min-h-24 rounded-2xl`} rows={3} maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="How you would like it to be posted" />
        </div>
        <div>
          <label htmlFor="m-ig" className="mb-1.5 block text-sm text-muted">Your Instagram username <span className="text-xs opacity-80">so they can tag you</span></label>
          <input id="m-ig" className={glassInput} value={mine} onChange={(e) => { setMine(e.target.value); setErr(""); }} placeholder="@yourname" autoCapitalize="none" autoComplete="off" maxLength={31} />
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{businessName} may post these and tag me.</label>
        {err && <p role="alert" className="text-sm text-amber-400">{err}</p>}
        <button className={pillPrimary} onClick={submit} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />}{busy ? "Sending" : "Send to " + businessName}</button>
      </section>
    </div>
  );
}
