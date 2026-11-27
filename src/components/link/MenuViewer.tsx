"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useBackToClose } from "@/lib/sheet-back";

/** A menu link that can be shown inside the page: a Google Drive file, or a PDF. Anything else is not embedded. */
export function menuEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.hostname === "drive.google.com") {
      const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? u.searchParams.get("id");
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    if (/\.pdf$/i.test(u.pathname)) return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  } catch { /* not a web address */ }
  return null;
}

/** The menu opens full screen inside the page. The cross (or the phone's back button) closes it and the guest is back on the page. */
export function MenuViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  useBackToClose(true, onClose);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", key); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 text-white">
        <span className="truncate text-base font-semibold">{title}</span>
        <button type="button" onClick={onClose} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-full bg-white/15 transition active:scale-90"><X size={22} /></button>
      </div>
      <iframe src={src} title={title} className="min-h-0 w-full flex-1 border-0 bg-white" allow="fullscreen" referrerPolicy="no-referrer" />
    </div>
  );
}
