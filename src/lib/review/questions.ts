// The questions a guest answers before the AI writes their review.
// A business uses its own list when the admin has set one, otherwise its category's list (database),
// otherwise the defaults below. The admin decides the list and how many are shown (2 to 10).

export type QType = "multi" | "single" | "text";
export type Lang = "hinglish" | "en" | "hi";
/** `label` and `chips` are the canonical text (what the review writer sees). `tr` holds the same question shown to guests in other languages, chips in the same order. */
export type Tr = Partial<Record<Lang, { label: string; chips: string[] }>>;
export type Question = { id: string; label: string; type: QType; chips: string[]; tr?: Tr };

export const MAX_QUESTIONS = 10;
export const LANGS: { id: Lang; label: string }[] = [
  { id: "hinglish", label: "Hinglish" },
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
];
export const LANG_NAME: Record<Lang, string> = { hinglish: "Hinglish", en: "English", hi: "Hindi" };

const q = (id: string, label: string, type: QType, chips: string[] = []): Question => ({ id, label, type, chips });
const who = q("who", "Who did you come with?", "single", ["Friends", "Family", "Partner", "Solo", "Colleagues"]);
const back = q("back", "Would you come back?", "single", ["Definitely", "Probably", "Maybe"]);

const BY_CATEGORY: Record<string, Question[]> = {
  cafe: [
    q("order", "What did you have?", "multi", ["Coffee", "Cold coffee", "Tea", "Breakfast", "Sandwich or burger", "Pasta", "Dessert", "Shakes"]),
    q("taste", "How was the taste?", "single", ["Amazing", "Really good", "Good", "Okay"]),
    q("service", "How was the service?", "single", ["Super quick", "Friendly", "Polite", "A bit slow"]),
    q("vibe", "How was the vibe?", "multi", ["Cosy", "Peaceful", "Good for work", "Good for friends", "Aesthetic", "A bit loud"]),
    who, back,
  ],
  salon: [
    q("service", "What did you get done?", "multi", ["Haircut", "Hair colour", "Facial", "Spa", "Makeup", "Beard trim", "Nails"]),
    q("result", "How did it turn out?", "single", ["Loved it", "Really good", "Good", "Okay"]),
    q("staff", "How was the stylist?", "multi", ["Skilled", "Listened well", "Friendly", "Gave good advice"]),
    q("clean", "How was the hygiene?", "single", ["Spotless", "Clean", "Could be better"]),
    q("wait", "How was the waiting time?", "single", ["No wait", "Short wait", "Long wait"]),
    back,
  ],
  gym: [
    q("did", "What did you try?", "multi", ["Weights", "Cardio", "Group class", "Personal training", "Yoga", "Trial session"]),
    q("trainers", "How were the trainers?", "multi", ["Knowledgeable", "Motivating", "Attentive", "Friendly"]),
    q("equip", "How was the equipment?", "single", ["Top class", "Good", "Needs more variety"]),
    q("clean", "How clean was it?", "single", ["Very clean", "Clean", "Could be better"]),
    q("crowd", "How was the crowd?", "single", ["Comfortable", "Busy but fine", "Too crowded"]),
    back,
  ],
  hotel: [
    q("stay", "What kind of stay?", "single", ["Short stay", "Weekend", "Business trip", "Family holiday", "Couple trip"]),
    q("room", "How was the room?", "multi", ["Clean", "Spacious", "Comfortable bed", "Great view", "Quiet"]),
    q("staff", "How was the staff?", "multi", ["Welcoming", "Helpful", "Quick check-in", "Polite"]),
    q("food", "How was the food?", "single", ["Delicious", "Good", "Average", "Did not try"]),
    q("loc", "How was the location?", "single", ["Very convenient", "Good", "A bit far"]),
    back,
  ],
  clinic: [
    q("visit", "What was your visit for?", "single", ["Check-up", "Treatment", "Follow-up", "Consultation"]),
    q("doc", "How was the doctor?", "multi", ["Listened carefully", "Explained clearly", "Experienced", "Kind"]),
    q("staff", "How was the staff?", "multi", ["Helpful", "Polite", "Efficient"]),
    q("wait", "How was the waiting time?", "single", ["No wait", "Short wait", "Long wait"]),
    q("clean", "How clean was the clinic?", "single", ["Spotless", "Clean", "Could be better"]),
    back,
  ],
  stay: [
    q("stay", "What kind of trip?", "single", ["Family trip", "Friends getaway", "Couple escape", "Workation", "Celebration"]),
    q("place", "What did you like about the place?", "multi", ["The view", "The quiet", "The rooms", "The garden", "Privacy", "The pool"]),
    q("host", "How was the host?", "multi", ["Warm", "Helpful", "Quick to reply", "Gave good tips"]),
    q("food", "How was the food?", "single", ["Home-style and tasty", "Good", "Average", "Did not try"]),
    q("clean", "How clean was it?", "single", ["Spotless", "Clean", "Could be better"]),
    back,
  ],
  resort: [
    q("trip", "What kind of trip?", "single", ["Family holiday", "Friends trip", "Couple getaway", "Corporate outing", "Celebration"]),
    q("liked", "What stood out?", "multi", ["The pool", "The rooms", "The food", "The activities", "The staff", "The surroundings"]),
    q("staff", "How was the staff?", "multi", ["Welcoming", "Helpful", "Attentive", "Professional"]),
    q("food", "How was the food?", "single", ["Delicious", "Good", "Average"]),
    q("value", "How was the value?", "single", ["Great value", "Fair", "A bit pricey"]),
    back,
  ],
};

