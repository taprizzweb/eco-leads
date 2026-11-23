// Alert settings kept on this phone or computer: the sound stays on until the person turns it off, across pages and visits.
import { useSyncExternalStore } from "react";

const KEY = "tz_alert_sound";
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export const setSound = (on: boolean) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* fine */ } listeners.forEach((l) => l()); };
export const useSound = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, read, () => true);

let ctx: AudioContext | null = null;
const audio = () => {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new C();
    return ctx;
  } catch { return null; }
};
/** Browsers only allow sound after the person has touched the page once. The first touch wakes the sound up. */
export function unlockAudio() { const c = audio(); if (c && c.state === "suspended") void c.resume(); return c?.state === "running"; }
export const audioReady = () => ctx?.state === "running";

export type AlertKind = "order" | "request" | "chat";
export function beep(kind: AlertKind = "order") {
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const notes = kind === "order" ? [880, 1175, 880, 1175] : kind === "request" ? [660, 880, 660] : [990, 1320];
  notes.forEach((f, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "sine";
    const t = c.currentTime + i * 0.24;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.start(t); o.stop(t + 0.23);
  });
}

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (ch) => ch.charCodeAt(0)); };
export const vapidKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const toKey = b64;
