"use client";

// Animated card icons in the style of 21st.dev's animated icon set: a lucide glyph
// with a small motion that plays on hover/tap. Swap any entry for a 21st.dev
// component later without touching the cards — they only use <AnimatedIcon name=.../>.

import { motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import {
  BookOpen,
  Star,
  MessageSquareWarning,
  Lightbulb,
  Camera,
  BadgePercent,
  CalendarDays,
  Crown,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import type { CardKey } from "@/lib/types";

const ICONS: Record<CardKey, { Icon: LucideIcon; play: TargetAndTransition }> = {
  menu: { Icon: BookOpen, play: { rotateY: [0, 25, 0], transition: { duration: 0.6 } } },
  review: { Icon: Star, play: { rotate: [0, -15, 15, 0], scale: [1, 1.15, 1], transition: { duration: 0.6 } } },
  complaint: { Icon: MessageSquareWarning, play: { x: [0, -3, 3, -2, 0], transition: { duration: 0.5 } } },
  suggestion: { Icon: Lightbulb, play: { y: [0, -4, 0], filter: ["brightness(1)", "brightness(1.6)", "brightness(1)"], transition: { duration: 0.6 } } },
  moment: { Icon: Camera, play: { scale: [1, 0.85, 1.05, 1], transition: { duration: 0.5 } } },
  offers: { Icon: BadgePercent, play: { rotate: [0, 360], transition: { duration: 0.7 } } },
  events: { Icon: CalendarDays, play: { y: [0, -3, 0, -2, 0], transition: { duration: 0.6 } } },
  membership: { Icon: Crown, play: { y: [0, -5, 0], rotate: [0, -8, 0], transition: { duration: 0.6 } } },
  creators: { Icon: Clapperboard, play: { rotate: [0, -12, 0], transition: { duration: 0.4 } } },
};

export function AnimatedIcon({ name, tint, size = 56 }: { name: CardKey; tint: string; size?: number }) {
  const reduce = useReducedMotion();
  const { Icon, play } = ICONS[name];
  return (
    <motion.span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, rgba(${tint},0.35), rgba(${tint},0.12))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 16px rgba(${tint},0.25)`,
        color: `rgb(${tint})`,
      }}
      whileHover={reduce ? undefined : play}
      whileTap={reduce ? undefined : play}
    >
      <Icon size={size * 0.48} strokeWidth={2} style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))" }} />
    </motion.span>
  );
}
