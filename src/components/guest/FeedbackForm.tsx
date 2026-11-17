"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Square, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

// Glass styling from the HextaUI sign-in card, tinted from the guest page theme so it reads on light and dark themes.
const glassInput =
  "w-full rounded-xl px-5 py-3 text-[15px] text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--text)_35%,transparent)] bg-[color-mix(in_srgb,var(--text)_8%,transparent)]";
const glassCard =
  "rounded-3xl p-5 shadow-xl backdrop-blur-sm bg-gradient-to-r from-[color-mix(in_srgb,var(--text)_7%,transparent)] to-transparent";
const pillPrimary =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-fg px-5 py-3 font-semibold text-bg shadow transition hover:opacity-90 disabled:opacity-60";
const pillSoft =
  "min-h-12 w-full rounded-full px-5 py-3 font-semibold shadow transition bg-[color-mix(in_srgb,var(--text)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--text)_16%,transparent)]";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3;

type Attachment = { file: Blob; name: string; kind: "image" | "video" | "audio"; preview?: string };

export function FeedbackForm({
  kind,
  clientId,
  code,
  onDone,
}: {
  kind: "complaint" | "suggestion";
  clientId: string;
  code: string | null;
  onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: Attachment[] = [];
    for (const f of Array.from(list)) {
      if (files.length + next.length >= MAX_FILES) { setError(`You can add up to ${MAX_FILES} files.`); break; }
      if (f.size > MAX_BYTES) { setError(`${f.name} is over 10 MB. Try a shorter clip or a photo.`); continue; }
      const k = f.type.startsWith("video") ? "video" : "image";
      next.push({ file: f, name: f.name, kind: k, preview: k === "image" ? URL.createObjectURL(f) : undefined });
    }
    setFiles((s) => [...s, ...next]);
  }

  async function startRecording() {
    setError(null);
    if (files.length >= MAX_FILES) { setError(`You can add up to ${MAX_FILES} files.`); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const r = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime });
        setFiles((s) => [...s, { file: blob, name: `voice-note.${mime === "audio/webm" ? "webm" : "m4a"}`, kind: "audio", preview: URL.createObjectURL(blob) }]);
      };
      r.start();
      rec.current = r;
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= 120) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone access was blocked. You can allow it in your browser settings, or type instead.");
    }
  }

  function stopRecording() {
    if (rec.current?.state === "recording") rec.current.stop();
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
  }

  async function submit() {
    if (!body.trim()) { setError("Tell us in a few words what happened."); return; }
    setSending(true);
    setError(null);
    const sb = supabaseBrowser();
    try {
      const paths: string[] = [];
      for (const a of files) {
        const ext = a.name.split(".").pop() || "bin";
        const path = `${clientId}/${kind}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from("guest-uploads").upload(path, a.file, { contentType: a.file.type });
        if (upErr) throw new Error("upload");
        paths.push(path);
      }
      const { error: rpcErr } = await sb.rpc("guest_submit_feedback", {
        p_client: clientId,
        p_code: code,
        p_kind: kind,
        p_body: body.trim(),
        p_media: paths,
        p_name: name.trim() || null,
        p_phone: phone.trim() || null,
        p_consent: consent,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      setSent(true);
    } catch {
      setError("Your message did not send. Check your connection and try again. Nothing you typed was lost.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 size={48} className="mx-auto text-green-400" />
        <p className="text-lg font-semibold">Thank you. The management has your message.</p>
        <p className="text-sm text-muted">
          {kind === "complaint" ? "Only the management can read this. If you left your number, they may reach out." : "Good ideas make the next visit better."}
        </p>
        <button onClick={onDone} className={pillSoft}>Back to the page</button>
      </div>
    );
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="fb-body" className="mb-2 block text-sm text-muted">
          {kind === "complaint" ? "What went wrong?" : "What could we do better?"}
        </label>
        <textarea
          id="fb-body"
          value={body}
          onChange={(e) => { setBody(e.target.value); if (error) setError(null); }}
          rows={4}
          maxLength={2000}
          className={`${glassInput} min-h-28 rounded-2xl`}
        />
      </div>

      <div className="flex items-center gap-3">
        <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={() => fileInput.current?.click()} aria-label="Add photo or video" className="grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
          <ImagePlus size={22} />
        </button>
        {recording ? (
          <button type="button" onClick={stopRecording} className="flex h-12 items-center gap-2 rounded-full bg-red-500 px-4 font-medium text-white">
            <Square size={16} className="fill-white" />
            <span className="tabular-nums">{mmss}</span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </button>
        ) : (
          <button type="button" onClick={startRecording} aria-label="Record a voice note" className="grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
            <Mic size={22} />
          </button>
        )}
        <span className="text-xs text-muted">Photo, video or voice note (optional)</span>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((a, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
              {a.kind === "image" && a.preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              {a.kind === "audio" && a.preview && <audio src={a.preview} controls className="h-10 flex-1" />}
              {a.kind !== "audio" && <span className="flex-1 truncate text-sm">{a.name}</span>}
              <button type="button" onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} aria-label={`Remove ${a.name}`} className="grid h-11 w-11 place-items-center text-muted">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {kind === "complaint" && (
        <div className={`${glassCard} space-y-3`}>
          <p className="text-sm font-medium">Want the management to get back to you?</p>
          <p className="-mt-2 text-xs text-muted">Optional. Only the management sees this.</p>
          <div>
            <label htmlFor="fb-name" className="mb-1.5 block text-sm text-muted">Name</label>
            <input id="fb-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={glassInput} />
          </div>
          <div>
            <label htmlFor="fb-phone" className="mb-1.5 block text-sm text-muted">Phone</label>
            <input id="fb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" maxLength={20} className={glassInput} />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
            The management may contact me about this.
          </label>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-amber-400">{error}</p>}

      <button
        onClick={submit}
        disabled={sending || recording}
        className={pillPrimary}
      >
        {sending && <Loader2 size={18} className="animate-spin" />}
        {sending ? "Sending" : kind === "complaint" ? "Send to management" : "Send suggestion"}
      </button>
    </div>
  );
}
