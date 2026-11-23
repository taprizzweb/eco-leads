"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useBackToClose } from "@/lib/sheet-back";

export type StripItem = { url: string; caption?: string | null; label?: string | null; kind?: "image" | "video" };
const isVideo = (p: StripItem) => p.kind === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(p.url);

/** Full-screen view of a photo or clip. Swipe or use the arrows to move; Back (or the cross) returns to the page. */
export function Lightbox({ items, start, onClose }: { items: StripItem[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const x0 = useRef<number | null>(null);
  const n = items.length;
  useBackToClose(true, onClose);
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [onClose, go]);
  const p = items[i];
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Photo viewer"
      onPointerDown={(e) => { x0.current = e.clientX; }}
      onPointerUp={(e) => { if (x0.current !== null) { const d = e.clientX - x0.current; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); } x0.current = null; }}>
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 text-white">
        <span className="text-sm opacity-80">{n > 1 ? `${i + 1} / ${n}` : ""}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><X size={22} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {isVideo(p)
          ? <video key={p.url} src={p.url} controls autoPlay playsInline loop className="max-h-full max-w-full" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={p.url} src={p.url} alt={p.caption ?? ""} draggable={false} className="max-h-full max-w-full object-contain" />}
        {n > 1 && (<>
          <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 hidden h-11 w-11 place-items-center rounded-full bg-white/15 text-white sm:grid"><ChevronLeft /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 hidden h-11 w-11 place-items-center rounded-full bg-white/15 text-white sm:grid"><ChevronRight /></button>
        </>)}
      </div>
      {p.caption && <p className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-sm text-white/85">{p.caption}</p>}
    </div>
  );
}

/**
 * Photos and clips that keep moving on their own, smoothly and without stopping. Pressing and holding pauses them; they carry on at once when
 * released. A tap opens the photo (or clip) full screen, and going back returns to the same page with the strip still moving.
 */
export function PhotoStrip({ items, width = 220, ratio = "4/5", className = "" }: { items: StripItem[]; width?: number; ratio?: string; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const n = items.length;
  const moving = n >= 3;
  // each half of the loop must be wider than the screen, or a blank gap shows before the next round
  const reps = moving ? Math.max(1, Math.ceil(8 / n)) : 1;
  const half = Array.from({ length: reps }).flatMap((_, r) => items.map((p, k) => ({ p, k, key: `${r}-${k}` })));
  const tile = (t: { p: StripItem; k: number; key: string }, hidden = false) => (
    <button key={(hidden ? "d" : "") + t.key} type="button" tabIndex={hidden ? -1 : 0} aria-hidden={hidden} onClick={() => setOpen(t.k)} aria-label={t.p.caption ? `Open ${t.p.caption}` : `Open photo ${t.k + 1}`}
      className="relative mr-3 shrink-0 overflow-hidden rounded-[22px] ring-1 ring-line active:scale-[0.98]" style={{ width, aspectRatio: ratio, background: "var(--surface)" }}>
      {isVideo(t.p)
        ? <video src={t.p.url} muted loop playsInline autoPlay preload="metadata" className="h-full w-full object-cover" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={t.p.url} alt={t.p.caption ?? ""} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />}
      {t.p.caption && <span className="absolute top-3 left-3 max-w-[85%] truncate rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-md">{t.p.caption}</span>}
      {t.p.label && <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold tracking-wide whitespace-nowrap text-black uppercase backdrop-blur-md">{t.p.label}</span>}
    </button>
  );
  return (
    <div className={className}>
      {moving ? (
        <div className="photo-marquee overflow-hidden" aria-label="Photos">
          <div className="photo-track" style={{ ["--photo-duration" as string]: `${Math.max(24, n * reps * 5)}s` }}>
            <div className="flex shrink-0">{half.map((t) => tile(t))}</div>
            <div className="flex shrink-0" aria-hidden>{half.map((t) => tile(t, true))}</div>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar flex justify-center overflow-x-auto px-4" aria-label="Photos">{items.map((p, k) => tile({ p, k, key: String(k) }))}</div>
      )}
      {open !== null && <Lightbox items={items} start={open} onClose={close} />}
    </div>
  );
}
