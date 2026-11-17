// Keeps every generated review different, even when two guests tick exactly the same answers.
// Two layers: each request gets its own random "shape" (length, tone, opener, how many facts to mention),
// and each new draft is compared with the business's recent drafts; if it is too similar it is written again.

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Fingerprint: hashes of every group of three words. Only numbers are stored, never the text. */
export function shingles(text: string): number[] {
  const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const set = new Set<number>();
  if (w.length < 3) w.forEach((x) => set.add(fnv(x)));
  for (let i = 0; i + 3 <= w.length; i++) set.add(fnv(w.slice(i, i + 3).join(" ")));
  return [...set].slice(0, 120);
}

export function similarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  let inter = 0;
  for (const x of a) if (sb.has(x)) inter++;
  return inter / (a.length + b.length - inter);
}

export const maxSimilarity = (a: number[], others: number[][]) => others.reduce((m, o) => Math.max(m, similarity(a, o)), 0);

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const TONES = ["warm and casual", "short and to the point", "cheerful and enthusiastic", "calm and thoughtful", "chatty, like telling a friend", "simple and sincere"];
const OPENERS = [
  "begin with how the visit felt",
  "begin with the name of the place",
  "begin with what the guest had or did there",
  "begin by saying who they went with, if known",
  "begin with a short natural exclamation",
  "begin straight with the strongest thing they liked",
];

export type Shape = { words: number; tone: string; opener: string; mention: number; useName: boolean };

export function pickShape(min: number, max: number, hasName: boolean, factCount: number): Shape {
  const lo = Math.max(10, Math.min(min, max)), hi = Math.max(lo, max);
  // one review in five is very short, as real ones often are
  const words = Math.random() < 0.2 ? Math.round(14 + Math.random() * 12) : Math.round(lo + Math.random() * (hi - lo));
  const opener = pick(hasName ? [...OPENERS, "begin by introducing themselves by name in a natural way"] : OPENERS);
  return {
    words,
    tone: pick(TONES),
    opener,
    mention: factCount <= 2 ? factCount : Math.max(2, Math.min(factCount, 2 + Math.floor(Math.random() * 3))),
    // using the name every time would look odd, so about half the drafts do
    useName: hasName && (opener.includes("introducing") || Math.random() < 0.5),
  };
}

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
