import { resolveQuestions, type Lang, type Question } from "./questions";
import type { QA, StudioConfig } from "./draft";

type Raw = { id: string; values: string[] };

/** The guest's first name, with anything that is not a letter, space, dot, apostrophe or dash removed. */
export const cleanName = (n: string) => (n ?? "").replace(/[^\p{L} .'-]/gu, "").trim().split(/\s+/)[0]?.slice(0, 24) ?? "";

/** Free text from a guest is treated as data: no line breaks or control characters, and it is length-limited. */
export const cleanText = (t: string, max: number) => (t ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Turns what the browser sent into trusted answers. Labels and chips always come from the business's own
 * question list, never from the request, so a guest can only choose from what the business set up.
 */
export function buildAnswers(questions: Question[], raw: Raw[]): QA[] {
  const byId = new Map(raw.map((r) => [r.id, r.values]));
  return questions.map((q) => {
    const sent = byId.get(q.id) ?? [];
    let values: string[];
    if (q.type === "text") values = sent.slice(0, 1).map((v) => cleanText(v, 200)).filter(Boolean);
    else {
      values = sent.filter((v) => q.chips.includes(v));
      if (q.type === "single") values = values.slice(0, 1);
    }
    return { id: q.id, label: q.label, values };
  });
}

type Raw2 = { rules?: string; banned?: string[]; length_min?: number; length_max?: number; examples?: StudioConfig["examples"]; category?: Partial<StudioConfig["category"]>; business?: Partial<StudioConfig["business"]> } | null;

export function toConfig(raw: Raw2, fallbackName: string): StudioConfig {
  const lo = Math.max(10, Math.min(300, Number(raw?.length_min) || 35));
  const hi = Math.max(lo, Math.min(300, Number(raw?.length_max) || 95));
  return {
    rules: String(raw?.rules ?? ""),
    banned: Array.isArray(raw?.banned) ? raw!.banned!.map(String) : [],
    length_min: lo,
    length_max: hi,
    examples: Array.isArray(raw?.examples) ? raw!.examples!.filter((e) => e && typeof e.text === "string") : [],
    category: { id: raw?.category?.id ?? null, label: raw?.category?.label ?? null, keywords: raw?.category?.keywords ?? [], notes: raw?.category?.notes ?? "" },
    business: { name: raw?.business?.name ?? fallbackName, tagline: raw?.business?.tagline ?? null },
  };
}

export { resolveQuestions };
export type { Lang };
