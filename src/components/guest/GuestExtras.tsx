"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check, Copy, Loader2, ThumbsUp, TriangleAlert } from "lucide-react";
import { qrDataUrl } from "@/lib/qr-logo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FeedbackForm } from "./FeedbackForm";
import type { Visitor } from "@/lib/visitor";

/** Text that goes inside a Wi-Fi QR code. Phones read it and offer to join. */
const wifiText = (name: string, pass: string) => {
  const esc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${pass ? "WPA" : "nopass"};S:${esc(name)};${pass ? `P:${esc(pass)};` : ""};`;
};

export function WifiSheet({ name, password }: { name: string; password: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"name" | "pass" | null>(null);
  useEffect(() => {
    let live = true;
    qrDataUrl(wifiText(name, password), { margin: 1, width: 440 }).then((u) => { if (live) setQr(u); }).catch(() => {});
    return () => { live = false; };
  }, [name, password]);
  const copy = (what: "name" | "pass") => {
    navigator.clipboard.writeText(what === "name" ? name : password).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1800); }).catch(() => {});
  };
  return (
    <div className="space-y-4">
      <div className="mx-auto w-fit rounded-2xl bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="Wi-Fi QR code. Scan it to join." width={220} height={220} className="h-[220px] w-[220px]" /> : <div className="grid h-[220px] w-[220px] place-items-center"><Loader2 className="animate-spin text-black/50" /></div>}
      </div>
      <p className="text-center text-xs tracking-wide text-muted uppercase">Scan to join</p>
      {[["Network", name, "name"], ...(password ? [["Password", password, "pass"]] : [])].map(([label, value, key]) => (
        <div key={key} className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-line" style={{ background: "var(--surface-2, var(--surface))" }}>
          <div className="min-w-0">
            <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
            <p className="truncate text-[17px] font-semibold">{value}</p>
          </div>
          <button type="button" onClick={() => copy(key as "name" | "pass")} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-line">
            {copied === key ? <Check size={15} /> : <Copy size={15} />} {copied === key ? "Copied" : "Copy"}
          </button>
        </div>
      ))}
    </div>
  );
}

type Staff = { id: string; name: string; photo_url: string | null };

/** Every staff member, with a way to thank them and a way to report. Thanks are kind words only, never a reward. */
export function StaffSheet({ staff, clientId, code, visitor, canReport, onDone }: { staff: Staff[]; clientId: string; code: string | null; visitor: Visitor | null; canReport: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<{ kind: "thank" | "report"; who: Staff } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function thank() {
    if (!mode) return;
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().rpc("guest_thank_staff", { p_client: clientId, p_staff: mode.who.id, p_note: note.trim() || null });
    setBusy(false);
    if (error) return setErr("That did not go through. Please try again in a moment.");
    setDone(`Thank you. ${mode.who.name} will be glad to hear it.`);
    setMode(null); setNote("");
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <p className="text-lg font-semibold">{done}</p>
        <button type="button" className="mt-5 min-h-11 rounded-full px-5 text-sm font-semibold ring-1 ring-line" onClick={() => setDone(null)}>Back to the team</button>
      </div>
    );
  }
  if (mode?.kind === "report") {
    return (
      <div>
        <button type="button" className="mb-3 min-h-11 text-sm text-muted underline underline-offset-4" onClick={() => setMode(null)}>Back to the team</button>
        <p className="mb-3 text-[15px] font-semibold">About {mode.who.name}</p>
        <FeedbackForm kind="complaint" clientId={clientId} code={code} visitor={visitor} subject={mode.who.name} onDone={onDone} />
      </div>
    );
  }
  if (mode?.kind === "thank") {
    return (
      <div>
        <button type="button" className="mb-3 min-h-11 text-sm text-muted underline underline-offset-4" onClick={() => setMode(null)}>Back to the team</button>
        <p className="text-[17px] font-semibold">Thank {mode.who.name}</p>
        <label className="mt-3 block text-sm text-muted" htmlFor="thanks-note">A line for them (optional)</label>
        <textarea id="thanks-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-2xl p-3 text-[15px] ring-1 ring-line" style={{ background: "var(--surface-2, var(--surface))", color: "var(--text)" }} placeholder="For example: so patient with our kids" />
        {err && <p className="mt-2 text-sm text-red-500" role="alert">{err}</p>}
        <button type="button" onClick={thank} disabled={busy} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-60" style={{ background: "var(--text)", color: "var(--bg)" }}>
          {busy && <Loader2 size={16} className="animate-spin" />} Send thanks
        </button>
        <p className="mt-3 text-center text-xs text-muted">Your name and number are not shared with this.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {staff.map((s) => (
        <li key={s.id} className="flex items-center gap-3.5 rounded-2xl p-3 ring-1 ring-line" style={{ background: "var(--surface-2, var(--surface))" }}>
          {s.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={s.photo_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-full object-cover" />
            : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-bold ring-1 ring-line">{s.name.slice(0, 1)}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{s.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode({ kind: "thank", who: s })} className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-emerald-500 ring-1 ring-emerald-500/60"><ThumbsUp size={15} /> Thank</button>
              {canReport && <button type="button" onClick={() => setMode({ kind: "report", who: s })} className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-red-500 ring-1 ring-red-500/60"><TriangleAlert size={15} /> Report</button>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Floating "New" button. Opens the owner's latest posters one by one. */
export type CardStyle = "classic" | "compact" | "tiles";
export const CARD_STYLES: { id: CardStyle; label: string; help: string }[] = [
  { id: "classic", label: "Big cards", help: "Large cards with a big icon. One under the other." },
  { id: "compact", label: "Slim rows", help: "Slim rows with a small icon. More fits on the screen." },
  { id: "tiles", label: "Square tiles", help: "Two tiles side by side, like an app home screen." },
];
export const ICON_STYLES: { id: "neon" | "solid" | "soft" | "brand"; label: string; help: string }[] = [
  { id: "neon", label: "Neon glow", help: "Glowing icons that draw themselves in." },
  { id: "solid", label: "Solid colour", help: "Flat tiles, each card in its own colour. No animation." },
  { id: "soft", label: "Soft", help: "Light tinted tiles with a coloured icon. Calm and still." },
  { id: "brand", label: "Brand colour", help: "Every icon uses your button colour. Clean and on-brand." },
];
export type NewStyle = "pill" | "tab" | "banner";
export const NEW_STYLES: { id: NewStyle; label: string; help: string }[] = [
  { id: "pill", label: "Red button", help: "A red NEW button floats above the footer, in the middle." },
  { id: "tab", label: "Side tab", help: "A small tab on the right edge. It stays out of the way." },
  { id: "banner", label: "Top strip", help: "A strip above the cards. It scrolls with the page, so it never covers anything." },
];
const REDBG = "linear-gradient(180deg, #ef4444, #dc2626)";

/** Opens the "What is new" posters again. Three looks; none of them sits on top of the Powered by Taprizz footer. */
export function NewPill({ onOpen, variant = "pill" }: { onOpen: () => void; variant?: NewStyle }) {
  if (variant === "banner") {
    return (
      <button type="button" onClick={onOpen} aria-label="See what is new" className="mx-4 mb-4 flex min-h-12 w-[calc(100%-2rem)] items-center gap-3 rounded-2xl px-4 text-left ring-1 ring-line active:scale-[0.99]" style={{ background: "var(--surface)" }}>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white uppercase" style={{ background: REDBG }}>New</span>
        <span className="flex-1 text-[14px] font-semibold">See what is new</span>
        <span aria-hidden className="text-muted">›</span>
      </button>
    );
  }
  if (variant === "tab") {
    return (
      <button type="button" onClick={onOpen} aria-label="See what is new" className="fixed right-0 bottom-28 z-30 flex min-h-11 items-center gap-2 rounded-l-2xl pr-3 pl-3.5 text-[12px] font-extrabold tracking-[0.12em] text-white uppercase shadow-[0_10px_30px_-8px_rgba(220,38,38,0.8)]" style={{ background: REDBG }}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />New
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} aria-label="See what is new" className="fixed bottom-24 left-1/2 z-30 min-h-11 -translate-x-1/2 rounded-full px-5 text-[13px] font-extrabold tracking-[0.12em] text-white uppercase shadow-[0_10px_30px_-8px_rgba(220,38,38,0.8)]" style={{ background: REDBG }}>
      New
    </button>
  );
}

export function PostersSheet({ posters }: { posters: { id: string; image_url: string; caption: string | null }[] }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    setI(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <div>
      <div ref={track} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl" aria-label="What is new">
        {posters.map((p, n) => (
          <figure key={p.id} className="w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.caption ?? `Poster ${n + 1}`} loading={n === 0 ? "eager" : "lazy"} className="mx-auto max-h-[68dvh] w-auto max-w-full rounded-2xl object-contain" />
            {p.caption && <figcaption className="mt-2 text-center text-sm text-muted">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {posters.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {posters.map((p, n) => <span key={p.id} className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-red-500" : "w-2 bg-current opacity-25"}`} />)}
        </div>
      )}
    </div>
  );
}