const GENERIC: Question[] = [
  q("liked", "What did you like most?", "multi", ["The service", "The quality", "The atmosphere", "The staff", "The value"]),
  q("exp", "How was your experience?", "single", ["Excellent", "Very good", "Good", "Okay"]),
  q("clean", "How clean was the place?", "single", ["Spotless", "Clean", "Could be better"]),
  who, back,
];

export const defaultQuestions = (category: string | null | undefined): Question[] => (category && BY_CATEGORY[category]) || GENERIC;

/** Keeps only well-formed questions: unique ids, short labels, at most 12 chips of 30 characters each. */
export function cleanQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const r of raw.slice(0, MAX_QUESTIONS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const label = String(o.label ?? "").trim().slice(0, 120);
    const type: QType = o.type === "single" || o.type === "text" ? (o.type as QType) : "multi";
    let id = String(o.id ?? "").trim().replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || `q${out.length + 1}`;
    while (seen.has(id)) id += "x";
    const chips = Array.isArray(o.chips) ? [...new Set((o.chips as unknown[]).map((c) => String(c).trim().slice(0, 30)).filter(Boolean))].slice(0, 12) : [];
    if (!label || (type !== "text" && chips.length < 1)) continue;
    seen.add(id);
    const tr: Tr = {};
    if (o.tr && typeof o.tr === "object") {
      for (const l of ["hinglish", "en", "hi"] as Lang[]) {
        const t = (o.tr as Record<string, unknown>)[l] as { label?: unknown; chips?: unknown } | undefined;
        if (!t) continue;
        const tl = String(t.label ?? "").trim().slice(0, 160);
        const tc = Array.isArray(t.chips) ? (t.chips as unknown[]).map((c) => String(c).trim().slice(0, 60)) : [];
        if (tl && (type === "text" || (tc.length === chips.length && tc.every(Boolean)))) tr[l] = { label: tl, chips: type === "text" ? [] : tc };
      }
    }
    out.push({ id, label, type, chips: type === "text" ? [] : chips, ...(Object.keys(tr).length ? { tr } : {}) });
  }
  return out;
}

/** The list a guest actually sees: the business's own, else the category's, else the defaults, cut to the allowed number. */
export function resolveQuestions(review: { questions?: unknown; max_questions?: number } | null | undefined, category: string | null | undefined): Question[] {
  const own = cleanQuestions(review?.questions);
  const list = own.length ? own : defaultQuestions(category);
  const max = Math.max(1, Math.min(MAX_QUESTIONS, Number(review?.max_questions) || 6));
  return list.slice(0, max);
}

export const newQuestionId = () => "q" + Math.random().toString(36).slice(2, 7);

/** The question as a guest in `lang` should see it. Chips keep their canonical value so answers stay valid. */
export function localize(q: Question, lang: Lang): { label: string; chips: { value: string; text: string }[] } {
  const t = q.tr?.[lang];
  const ok = t && (q.type === "text" || t.chips.length === q.chips.length);
  return { label: ok ? t.label : q.label, chips: q.chips.map((c, i) => ({ value: c, text: ok ? t.chips[i] : c })) };
}
