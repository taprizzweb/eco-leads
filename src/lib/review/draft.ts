// Review drafts (written from the guest's own answers) and review replies (written for the owner).
// The writer is pluggable. Set REVIEW_AI_PROVIDER to:
//   custom    your own trained model behind a URL (see docs/REVIEW_AI.md for the exact request and reply)
//   openai | gemini | anthropic   a general model, with our prompt below
//   template  built-in sentences, no AI, no cost (also the fallback whenever the chosen provider fails)
// Drafts use ONLY what the guest answered. Nothing is invented, and no reward is ever tied to a review.

export type ReviewAnswers = {
  rating: number;
  chips: string[];
  company?: string; // "friends", "family", "partner", "solo", "work"
  recommend?: "yes" | "maybe" | "no";
  businessName: string;
  businessType?: string | null;
};
export type DraftResult = { draft: string; provider: string };

export type ReplyInput = { businessName: string; businessType?: string | null; author: string; rating: number; text: string };
export type ReplyResult = { reply: string; provider: string };

const COMPANY_PHRASE: Record<string, string> = {
  friends: "with friends",
  family: "with family",
  partner: "with my partner",
  solo: "on my own",
  work: "for work",
};

const list = (items: string[]) => {
  const l = items.map((s) => s.toLowerCase());
  return l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";

/* ------------------------------------------------------------------ templates (no AI) */

export function templateDraft(a: ReviewAnswers): string {
  const chips = a.chips.slice(0, 4);
  const who = a.company ? ` ${COMPANY_PHRASE[a.company] ?? ""}` : "";
  const parts: string[] = [];
  if (a.rating >= 4) {
    parts.push(pick([`Visited ${a.businessName}${who} and had a great time.`, `Lovely visit to ${a.businessName}${who}.`, `Really enjoyed ${a.businessName}${who}.`]));
    if (chips.length) parts.push(pick([`The ${list(chips)} stood out.`, `Loved the ${list(chips)}.`, `Special mention for the ${list(chips)}.`]));
    if (a.recommend === "yes") parts.push(pick(["Would definitely recommend.", "Will be back soon.", "Highly recommended."]));
  } else if (a.rating === 3) {
    parts.push(`Decent visit to ${a.businessName}${who}.`);
    if (chips.length) parts.push(`The ${list(chips)} ${chips.length > 1 ? "were" : "was"} good.`);
    parts.push(a.recommend === "yes" ? "Worth a visit." : "Some things could be better.");
  } else {
    parts.push(`Visited ${a.businessName}${who}.`);
    if (chips.length) parts.push(`The ${list(chips)} ${chips.length > 1 ? "were" : "was"} fine.`);
    parts.push("The experience did not meet my expectations this time.");
  }
  return parts.join(" ");
}

export function templateReply(a: ReplyInput): string {
  const n = firstName(a.author);
  const hi = n ? `Thank you, ${n}.` : "Thank you.";
  if (a.rating >= 4) return `${hi} We are so glad you enjoyed your visit to ${a.businessName}. Our team will be happy to hear this, and we hope to see you again soon.`;
  if (a.rating === 3) return `${hi} We appreciate your honest feedback. We are sorry we did not fully get it right, and we will use what you shared to do better next time.`;
  return `${n ? `${n}, we` : "We"} are sorry your visit to ${a.businessName} fell short. This is not the experience we want for anyone. Please contact us directly so we can understand what went wrong and put it right.`;
}

/* ------------------------------------------------------------------ prompts for general models */

function draftPrompt(a: ReviewAnswers): string {
  return [
    `Write a short, natural Google review (2 to 3 sentences, under 60 words) in first person, in plain English.`,
    `Use ONLY these facts from the guest. Do not invent dishes, names, prices, or details that are not listed.`,
    `Business: ${a.businessName}${a.businessType ? ` (${a.businessType})` : ""}`,
    `Star rating: ${a.rating} out of 5`,
    `What stood out: ${a.chips.length ? a.chips.join(", ") : "nothing specific"}`,
    a.company ? `Came ${COMPANY_PHRASE[a.company] ?? a.company}` : "",
    a.recommend ? `Would recommend: ${a.recommend}` : "",
    `Match the tone to the rating. No hashtags, no emojis, no quotation marks. Output only the review text.`,
  ].filter(Boolean).join("\n");
}

function replyPrompt(a: ReplyInput): string {
  return [
    `You write public replies from a business owner to a Google review. Write 2 to 3 sentences, warm and professional, plain English.`,
    `Business: ${a.businessName}${a.businessType ? ` (${a.businessType})` : ""}`,
    `Reviewer: ${a.author || "a guest"}. Rating: ${a.rating} out of 5.`,
    `Review: """${a.text.slice(0, 1200)}"""`,
    `Rules: address the reviewer by first name if given. Only refer to things the review actually says; never invent facts.`,
    `Never offer discounts, gifts or rewards, never promise specific changes, never argue, never ask for another review.`,
    `For 1 to 3 stars: apologise sincerely and invite them to contact the business directly. For 4 to 5 stars: thank them and welcome them back.`,
    `No emojis, no hashtags, no quotation marks. Output only the reply text.`,
  ].join("\n");
}

/* ------------------------------------------------------------------ providers */

type CallOpts = { max?: number; temp?: number };
type TextCaller = (prompt: string, o?: CallOpts) => Promise<string>;

const callOpenAI: TextCaller = async (prompt, o) => {
  // REVIEW_AI_BASE_URL lets this talk to any OpenAI-compatible host (Groq, OpenRouter, a self-hosted open model).
  const base = (process.env.REVIEW_AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.REVIEW_AI_MODEL || "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: o?.max ?? 200, temperature: o?.temp ?? 0.8,
      // Set REVIEW_AI_NO_THINKING=1 for hybrid reasoning models on OpenRouter, so they answer directly instead of spending the budget thinking.
      ...(process.env.REVIEW_AI_NO_THINKING === "1" ? { reasoning: { enabled: false } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content ?? "";
};

const callGemini: TextCaller = async (prompt, o) => {
  const model = process.env.REVIEW_AI_MODEL || "gemini-2.0-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // 2.5 models "think" first and that eats the output budget, so thinking is switched off for short reviews.
      generationConfig: { maxOutputTokens: o?.max ?? 200, temperature: o?.temp ?? 0.8, ...(model.includes("2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

const callAnthropic: TextCaller = async (prompt, o) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.REVIEW_AI_MODEL || "claude-haiku-5-5", max_tokens: o?.max ?? 220, temperature: Math.min(1, o?.temp ?? 0.8), messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  return (await res.json()).content?.[0]?.text ?? "";
};

const GENERAL: Record<string, { key: string; call: TextCaller }> = {
  openai: { key: "OPENAI_API_KEY", call: callOpenAI },
  gemini: { key: "GEMINI_API_KEY", call: callGemini },
  anthropic: { key: "ANTHROPIC_API_KEY", call: callAnthropic },
};

/** Your own trained model behind a URL. We send the facts as JSON and read { text } back. */
async function callCustom(task: "review_draft" | "review_reply", payload: Record<string, unknown>): Promise<string> {
  const url = process.env.REVIEW_AI_URL;
  if (!url) throw new Error("REVIEW_AI_URL not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(process.env.REVIEW_AI_SECRET ? { authorization: `Bearer ${process.env.REVIEW_AI_SECRET}` } : {}) },
    body: JSON.stringify({ task, ...payload }),
  });
  if (!res.ok) throw new Error(`custom ${res.status}`);
  const j = await res.json();
  return String(j.text ?? j.review ?? j.reply ?? "");
}

const clean = (t: string, max: number) => t.trim().replace(/^["'“”]+|["'“”]+$/g, "").slice(0, max);
const withTimeout = <T,>(p: Promise<T>, ms = 8000) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function run(task: "review_draft" | "review_reply", payload: Record<string, unknown>, prompt: string, max: number, opts?: CallOpts): Promise<{ text: string; provider: string } | null> {
  const name = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  try {
    if (name === "custom" && process.env.REVIEW_AI_URL) {
      const t = clean(await withTimeout(callCustom(task, payload)), max);
      if (t) return { text: t, provider: "custom" };
    } else if (GENERAL[name] && process.env[GENERAL[name].key]) {
      const t = clean(await withTimeout(GENERAL[name].call(prompt, opts), 15000), max);
      if (t) return { text: t, provider: name };
    }
  } catch (e) {
    console.error(`${task}: provider "${name}" failed, using the template`, e);
  }
  return null;
}

export async function writeDraft(a: ReviewAnswers): Promise<DraftResult> {
  const r = await run("review_draft", {
    business: { name: a.businessName, type: a.businessType ?? null },
    rating: a.rating,
    answers: { chips: a.chips, company: a.company ?? null, recommend: a.recommend ?? null },
  }, draftPrompt(a), 600);
  return r ? { draft: r.text, provider: r.provider } : { draft: templateDraft(a), provider: "template" };
}

export async function writeReply(a: ReplyInput): Promise<ReplyResult> {
  const r = await run("review_reply", {
    business: { name: a.businessName, type: a.businessType ?? null },
    review: { author: a.author, rating: a.rating, text: a.text },
  }, replyPrompt(a), 700);
  return r ? { reply: r.text, provider: r.provider } : { reply: templateReply(a), provider: "template" };
}

/* ------------------------------------------------------------------ admin: is the writer connected? */

export function aiStatus() {
  const provider = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  let host: string | null = null;
  try { host = process.env.REVIEW_AI_URL ? new URL(process.env.REVIEW_AI_URL).host : null; } catch { host = "not a valid address"; }
  const general = GENERAL[provider];
  return {
    provider,
    host,
    hasSecret: !!process.env.REVIEW_AI_SECRET,
    keySet: general ? !!process.env[general.key] : null,
    ready: provider === "template" || (provider === "custom" && !!host && host !== "not a valid address") || (!!general && !!process.env[general.key]),
  };
}

/** Sends one sample review to the configured writer and reports what happened, without hiding errors behind the fallback. */
export async function aiProbe(): Promise<{ ok: boolean; provider: string; ms: number; text?: string; error?: string; hint?: string }> {
  const st = aiStatus();
  const sample: ReplyInput = { businessName: "Test Cafe", businessType: "cafe", author: "Test Guest", rating: 2, text: "Waited 20 minutes for a cold coffee." };
  const t0 = Date.now();
  try {
    let text = "";
    if (st.provider === "custom") text = await withTimeout(callCustom("review_reply", { business: { name: sample.businessName, type: sample.businessType }, review: { author: sample.author, rating: sample.rating, text: sample.text } }), 10000);
    else if (GENERAL[st.provider] && process.env[GENERAL[st.provider].key]) text = await withTimeout(GENERAL[st.provider].call(replyPrompt(sample)), 10000);
    else return { ok: true, provider: "template", ms: Date.now() - t0, text: templateReply(sample), hint: st.provider === "template" ? "The built-in writer is active. Set REVIEW_AI_PROVIDER to custom to use your own model." : "The provider is chosen but its key or address is missing, so the built-in writer is used." };
    text = clean(text, 700);
    if (!text) return { ok: false, provider: st.provider, ms: Date.now() - t0, error: "Connected, but the answer was empty.", hint: 'Your endpoint must reply with JSON like {"text": "the reply"}.' };
    return { ok: true, provider: st.provider, ms: Date.now() - t0, text };
  } catch (e) {
    const m = (e as Error).message || "failed";
    const hint =
      /custom 401|custom 403/.test(m) ? "Your project refused us. Check that the secret matches on both sides, and that Vercel Authentication is off for that project's production site." :
      /custom 404/.test(m) ? "That address was not found. Check the path at the end of REVIEW_AI_URL." :
      /custom 5\d\d/.test(m) ? "Your project reached an error while writing the reply. Check its logs." :
      /timeout/.test(m) ? "No answer within 10 seconds. A slow model will fall back to the built-in writer for guests." :
      /JSON|Unexpected/.test(m) ? 'Your endpoint did not return JSON. It must reply with {"text": "..."}.' :
      /fetch failed|ENOTFOUND|ECONNREFUSED/.test(m) ? "We could not reach that address. Check the web address is spelled right and the project is deployed." : undefined;
    return { ok: false, provider: st.provider, ms: Date.now() - t0, error: m, hint };
  }
}

/* ------------------------------------------------------------------ the AI Review Studio writer */

import { LANG_NAME, type Lang } from "./questions";
import { maxSimilarity, pickShape, shingles, shuffle, type Shape } from "./variation";

export type StudioConfig = {
  rules: string;
  banned: string[];
  length_min: number;
  length_max: number;
  examples: { language?: string; rating?: number; text: string }[];
  category: { id?: string | null; label?: string | null; keywords: string[]; notes: string };
  business: { name: string; tagline?: string | null };
};
export type QA = { id: string; label: string; values: string[] };
export type ReviewRequest = { rating: number; language: Lang; name: string; answers: QA[]; extra: string };
export type WrittenReview = { draft: string; provider: string; sig: number[]; similarity: number; tries: number };

const FEELING: Record<number, string> = {
  5: "delighted and grateful",
  4: "happy, with at most one tiny wish for improvement",
  3: "mixed: some things were good, some were only okay",
  2: "disappointed, but fair and polite",
  1: "upset, but civil and factual",
};
const LANG_RULE: Record<Lang, string> = {
  en: "English: simple, natural, the way a regular Indian customer writes on Google. No fancy words.",
  hi: "Hindi in Devanagari script: everyday spoken Hindi, not bookish or formal. A few common English words are fine, written in Devanagari or English as people naturally do.",
  hinglish: "Hinglish: Hindi written in Roman letters mixed with English, exactly how people text each other (for example \"yaar coffee ekdum mast thi\"). Not Devanagari.",
};

const GENERIC_BANNED = ["hidden gem", "must visit", "must-visit", "a true delight", "nestled", "culinary journey", "elevated", "delve", "tapestry", "testament", "unforgettable experience", "five-star experience"];

export function buildReviewPrompt(cfg: StudioConfig, r: ReviewRequest, shape: Shape, retry: boolean): string {
  const facts = r.answers.filter((a) => a.values.length).map((a) => `- ${a.label} ${a.values.join(", ")}`);
  const chosen = shuffle(facts).slice(0, Math.max(1, shape.mention));
  const banned = [...new Set([...GENERIC_BANNED, ...(cfg.banned ?? [])])].slice(0, 60);
  const ex = (cfg.examples ?? []).filter((e) => e.text?.trim() && (!e.language || e.language === r.language)).slice(0, 4);
  return [
    `You write ONE Google review exactly as a real customer would type it on their phone right after a visit. It is the customer's own review, so write it in the first person.`,
    ``,
    `BUSINESS: ${cfg.business.name}${cfg.category.label ? ` (${cfg.category.label})` : ""}${cfg.business.tagline ? `. ${cfg.business.tagline}` : ""}`,
    cfg.category.keywords?.length ? `WORDS THAT FIT THIS KIND OF PLACE (use only where natural): ${cfg.category.keywords.join(", ")}` : "",
    cfg.category.notes ? `WHAT GUESTS OF THIS KIND OF PLACE CARE ABOUT: ${cfg.category.notes}` : "",
    ``,
    `STAR RATING GIVEN: ${r.rating} out of 5. The feeling should be: ${FEELING[r.rating] ?? FEELING[3]}.`,
    `LANGUAGE: ${LANG_RULE[r.language]}`,
    ``,
    `WHAT THE GUEST TOLD US (the ONLY facts you may use; mention about ${chosen.length} of them, not necessarily all):`,
    ...(chosen.length ? chosen : ["- (nothing specific; keep it general and short)"]),
    r.extra.trim() ? `THE GUEST'S OWN WORDS (weave these in, keep their meaning): "${r.extra.trim().slice(0, 300)}"` : "",
    r.name ? `GUEST FIRST NAME: ${r.name}. ${shape.useName ? "Use the name once, naturally (for example introducing themselves)." : "Do NOT mention the name this time."}` : "",
    ``,
    `SHAPE FOR THIS ONE: about ${shape.words} words. Tone: ${shape.tone}. ${shape.opener[0].toUpperCase()}${shape.opener.slice(1)}.`,
    retry ? `IMPORTANT: an earlier version was too similar to other reviews. Use clearly different wording, sentence order and length.` : "",
    ``,
    `HARD RULES:`,
    `- Never invent anything the guest did not tell us: no dish names, staff names, prices, dates, offers or events.`,
    `- Never offer or mention any reward, discount or gift. Never ask anyone to review.`,
    `- No hashtags, no emojis, no quotation marks, no headings, no lists. Plain sentences only.`,
    `- For 1 to 3 stars stay calm and factual. No insults, no accusations, nothing defamatory.`,
    `- Do not sound like an advertisement. Avoid these phrases: ${banned.join("; ")}.`,
    cfg.rules.trim() ? `\nHOUSE RULES FROM THE OWNER OF TAPRIZZ (follow these):\n${cfg.rules.trim().slice(0, 4000)}` : "",
    ex.length ? `\nEXAMPLES OF THE STYLE WE WANT (never copy them, only the feel):\n${ex.map((e, i) => `${i + 1}. ${e.text.trim().slice(0, 400)}`).join("\n")}` : "",
    ``,
    `Output only the review text.`,
  ].filter((l) => l !== "").join("\n");
}

function templateFromAnswers(r: ReviewRequest, business: string): string {
  const facts = r.answers.flatMap((a) => a.values).slice(0, 3).map((v) => v.toLowerCase());
  const f = facts.length ? facts.join(", ") : "";
  const nm = r.name ? `${r.name} here. ` : "";
  if (r.language === "hi") return `${nm}${business} में अच्छा अनुभव रहा।${f ? ` ${f} पसंद आया।` : ""}`.trim();
  if (r.language === "hinglish") return `${nm}${business} ka experience ${r.rating >= 4 ? "kaafi accha" : r.rating === 3 ? "theek-thaak" : "thoda nirash karne wala"} raha.${f ? ` ${f} ${r.rating >= 4 ? "pasand aaya" : "ok tha"}.` : ""}`.trim();
  return `${nm}${templateDraft({ rating: r.rating, chips: facts, businessName: business })}`.trim();
}

/**
 * Writes one review. Up to three attempts: each gets a fresh random shape, and an attempt is accepted only when it is
 * not too similar to the business's recent drafts. Without a working AI provider it falls back to plain sentences,
 * which is what guests get until an AI key is connected.
 */
export async function writeReview(cfg: StudioConfig, r: ReviewRequest, recentSigs: number[][], opts: { tries?: number } = {}): Promise<WrittenReview> {
  const factCount = r.answers.filter((a) => a.values.length).length;
  let best: WrittenReview | null = null;
  const attempts = opts.tries ?? 3;
  for (let i = 0; i < attempts; i++) {
    const shape = pickShape(cfg.length_min, cfg.length_max, !!r.name, factCount);
    const prompt = buildReviewPrompt(cfg, r, shape, i > 0);
    const out = await run("review_draft", {
      business: { name: cfg.business.name, type: cfg.category.label ?? null },
      rating: r.rating, language: r.language, name: r.name, answers: r.answers, extra: r.extra, rules: cfg.rules, shape, prompt,
    }, prompt, 900, { max: r.language === "hi" ? 700 : 400, temp: 1.0 });
    if (!out) break; // no provider, or it failed: no point trying again
    const sig = shingles(out.text);
    const sim = maxSimilarity(sig, recentSigs);
    const cand: WrittenReview = { draft: out.text, provider: out.provider, sig, similarity: sim, tries: i + 1 };
    if (!best || sim < best.similarity) best = cand;
    if (sim < 0.4) break;
  }
  if (best) return best;
  const t = templateFromAnswers(r, cfg.business.name);
  return { draft: t, provider: "template", sig: shingles(t), similarity: 0, tries: 0 };
}


/* ------------------------------------------------------------------ translating questions */

/**
 * Translates a set of questions and their chips into other languages in one call, keeping chips in the same order.
 * Uses the configured general model (a "custom" writer cannot translate). Returns null when no model is connected.
 */
export async function translateQuestions(
  qs: { id: string; label: string; type: string; chips: string[] }[],
  from: Lang,
  to: Lang[],
): Promise<Record<string, Partial<Record<Lang, { label: string; chips: string[] }>>> | null> {
  const name = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  const g = GENERAL[name];
  if (!g || !process.env[g.key]) return null;
  const style: Record<Lang, string> = {
    en: "natural, simple English",
    hi: "natural spoken Hindi in Devanagari script, the way people actually talk, not stiff textbook Hindi",
    hinglish: "natural Hinglish: Hindi as people type it on WhatsApp, in Roman letters, mixing common English words",
  };
  const src = qs.map((q) => ({ id: q.id, label: q.label, chips: q.chips }));
  const prompt = [
    `Translate these customer-feedback questions and their answer chips from ${LANG_NAME[from]} into: ${to.map((l) => `"${l}" (${style[l]})`).join("; ")}.`,
    `Keep the meaning, keep each chip short (1 to 4 words), and keep the chips in exactly the same order and count.`,
    `Reply with JSON only, no markdown: {"<id>": {"<lang>": {"label": "...", "chips": ["..."]}}} for every id and every requested language.`,
    JSON.stringify(src),
  ].join("\n");
  const raw = await withTimeout(g.call(prompt, { max: 3000, temp: 0.2 }), 40000);
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Record<string, Record<string, { label?: string; chips?: string[] }>>;
  const out: Record<string, Partial<Record<Lang, { label: string; chips: string[] }>>> = {};
  for (const q of qs) {
    for (const l of to) {
      const t = parsed?.[q.id]?.[l];
      if (!t?.label) continue;
      const chips = q.type === "text" ? [] : (t.chips ?? []).map((c) => String(c).trim());
      if (q.type !== "text" && (chips.length !== q.chips.length || chips.some((c) => !c))) continue;
      (out[q.id] ??= {})[l] = { label: String(t.label).trim(), chips };
    }
  }
  return out;
}