/** Bell on a table plate. One tap tells the staff which table needs them. */
export function CallServerButton({ clientId, code, table }: { clientId: string; code: string; table: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  async function call() {
    if (state === "busy" || state === "sent") return;
    setState("busy");
    const { error } = await supabaseBrowser().rpc("guest_call_server", { p_client: clientId, p_code: code });
    setState(error ? "error" : "sent");
    setTimeout(() => setState("idle"), error ? 3500 : 12000);
  }
  return (
    <div className="fixed right-4 bottom-5 z-30 flex flex-col items-end gap-2">
      {(state === "sent" || state === "error") && (
        <p role="status" className="max-w-[220px] rounded-2xl px-3.5 py-2 text-[13px] font-medium shadow-lg ring-1 ring-line" style={{ background: "var(--surface)", color: "var(--text)" }}>
          {state === "sent" ? `Someone is on the way to ${table}.` : "That did not go through. Please wave to the staff."}
        </p>
      )}
      <button type="button" onClick={call} aria-label={`Call a server to ${table}`} className="grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_10px_30px_-8px_rgba(225,29,72,0.8)] active:scale-95" style={{ background: "linear-gradient(180deg, #fb7185, #e11d48)" }}>
        {state === "busy" ? <Loader2 className="animate-spin" size={22} /> : state === "sent" ? <Check size={24} /> : <BellRing size={24} />}
      </button>
    </div>
  );
}
