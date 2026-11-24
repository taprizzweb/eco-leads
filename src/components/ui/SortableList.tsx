"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

export type GripProps = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  style: CSSProperties;
};

/** The round grab handle people press and hold to drag. */
export function Grip({ label, className = "", style, ...rest }: GripProps & { label: string; className?: string }) {
  return (
    <button type="button" aria-label={label} title="Drag to move" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${className}`} style={{ ...style, color: "var(--d-muted)" }} {...rest}>
      <GripVertical size={17} />
    </button>
  );
}

/**
 * Drag to reorder with a finger or a mouse. Each item gets grip props for its handle; press and hold the handle, move over the spot you
 * want and let go. The list scrolls by itself near the top and bottom edge of the screen. The caller keeps its own up/down buttons for keyboard use.
 */
export function SortableList<T>({ items, keyOf, onChange, className, render }: {
  items: T[]; keyOf: (item: T, i: number) => string; onChange: (next: T[]) => void; className?: string;
  render: (item: T, i: number, grip: GripProps, state: { dragging: boolean; over: boolean }) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const live = useRef<{ from: number; over: number } | null>(null);

  const overAt = (x: number, y: number, from: number) => {
    const nodes = Array.from(box.current?.querySelectorAll<HTMLElement>(":scope > [data-sort-i]") ?? []);
    let best = from, bestD = Infinity;
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      const i = Number(el.dataset.sortI);
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };
  const set = (v: { from: number; over: number } | null) => { live.current = v; setDrag(v); };
  const end = (e: PointerEvent<HTMLElement>, commit: boolean) => {
    const d = live.current;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    set(null);
    if (commit && d && d.from !== d.over) { const next = [...items]; const [m] = next.splice(d.from, 1); next.splice(d.over, 0, m); onChange(next); }
  };

  return (
    <div ref={box} className={className}>
      {items.map((item, i) => {
        const grip: GripProps = {
          onPointerDown: (e) => { if (e.button !== 0 && e.pointerType === "mouse") return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); set({ from: i, over: i }); },
          onPointerMove: (e) => {
            const d = live.current; if (!d || d.from !== i) return;
            if (e.clientY < 80) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 80) window.scrollBy(0, 14);
            const over = overAt(e.clientX, e.clientY, d.from);
            if (over !== d.over) set({ from: d.from, over });
          },
          onPointerUp: (e) => end(e, true),
          onPointerCancel: (e) => end(e, false),
          style: { touchAction: "none", cursor: drag?.from === i ? "grabbing" : "grab" },
        };
        const dragging = drag?.from === i, over = !!drag && drag.over === i && drag.from !== i;
        return (
          <div key={keyOf(item, i)} data-sort-i={i} style={{ opacity: dragging ? 0.45 : 1, outline: over ? "2px solid var(--d-text)" : "none", outlineOffset: 2, borderRadius: 14, transition: "opacity .12s" }}>
            {render(item, i, grip, { dragging, over })}
          </div>
        );
      })}
    </div>
  );
}
