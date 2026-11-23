"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbox } from "@/components/PhotoStrip";

/** The top of a place page: its photos fade into each other; a tap opens them full screen. */
export function PlaceHero({ photos, name, children }: { photos: string[]; name: string; children: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (photos.length < 2 || open) return;
    const t = setInterval(() => setI((v) => (v + 1) % photos.length), 3600);
    return () => clearInterval(t);
  }, [photos.length, open]);
  return (
    <section className="relative isolate aspect-[4/4.4] w-full overflow-hidden text-white" style={{ borderRadius: 28, background: "linear-gradient(145deg, #3a2a20, #1b1410)" }} aria-label={name}>
      {photos.map((u, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt={k === 0 ? name : ""} loading={k === 0 ? "eager" : "lazy"} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000" style={{ opacity: k === i ? 1 : 0 }} />
      ))}
      {photos.length > 0 && <button type="button" aria-label="Open the photos full screen" className="absolute inset-0 z-10" onClick={() => setOpen(true)} />}
      <div className="pointer-events-none absolute inset-0 z-20" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.85) 100%)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 p-5">{children}</div>
      {photos.length > 1 && <div className="absolute top-4 right-4 z-20 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">{i + 1} / {photos.length}</div>}
      {open && <Lightbox items={photos.map((url) => ({ url }))} start={i} onClose={close} />}
    </section>
  );
}
