"use client";

// Animated card icons in the style of the 21st.dev animated Lucide set: the line art draws itself
// in when the card appears, and again on hover or tap. Built from Lucide (ISC licence) with our own
// animation. To use an exact 21st.dev icon instead, drop its component into OVERRIDES below.

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Star,
  MessageSquareMore,
  Lightbulb,
  BadgePercent,
  CalendarCheck,
  Crown,
  Clapperboard,
  Link2,
  HeartHandshake,
  Wifi,
  Instagram,
  type LucideIcon,
} from "lucide-react";
import type { CardKey } from "@/lib/types";

const ICONS: Record<CardKey | "link", LucideIcon> = {
  menu: BookOpen,
  review: Star,
  complaint: MessageSquareMore,
  suggestion: Lightbulb,
  offers: BadgePercent,
  events: CalendarCheck,
  membership: Crown,
  creators: Clapperboard,
  staff: HeartHandshake,
  wifi: Wifi,
  instagram: Instagram,
  link: Link2,
};

// Exact 21st.dev icon components go here, e.g. { review: StarIcon21st }. They replace the defaults.
const OVERRIDES: Partial<Record<CardKey | "link", React.ComponentType<{ size?: number; className?: string }>>> = {};

/** Re-run the draw animation whenever `play` changes. */
function useDraw(play: number) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parts = el.querySelectorAll<SVGGeometryElement>("path, circle, rect, line, polyline, polygon");
    parts.forEach((p, i) => {
      p.setAttribute("pathLength", "1");
      p.style.strokeDasharray = "1";
      p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: 700,
        delay: i * 90,
        easing: "cubic-bezier(.65,0,.35,1)",
        fill: "both",
      });
    });
  }, [play]);
  return ref;
}

export function AnimatedIcon({ name, tint, size = 64, play = 0 }: { name: CardKey | "link"; tint: string; size?: number; play?: number }) {
  const Override = OVERRIDES[name];
  const Icon = ICONS[name];
  const [hover, setHover] = useState(0);
  const ref = useDraw(play + hover);
  return (
    <span
      ref={ref}
      aria-hidden
      onPointerEnter={() => setHover((h) => h + 1)}
      className="relative grid shrink-0 place-items-center rounded-[20px]"
      style={{
        width: size,
        height: size,
        color: `rgb(${tint})`,
        background: `radial-gradient(120% 120% at 30% 20%, rgba(${tint},0.38), rgba(${tint},0.12) 60%, rgba(${tint},0.06))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px rgba(${tint},0.28), 0 14px 30px -12px rgba(${tint},0.6)`,
      }}
    >
      {Override ? <Override size={size * 0.5} /> : <Icon size={size * 0.5} strokeWidth={1.9} style={{ filter: `drop-shadow(0 2px 6px rgba(${tint},0.55))` }} />}
    </span>
  );
}
