// Creators corner: defaults and the rules that keep it clean.

export type Brief = { intro?: string; shots?: string[]; tags?: string; location?: string; best_hours?: string; avoid?: string };
export type CreatorSettings = {
  brief?: Brief;
  barter?: string;            // what a creator gets per visit, e.g. "one coffee and one dessert"
  monthly_cap?: number;       // collabs approved per month; 0 means no cap
  ranges?: string[];          // follower ranges that are welcome
  blackout_days?: string[];   // YYYY-MM-DD, no creators on these days
  always_welcome?: string[];  // Instagram handles, lowercase, no @
};

export const ALL_RANGES = ["1k-5k", "5k-20k", "20k-100k", "100k+"];

// Five shot ideas to start from. The owner edits these once; guests and creators read them.
const SHOTS: Record<string, string[]> = {
  cafe: ["The first sip", "Food arriving at the table", "The corner seat", "The people behind the counter", "The exit shot"],
  salon: ["The chair before", "A close-up of the work", "The mirror reveal", "The team at work", "The walk out"],
  gym: ["The first rep", "Equipment close-up", "A class in motion", "The trainer moment", "The cool-down"],
  hotel: ["The room reveal", "The view from the window", "Breakfast spread", "The lobby moment", "The check-out wave"],
  stay: ["Arrival and the first look", "The view", "Morning on the porch", "The food on the table", "Golden hour at the property"],
  resort: ["Arrival and welcome drink", "The pool", "A meal with a view", "An activity in action", "Sunset moment"],
  clinic: ["The welcome desk", "The waiting area", "The team", "The clean treatment room", "A happy walk out"],
};
export const defaultShots = (type: string | null | undefined) => SHOTS[type ?? ""] ?? SHOTS.cafe;

/**
 * The brief and the offer must never mention Google reviews or ask for them: creators are never
 * promised anything for a review, and Google bans rewards for reviews. Used by the owner's editor.
 */
export const mentionsReviews = (text: string) => /google|\breviews?\b|\brating|\bstars?\b/i.test(text);

export const normHandle = (h: string) => h.trim().replace(/^@/, "").toLowerCase();

/** The WhatsApp message the owner sends an approved creator. Opens WhatsApp with the text ready. */
export function approvalMessage(opts: { name: string; business: string; code: string; barter?: string | null; day?: string | null }) {
  const lines = [
    `Hi ${opts.name}, you are approved to collaborate with ${opts.business}.`,
    `Your visit code: ${opts.code}. Show it to our staff when you arrive.`,
    opts.barter ? `Offer for your visit: ${opts.barter}.` : "",
    opts.day ? `You asked for ${opts.day}.` : "",
    "Please label your post as a collaboration or add #ad or #collab. This is a barter collaboration; we do not pay for posts.",
    "After posting, send us your reel link on our page under Creators corner, Submit your post.",
  ].filter(Boolean);
  return lines.join("\n");
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
