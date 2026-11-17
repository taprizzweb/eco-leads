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

export const TONES = ["warm and casual", "short and to the point", "cheerful", "calm and thoughtful", "chatty, like telling a friend", "plain and sincere", "a little witty", "matter-of-fact and practical"];

// Different ways a real person structures a review. One is chosen at random for every request.
export const ANGLES = [
  "Tell it as a tiny story of the visit, in the order things happened.",
  "Lead with the single thing that stood out, then add one more detail.",
  "Write it as a tip to the next customer: what to order or do, and who it suits.",
  "Start with an expectation versus reality line, then the specifics.",
  "Write two or three very short sentences, almost like a text message.",
  "Describe one specific moment from the visit, then give a one-line verdict.",
  "Start with who they came with or the occasion, then what they liked.",
  "Give a verdict first, then the reasons in a natural flow.",
  "Write it as a recommendation to a friend who is deciding whether to go.",
];
const OPENERS = [
  "do not start with the business name or with the word 'I'",
  "start with the business name",
  "start with a specific item or service from the facts",
  "start with a short natural reaction (not 'Wow')",
  "start with when or why they went, only if the facts say so, otherwise start with the verdict",
  "start with the feeling after leaving, said plainly",
];
const GRAMMAR = [
  "mostly full sentences",
  "mix one short fragment with normal sentences",
  "casual and slightly run-on, like speech",
  "tidy and compact",
  "one long sentence followed by one very short one",
];

export type Shape = { starter: string; lines: number; words: number; tone: string; opener: string; angle: string; grammar: string; mention: number; useName: boolean; seoMentions: number };

// Words a review must begin with. Re-rolled on every request, so the same answers never open the same way twice.
const STARTERS: Record<string, Record<string, string[]>> = {
  en: {
    pos: ["Really glad", "Honestly,", "Such a", "Quick review:", "Loved", "Very happy", "Top notch", "Pleasant", "Can't complain", "Smooth", "Impressed", "Definitely", "What a", "Solid", "Worth it", "Lovely", "Hands down", "Genuinely", "Felt", "All good", "Glad I", "Short version:", "No complaints", "Easily", "Came for", "Turns out", "Nothing fancy, but", "Straight up,"],
    mix: ["Decent", "Okay overall", "Mixed feelings", "Not bad", "Fair", "Some good", "It was fine", "Mostly", "Reasonable", "Partly", "Alright", "Honest take:", "Good in parts"],
    neg: ["Not great", "Disappointed", "Expected more", "Sadly", "Unfortunately", "Below expectations", "Could be better", "A bit let down", "Room for improvement", "Wish"],
  },
  hinglish: {
    pos: ["Bahut accha", "Kaafi accha", "Sach mein", "Ekdum", "Mast", "Badhiya", "Dil se", "Seedhi baat,", "Achha laga", "Yahan ka", "Bilkul", "Kya baat", "Zabardast", "Mujhe", "Overall", "Shandaar", "Ek number", "Sukoon", "Seriously,", "Kaafi", "Khush hoon", "Short mein,", "Koi shikayat nahi", "Dost ke saath aaya tha,", "Pehli baar aaya, par"],
    mix: ["Theek-thaak", "Thik tha", "Kuch cheezein", "Average", "Overall theek", "Thoda", "Mixed", "Chal jayega", "Sahi tha", "Honestly,", "Normal"],
    neg: ["Utna accha nahi", "Thoda disappoint", "Umeed", "Afsos", "Expected zyada", "Sach kahun", "Kuch khaas nahi", "Mazaa nahi", "Kaash"],
  },
  hi: {
    pos: ["सच में", "काफ़ी अच्छा", "बहुत बढ़िया", "दिल से", "मज़ा आ गया", "सीधी बात,", "अच्छा लगा", "यहाँ का", "बिल्कुल", "क्या बात", "ज़बरदस्त", "मुझे", "कुल मिलाकर", "शानदार", "सुकून", "सच कहूँ तो", "कोई शिकायत नहीं", "छोटा सा रिव्यू,", "दोस्तों के साथ गया था,"],
    mix: ["ठीक-ठाक", "ठीक था", "कुछ चीज़ें", "औसत", "कुल मिलाकर ठीक", "थोड़ा", "मिला-जुला", "चल जाएगा", "सही था"],
    neg: ["उतना अच्छा नहीं", "थोड़ा निराश", "उम्मीद", "अफ़सोस", "उम्मीद से कम", "सच कहूँ तो", "कुछ ख़ास नहीं", "काश"],
  },
};
const LINES = [{ v: 2, w: 10 }, { v: 3, w: 24 }, { v: 4, w: 28 }, { v: 5, w: 22 }, { v: 6, w: 16 }];
const weighted = () => { let t = Math.random() * LINES.reduce((a, b) => a + b.w, 0); for (const l of LINES) { t -= l.w; if (t <= 0) return l.v; } return 4; };

export function pickShape(min: number, max: number, hasName: boolean, factCount: number, lang: string = "en", rating: number = 5): Shape {
  const lo = Math.max(10, Math.min(min, max)), hi = Math.max(lo, max);
  // about one review in ten is very short, as real ones sometimes are
  const words = Math.random() < 0.1 ? Math.round(16 + Math.random() * 12) : Math.round(lo + Math.random() * (hi - lo));
  const mood = rating >= 4 ? "pos" : rating === 3 ? "mix" : "neg";
  return {
    starter: pick((STARTERS[lang] ?? STARTERS.en)[mood]),
    lines: weighted(),
    words,
    tone: pick(TONES),
    opener: pick(OPENERS),
    angle: pick(ANGLES),
    grammar: pick(GRAMMAR),
    mention: factCount <= 2 ? factCount : Math.max(2, Math.min(factCount, 2 + Math.floor(Math.random() * 3))),
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
