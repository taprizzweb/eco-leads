// Keeps every generated review different, even when two guests tick exactly the same answers.
// Two layers: each request gets its own random "shape" (length, tone, opener, order),
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

// Everything below changes only HOW a review is written. None of it may ask for a fact (a story, a moment, company,
// an occasion, an item or a plan): the writer would make one up to satisfy it.
export const TONES = ["warm and casual", "short and to the point", "cheerful", "calm", "friendly and relaxed", "plain and sincere", "simple and direct", "matter-of-fact"];

// The order in which a real person puts things. One is chosen at random for every request.
export const ANGLES = [
  "Open with the overall verdict, then give the answers that back it.",
  "Open with one of the answers, then the verdict, then the rest.",
  "Put the most specific answer first and the overall feeling last.",
  "Keep it to short plain statements, almost like a text message.",
  "Save the overall verdict for the very last sentence.",
  "Run the answers together in a relaxed, natural flow.",
  "Say what you would tell someone who asked how it was, using only the answers.",
];
const OPENERS = [
  "do not use the word 'I' in the first sentence",
  "name the business in the first sentence",
  "name the business only after the first sentence, or in the middle of it",
  "keep the first sentence very short",
  "let the first sentence run a little longer than the others",
];
const GRAMMAR = [
  "full, correct sentences",
  "correct sentences, one of them short",
  "tidy and compact, every sentence complete",
  "one longer sentence followed by one very short one, both grammatically correct",
  "warm and natural, still with correct grammar and punctuation",
];

export type Shape = { starter: string; lines: number; words: number; tone: string; opener: string; angle: string; grammar: string; useName: boolean; seoMentions: number };

// Words a review must begin with. Re-rolled on every request, so the same answers never open the same way twice.
// A starter carries only a feeling, never a fact, a visit history or a wish.
const STARTERS: Record<string, Record<string, string[]>> = {
  en: {
    pos: ["Really glad", "Honestly,", "Quick review:", "Very happy", "Genuinely", "All good", "Short version:", "No complaints", "Overall,", "Simply put,", "My take:", "Happy with", "Pretty happy", "So,", "Good experience", "Liked", "Really liked", "For me,", "In short,"],
    mix: ["Decent", "Okay overall", "Not bad", "Fair", "It was fine", "Alright", "Honest take:", "Overall,", "My take:", "In short,"],
    neg: ["Not great", "Disappointed", "Sadly", "Unfortunately", "A bit let down", "Honest take:", "My take:", "Overall,", "In short,"],
  },
  hinglish: {
    pos: ["Bahut accha", "Kaafi accha", "Sach mein", "Ekdum", "Mast", "Badhiya", "Dil se", "Seedhi baat,", "Achha laga", "Bilkul", "Overall", "Ek number", "Mujhe", "Seriously,", "Kaafi", "Khush hoon", "Short mein,", "Koi shikayat nahi", "Honestly,"],
    mix: ["Theek-thaak", "Theek tha", "Average", "Overall theek", "Chal jayega", "Sahi tha", "Honestly,", "Normal", "Seedhi baat,"],
    neg: ["Utna accha nahi", "Thoda disappoint", "Afsos", "Sach kahun", "Mazaa nahi", "Seedhi baat,", "Honestly,"],
  },
  hi: {
    pos: ["सच में", "काफ़ी अच्छा", "बहुत बढ़िया", "दिल से", "सीधी बात,", "अच्छा लगा", "बिल्कुल", "ज़बरदस्त", "मुझे", "कुल मिलाकर", "शानदार", "सच कहूँ तो", "कोई शिकायत नहीं", "छोटा सा रिव्यू,"],
    mix: ["ठीक-ठाक", "ठीक था", "औसत", "कुल मिलाकर ठीक", "चल जाएगा", "सही था", "सीधी बात,"],
    neg: ["उतना अच्छा नहीं", "थोड़ा निराश", "अफ़सोस", "सच कहूँ तो", "सीधी बात,", "मज़ा नहीं आया,"],
  },
};
const LINES = [{ v: 2, w: 10 }, { v: 3, w: 24 }, { v: 4, w: 28 }, { v: 5, w: 22 }, { v: 6, w: 16 }];
const weighted = () => { let t = Math.random() * LINES.reduce((a, b) => a + b.w, 0); for (const l of LINES) { t -= l.w; if (t <= 0) return l.v; } return 4; };

/**
 * `answers` is how many answers this draft uses and `details` how many separate things the guest told us in them.
 * Length never exceeds what that material can fill: asking for more words than there are facts makes a writer invent.
 */
export function pickShape(min: number, max: number, hasName: boolean, answers: number, details: number, lang: string = "en", rating: number = 5): Shape {
  const room = Math.round(10 + 6 * details);
  const hi = Math.max(10, Math.min(Math.max(min, max), room));
  const lo = Math.max(8, Math.min(min, Math.round(hi * 0.7)));
  // about one review in ten is as short as it can be, as real ones sometimes are
  const words = Math.random() < 0.1 ? lo : Math.round(lo + Math.random() * (hi - lo));
  const mood = rating >= 4 ? "pos" : rating === 3 ? "mix" : "neg";
  return {
    starter: pick((STARTERS[lang] ?? STARTERS.en)[mood]),
    lines: Math.max(1, Math.min(weighted(), answers)),
    words,
    tone: pick(TONES),
    opener: pick(OPENERS),
    angle: pick(ANGLES),
    grammar: pick(GRAMMAR),
    // the name is used in roughly one review in three, so it never feels like a stamp
    useName: hasName && Math.random() < 0.34,
    seoMentions: Math.random() < 0.7 ? 1 : 2,
  };
}

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
