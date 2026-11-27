// What a guest's review draft is allowed to say: only what this guest answered or typed.
// This file picks the answers a draft must use, and catches a draft that adds something on its own.

import type { QA } from "./draft";
import { shuffle } from "./variation";

/** Chips that only mean "none of these" are not facts and must never appear in a review. */
const PLACEHOLDER = /^(something else|others?|none|none of these|kuch aur|did not try)$/i;
/** "What did you have / try / get done?" */
const HAD_LABEL = /what did you (have|try|get|order|buy|take)|aapne kya (liya|try kiya)/i;
/** "Which one did you like most?" */
const FAVOURITE_LABEL = /(like|liked|love|loved|enjoy|enjoyed)( the)? most|favou?rite|sabse zyada/i;
/** A product or dish name, like "Blue Mind Smoothie": two or more words that all start with a capital letter. */
const ITEM_NAME = /^\p{Lu}[\p{L}'’-]*(?:\s+(?:&\s+)?\p{Lu}[\p{L}'’-]*)+$/u;

const isFavourite = (a: QA) => a.id === "fav" || FAVOURITE_LABEL.test(a.label);
export const isHad = (a: QA) => HAD_LABEL.test(a.label);

export const usableAnswers = (answers: QA[]): QA[] =>
  answers.map((a) => ({ ...a, values: a.values.map((v) => v.trim()).filter((v) => v && !PLACEHOLDER.test(v)) })).filter((a) => a.values.length);

/** The item the guest picked as the one they liked most, when it is a name a draft can be checked for. */
export const favouriteItem = (answers: QA[]): string | null =>
  usableAnswers(answers).filter(isFavourite).flatMap((a) => a.values).find((v) => ITEM_NAME.test(v)) ?? null;

/**
 * The answers one draft is built from. What the guest had and what they liked most are always in.
 * For 4 and 5 stars the rest is a random part, so two guests with the same ticks do not read the same.
 * For 1 to 3 stars everything is in, so no complaint is dropped.
 */
export function selectFacts(answers: QA[], rating: number): QA[] {
  const all = usableAnswers(answers);
  const core = all.filter((a) => isHad(a) || isFavourite(a));
  const rest = shuffle(all.filter((a) => !core.includes(a)));
  const least = Math.min(rest.length, core.length ? 1 : 2);
  const take = rating <= 3 ? rest.length : least + Math.floor(Math.random() * (Math.min(rest.length, 4) - least + 1));
  return shuffle([...core, ...rest.slice(0, take)]);
}

// Things a writing model likes to add on its own. A draft may mention one only when the guest's own answers or words do.
// Each entry lists the English, Hinglish and Hindi ways of saying the same thing, so a chip in English backs a Hindi draft.
const TOPICS: RegExp[] = [
  /\b(famil(y|ies)|kids?|children|pariva+r|ghar ?wal[eo]n?)\b|परिवार|घरवाल|ैमिली|बच्च/i,
  /\b(friends?|dost(on|o)?)\b|दोस्त|फ़?्रेंड(?!ली)/i,
  /\b(partner|wife|husband|girlfriend|boyfriend|date night|couples?)\b|पत्नी|पति के|पार्टनर/i,
  /\b(colleagues?|co-?workers?|office)\b|सहकर्मी|ऑफिस|ऑफ़िस/i,
  /\b(breakfast|nashta)\b|नाश्त|ब्रेकफास्ट|ब्रेकफ़ास्ट/i,
  /\b(lunch|brunch)\b|लंच/i,
  /\b(dinner|supper)\b|डिनर/i,
  /\b(morning|afternoon|evening|tonight|subah|dopahar|shaam)\b|सुबह|दोपहर|शाम(?!िल)/i,
  /\bweekends?\b|वीकेंड/i,
  /first (time|visit)|every ?time|\bregular(ly)?\b|pehli (baar|dafa|visit)|\bhar baar\b|पहली बार|हर बार/i,
  /\b(stayed|staying|hours?|ghant[ae]y?)\b|der tak|घंटे|देर तक/i,
  /(?<!can['’]?t )(?<!cannot )\b(wait|waited|waiting|queue|intezaa?r)\b|इंतज़ार|इंतजार|वेटिंग/i,
  /\b(heat|summers?|winters?|monsoon|rain(y|ing)?|weather|garmi|sardi|ba+rish|mausam)\b|गर्मी|सर्दी|बारिश|मौसम/i,
  /\b(jaipur|rajasthan|pink city)\b|जयपुर|राजस्थान/i,
  /\b(smil(e|es|ed|ing)|girl|boy|guy|lady|waiter|waitress|counter)\b|muskur|मुस्कु|काउंटर|लड़की|लड़का/i,
  /\b(portions?|quantity|filling)\b|pet bhar|पेट भर|पोर्शन|क्वांटिटी/i,
  /\b(price[ds]?|pricey|pricing|value|affordable|cheap|expensive|budget|sasta|mehe?nga)\b|₹|कीमत|क़ीमत|सस्त|महंग|महँग/i,
  /wi-?fi|वाई-?फ़?ाई/i,
  /\bparking\b|पार्किंग/i,
  /pet[- ]friendly|\b(pets|dogs?)\b|पालतू/i,
  /\bmusic\b|म्यूज़िक|म्यूजिक|संगीत/i,
  /\b(ambien[cs]e|decor|interiors?|seating|vibes?|cos[yz]y?|aesthetic)\b|माहौल|एम्बियंस|सजावट/i,
  /\b(health(y|ier)?|diet|sehat)\b|सेहत|हेल्दी/i,
  /\bvegan\b|वीगन/i,
  /all[- ]day|farm[- ]to[- ](fork|table)/i,
  /\b(quiet|peaceful|sha+nt|sukoon)\b|शांत|सुकून/i,
  /\bmenu\b|मेन्यू|मेनू/i,
  /\b(come back|coming back|be back|visit(ing)? again|dobara|waapas|wapas)\b|दोबारा|वापस/i,
  /\brecommend/i,
];

const norm = (s: string) => s.normalize("NFC");
const PATTERNS = TOPICS.map((re) => new RegExp(norm(re.source), re.flags));

/** Everything this guest told us, plus the business name: the only things a draft may talk about. */
export const guestSource = (business: string, answers: QA[], extra: string) =>
  [business, ...usableAnswers(answers).flatMap((a) => [a.label, ...a.values]), extra].join(" | ");

/** True when the text brings up one of the topics above and the guest never did. */
export function addsUnsaid(text: string, source: string): boolean {
  const t = norm(text), s = norm(source);
  return PATTERNS.some((re) => re.test(t) && !re.test(s));
}
