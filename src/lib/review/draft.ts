// Review drafts (written from the guest's own answers) and review replies (written for the owner).
// The writer is pluggable. Set REVIEW_AI_PROVIDER to:
//   custom    your own trained model behind a URL (see docs/REVIEW_AI.md for the exact request and reply)
//   openai | gemini | anthropic   a general model, with our prompt below
//   template  built-in sentences, no AI, no cost (also the fallback whenever the chosen provider fails)
// Drafts use ONLY what the guest answered or typed (see facts.ts). Nothing is invented, and no reward is ever tied to a review.

export type ReplyInput = { businessName: string; businessType?: string | null; author: string; rating: number; text: string; keywords?: string[] };
export type ReplyResult = { reply: string; provider: string };

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const firstName = (n: string) => n.trim().split(/\s+/).filter((w) => !/^(mr|mrs|ms|miss|dr|shri|smt)\.?$/i.test(w))[0] ?? "";

/* ------------------------------------------------------------------ reply template (no AI) */

export function templateReply(a: ReplyInput): string {
  const n = firstName(a.author);
  const lang = replyLanguage(a.text);
  if (lang === "hindi") return a.rating >= 4
    ? `${n ? `${n} जी, ` : ""}आपके इतने अच्छे शब्दों के लिए धन्यवाद। ${a.businessName} की पूरी टीम को यह सुनकर बहुत खुशी हुई। हम आपका फिर स्वागत करेंगे।`
    : `${n ? `${n} जी, ` : ""}आपको जो असुविधा हुई उसके लिए हमें खेद है। कृपया हमसे सीधे संपर्क करें ताकि हम बात समझ सकें और उसे ठीक कर सकें।`;
  if (lang === "hinglish") return a.rating >= 4
    ? `${n ? `${n}, ` : ""}itne pyaare words ke liye shukriya. ${a.businessName} ki poori team ko ye sunkar bahut khushi hui. Aapka phir se swagat hai.`
    : `${n ? `${n}, ` : ""}aapko jo pareshani hui uske liye hum maafi chahte hain. Kripya humse seedha sampark karein, taaki hum baat samajh kar use theek kar sakein.`;
  const hi = n ? `Thank you, ${n}.` : "Thank you.";
  if (a.rating >= 4) return `${hi} We are so glad you enjoyed your visit to ${a.businessName}. Our team will be happy to hear this, and we hope to see you again soon.`;
  if (a.rating === 3) return `${hi} We appreciate your honest feedback. We are sorry we did not fully get it right, and we will use what you shared to do better next time.`;
  return `${n ? `${n}, we` : "We"} are sorry your visit to ${a.businessName} fell short. This is not the experience we want for anyone. Please contact us directly so we can understand what went wrong and put it right.`;
}

/* ------------------------------------------------------------------ prompts for general models */

/** Which language and script the reviewer wrote in, so the reply matches it. */
export function replyLanguage(text: string): "hindi" | "hinglish" | "english" {
  if (/[\u0900-\u097F]/.test(text)) return "hindi";
  const hits = (text.toLowerCase().match(/\b(hai|nahi|nhi|bahut|bhut|accha|acha|achha|bohot|mast|bekar|kharab|khana|paisa|sabse|ekdum|bilkul|aur|ke|ka|ki|ko|mein|me|tha|thi|zyada|jyada|thoda|kaafi|kafi|shandar|badhiya|badiya)\b/g) ?? []).length;
  return hits >= 2 ? "hinglish" : "english";
}

const REPLY_OPENERS = [
  "start by thanking them for the specific thing they mentioned",
  "start with a warm greeting and the reviewer's first name",
  "start by saying what the team will be happy to hear",
  "start with a short, friendly sentence about their visit",
];
const REPLY_BANNED = ["100%", "guaranteed", "guarantee", "cure", "miracle", "no side effects", "free ", "discount", "coupon"];

function replyPrompt(a: ReplyInput, keyword?: string): string {
  const lang = replyLanguage(a.text);
  const langRule = lang === "hindi" ? "Write the reply in Hindi, in Devanagari script, the way a polite shop owner would speak."
    : lang === "hinglish" ? "Write the reply in Hinglish (Hindi written in the English alphabet), the same casual way the reviewer wrote."
    : "Write the reply in simple English.";
  const opener = REPLY_OPENERS[Math.floor(Math.random() * REPLY_OPENERS.length)];
  return [
    `You write public replies from a business owner to a Google review. Warm, human and professional. ${langRule}`,
    `Length: ${a.rating >= 4 ? "2 sentences" : "3 sentences"}. Vary the wording, ${opener}.`,
    `Business: ${a.businessName}${a.businessType ? ` (${a.businessType})` : ""}`,
    `Reviewer: ${a.author || "a guest"}. Rating: ${a.rating} out of 5.`,
    `Review: """${a.text.slice(0, 1200)}"""`,
    `Rules: address the reviewer by first name if given. Mention one real thing from the review. Only refer to things the review actually says; never invent facts, staff names, prices or results.`,
    `Never offer discounts, gifts or rewards, never promise specific changes, never argue, never ask for another review, never make health or medical claims. Never use the words: 100%, guaranteed, cure, miracle.`,
    `For 1 to 3 stars: apologise sincerely and invite them to contact the business directly. For 4 to 5 stars: thank them and welcome them back.`,
    keyword ? `Search phrase: if it fits naturally in one sentence, use the exact phrase "${keyword}" once, for example when welcoming them back. If it would sound forced, leave it out. Use no other search phrase and never repeat it.` : "",
    `No emojis, no hashtags, no quotation marks. Output only the reply text.`,
  ].filter(Boolean).join("\n");
}

/** A reply that breaks a rule is replaced by the safe template, so nothing risky is ever shown or posted. */
export const replyIsSafe = (reply: string, a: ReplyInput) => {
  const t = reply.toLowerCase();
  if (reply.trim().length < 15 || REPLY_BANNED.some((w) => t.includes(w))) return false;
  if (/[\u{1F300}-\u{1FAFF}]/u.test(reply) || /#\w/.test(reply)) return false;
  // Search phrases may appear once, and only in replies to 4 and 5 stars. More than that reads as stuffing and is thrown away.
  const hits = (a.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean).reduce((n, k) => n + t.split(k).length - 1, 0);
  if (hits > (a.rating >= 4 ? 1 : 0)) return false;
  const wantsDevanagari = replyLanguage(a.text) === "hindi";
  return wantsDevanagari ? /[\u0900-\u097F]/.test(reply) : !/[\u0900-\u097F]/.test(reply) || replyLanguage(a.text) !== "english";
};

/* ------------------------------------------------------------------ providers */

type CallOpts = { max?: number; temp?: number; model?: string; deadline?: number };
type TextCaller = (prompt: string, o?: CallOpts) => Promise<string>;

const callOpenAI: TextCaller = async (prompt, o) => {
  // REVIEW_AI_BASE_URL lets this talk to any OpenAI-compatible host (Groq, OpenRouter, a self-hosted open model).
  const base = (process.env.REVIEW_AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: o?.model || process.env.REVIEW_AI_MODEL || "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: o?.max ?? 200, temperature: o?.temp ?? 0.8,
      // Set REVIEW_AI_NO_THINKING=1 for hybrid reasoning models on OpenRouter, so they answer directly instead of spending the budget thinking.
      ...(process.env.REVIEW_AI_NO_THINKING === "1" ? { reasoning: { enabled: false } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content ?? "";
};

/** Gemini keys, in the order they are tried: GEMINI_API_KEYS (comma separated, up to 6) and then GEMINI_API_KEY. Only the key values go in Vercel, never in code or chat. */
export const geminiKeys = (): string[] => {
  const all = `${process.env.GEMINI_API_KEYS ?? ""},${process.env.GEMINI_API_KEY ?? ""}`.split(",").map((k) => k.trim()).filter(Boolean);
  return [...new Set(all)].slice(0, 6);
};
// A key that is used up, busy or refused hands over to the next one. A bad request (400) is not a key problem, so it stops.
const keyFailed = (status: number) => status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;

// A key that just failed is skipped for a while, so a rush does not wait on a used-up key again and again.
// It is kept in this server's memory only. If every key is resting, they are all tried again, the one that rests the shortest first.
const keyRest = new Map<string, number>();
const REST_MS = 60_000;        // busy, used up or slow: rest one minute
const REST_BAD_KEY_MS = 600_000; // refused (401 or 403): rest ten minutes
const orderedKeys = (keys: string[]) => {
  const now = Date.now();
  const ready = keys.filter((k) => (keyRest.get(k) ?? 0) <= now);
  const resting = keys.filter((k) => (keyRest.get(k) ?? 0) > now).sort((a, b) => (keyRest.get(a) ?? 0) - (keyRest.get(b) ?? 0));
  return [...ready, ...resting];
};
const restKey = (k: string, ms: number) => keyRest.set(k, Date.now() + ms);
export const resetKeyRest = () => keyRest.clear();

export const callGemini: TextCaller = async (prompt, o) => {
  const model = o?.model || process.env.REVIEW_AI_MODEL || "gemini-2.0-flash";
  const keys = orderedKeys(geminiKeys());
  if (!keys.length) throw new Error("gemini no key");
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    // 2.5 models "think" first and that eats the output budget, so thinking is switched off for short reviews.
    generationConfig: { maxOutputTokens: o?.max ?? 200, temperature: o?.temp ?? 0.8, ...(model.includes("2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
  });
  let last = "gemini failed";
  for (let k = 0; k < keys.length; k++) {
    if ((o?.deadline ?? Infinity) - Date.now() < 400) break; // no time left for another key
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": keys[k] }, body, signal: AbortSignal.timeout(Math.max(500, Math.min(2500, (o?.deadline ?? Infinity) - Date.now() - 100))),
      });
      if (res.ok) return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      last = `gemini ${res.status}`;
      if (!keyFailed(res.status)) break;
      restKey(keys[k], res.status === 401 || res.status === 403 ? REST_BAD_KEY_MS : REST_MS);
      console.error(`review ai: gemini key ${k + 1} of ${keys.length} gave ${res.status}, trying the next key`);
    } catch (e) {
      last = /abort|timeout/i.test(String((e as Error)?.message)) ? "gemini timeout" : "gemini fetch failed";
      restKey(keys[k], REST_MS / 2);
      console.error(`review ai: gemini key ${k + 1} of ${keys.length}: ${last}, trying the next key`);
    }
  }
  throw new Error(last);
};

const callAnthropic: TextCaller = async (prompt, o) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: o?.model || process.env.REVIEW_AI_MODEL || "claude-haiku-5-5", max_tokens: o?.max ?? 220, temperature: Math.min(1, o?.temp ?? 0.8), messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  return (await res.json()).content?.[0]?.text ?? "";
};

const hasKey = (n: string) => (n === "gemini" ? geminiKeys().length > 0 : !!process.env[GENERAL[n].key]);
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

/** Tidies what a model sends back: code fences, "Review:" labels, quotes, markdown and line breaks go; a cut-off ending is trimmed to the last full sentence. */
const clean = (t: string, max: number) => {
  let s = t.replace(/\r/g, "").trim();
  s = s.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "").trim();
  s = s.replace(/^(here(?:'|’)s|here is)[^:\n]{0,40}:\s*/i, "").replace(/^(google\s+)?review\s*[:：-]\s*/i, "").replace(/^(final|draft|output|text)\s*[:：-]\s*/i, "");
  s = s.replace(/\*\*|__|`/g, "").replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ");
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (s.length > max) {
    const cut = s.slice(0, max);
    const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("।"), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
    s = last > max * 0.5 ? cut.slice(0, last + 1) : cut;
  }
  return s;
};
const withTimeout = <T,>(p: Promise<T>, ms = 8000) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Models to try, in order: REVIEW_AI_MODEL first, then REVIEW_AI_FALLBACK_MODELS (comma separated). */
const modelChain = (): (string | undefined)[] => {
  const extra = (process.env.REVIEW_AI_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return [undefined, ...extra];
};
const retryable = (e: unknown) => /\b(429|408|500|502|503|504)\b|timeout|fetch failed/i.test(String((e as Error)?.message ?? e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Models used when a provider is only the backup. Set GEMINI_MODEL / ANTHROPIC_MODEL to choose another. */
const BACKUP_MODELS: Record<string, (string | undefined)[]> = {
  gemini: [process.env.GEMINI_MODEL || "gemini-flash-lite-latest", "gemini-flash-latest"],
  anthropic: [process.env.ANTHROPIC_MODEL || "claude-haiku-5-5"],
  openai: [process.env.OPENAI_MODEL || "gpt-4o-mini"],
};

export let lastProviderError = "";

async function run(task: "review_draft" | "review_reply", payload: Record<string, unknown>, prompt: string, max: number, opts?: CallOpts): Promise<{ text: string; provider: string } | null> {
  const name = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  try {
    if (name === "custom" && process.env.REVIEW_AI_URL) {
      const t = clean(await withTimeout(callCustom(task, payload), Math.max(2000, Math.min(12000, (opts?.deadline ?? Infinity) - Date.now()))), max);
      if (t) return { text: t, provider: "custom" };
    } else if (GENERAL[name] && hasKey(name)) {
      // The chosen provider first (a busy or rate-limited model is retried once, then the next model is tried).
      // If it still fails, every other provider that has a key set (Gemini, Claude) is tried in turn as a backup.
      const backups = Object.keys(GENERAL).filter((n) => n !== name && hasKey(n) && (n !== "openai" || !process.env.REVIEW_AI_BASE_URL));
      for (const prov of [name, ...backups]) {
        const primary = prov === name;
        const models: (string | undefined)[] = primary ? modelChain() : BACKUP_MODELS[prov] ?? [undefined];
        for (const model of models) {
          for (let attempt = 0; attempt < (primary && (opts?.deadline ?? Infinity) - Date.now() > 8000 ? 2 : 1); attempt++) {
            const left = (opts?.deadline ?? Infinity) - Date.now();
            if (left < 600) return null; // out of time: the guest gets a plain review instead of a hung page
            try {
              const t = clean(await withTimeout(GENERAL[prov].call(prompt, { ...opts, model }), Math.min(12000, left)), max);
              if (t) return { text: t, provider: prov };
              break;
            } catch (e) {
              lastProviderError = String((e as Error)?.message ?? e).slice(0, 160);
              console.error(`${task}: provider "${prov}"${model ? ` model ${model}` : ""}${primary ? "" : " (backup)"} failed (try ${attempt + 1}): ${lastProviderError}`);
              if (!retryable(e) || /timeout/i.test(lastProviderError)) break; // a timeout is not retried on the same model
              if (primary && attempt === 0) await sleep(1200);
            }
          }
        }
      }
    }
  } catch (e) {
    lastProviderError = String((e as Error)?.message ?? e).slice(0, 160);
    console.error(`${task}: provider "${name}" failed`, e);
  }
  return null;
}

export async function writeReply(a: ReplyInput): Promise<ReplyResult> {
  // One search phrase at most, chosen at random so replies differ, and only for happy reviews.
  const keyword = a.rating >= 4 && a.keywords?.length ? pick(a.keywords.filter((k) => k.trim())) : undefined;
  const r = await run("review_reply", {
    business: { name: a.businessName, type: a.businessType ?? null },
    review: { author: a.author, rating: a.rating, text: a.text },
    ...(keyword ? { search_phrase: keyword } : {}),
  }, replyPrompt(a, keyword), 700);
  return r && replyIsSafe(r.text, a) ? { reply: r.text, provider: r.provider } : { reply: templateReply(a), provider: "template" };
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
    else if (GENERAL[st.provider] && hasKey(st.provider)) text = await withTimeout(GENERAL[st.provider].call(replyPrompt(sample)), 10000);
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
import { maxSimilarity, pickShape, shingles, type Shape } from "./variation";
import { addsUnsaid, favouriteItem, guestSource, isHad, selectFacts, usableAnswers } from "./facts";

export class ReviewBusy extends Error {}

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
  5: "very satisfied. Say so plainly and let their answers carry it",
  4: "pleased. Mention a downside or a wish only if their answers contain one",
  3: "middling: it was okay. Do not make up a good point or a bad point to balance it",
  2: "disappointed, but fair and polite. Name a shortcoming only if their answers name it",
  1: "let down, but civil. No anger, no insults. Name a problem only if their answers name it",
};
const LANG_RULE: Record<Lang, string> = {
  en: "English, the way a regular Indian customer writes on Google: simple words, natural rhythm, no fancy vocabulary.",
  hi: "Hindi in Devanagari script: everyday spoken Hindi, not bookish or formal. Write common English words in Devanagari too. Only the business name, and item names written with capital letters in the answers, stay in English letters exactly as written. Avoid verb forms that assume the customer's gender.",
  hinglish: "Hinglish: Hindi written in Roman letters mixed with everyday English words, exactly how people text each other. Never Devanagari. Avoid verb forms that assume the customer's gender.",
};

// Phrases that make a review sound machine-made or copy-pasted. A draft containing one is rejected and rewritten.
const GENERIC_BANNED = [
  "hidden gem", "must visit", "must-visit", "a true delight", "nestled", "culinary journey", "elevated", "delve", "tapestry", "testament",
  "unforgettable experience", "five-star experience", "happy and grateful", "grateful today", "chill vibe", "good vibes", "positive vibes",
  "i will definitely come back", "maybe i will come back", "highly recommended", "highly recommend", "had a great time", "wow that was",
  "i felt relaxed", "felt relax", "love the really", "really good taste", "my name is", "overall a great", "great experience overall",
];

export function buildReviewPrompt(cfg: StudioConfig, r: ReviewRequest, facts: QA[], shape: Shape, retry: boolean): string {
  const banned = [...new Set([...GENERIC_BANNED, ...(cfg.banned ?? [])])].slice(0, 80);
  const ex = (cfg.examples ?? []).filter((e) => e.text?.trim() && (!e.language || e.language === r.language)).slice(0, 4);
  const own = r.extra.trim();
  const fav = favouriteItem(r.answers);
  // A search keyword is offered only when this guest's own answers or words already contain it.
  const said = guestSource(cfg.business.name, r.answers, r.extra).toLowerCase();
  const kw = (cfg.category.keywords ?? []).map((k) => k.trim()).filter((k) => k && said.includes(k.toLowerCase())).slice(0, 2);
  // The category's notes and the business tagline are left out on purpose: this guest did not say them.
  return [
    `You write ONE Google review as the real customer, in the first person, the way they would type it on their phone. It must read like a real person wrote it: simple and natural, never like marketing and never like a template. It reports this customer's own answers and nothing else. The language must be correct: right grammar, spelling and punctuation.`,
    ``,
    `BUSINESS NAME: ${cfg.business.name}. This is the only business name that may appear in the review.`,
    cfg.category.label ? `KIND OF BUSINESS (background so that you understand the answers; the customer did not say it): ${cfg.category.label}` : "",
    ``,
    `STARS GIVEN: ${r.rating} out of 5. The customer feels: ${FEELING[r.rating] ?? FEELING[3]}.`,
    `LANGUAGE: ${LANG_RULE[r.language]}`,
    ``,
    `THE CUSTOMER'S ANSWERS (with their own words, if any are given below, this is everything you know about the visit):`,
    ...(facts.length ? facts.map((a) => `- ${a.label} ${a.values.join(", ")}`) : ["- (nothing was answered: write only the overall feeling that matches the stars)"]),
    fav ? `MUST KEEP: the customer picked "${fav}" as the one they liked most. Say that, and write the name exactly as "${fav}".` : "",
    own ? `THE CUSTOMER'S OWN WORDS (if they carry a real detail, use that detail in your own phrasing; if it is only a vague word like "nice" or "good", treat it as mood only and never repeat it): "${own.slice(0, 300)}"` : "",
    r.name ? `CUSTOMER FIRST NAME: ${r.name}. ${shape.useName ? "Use it once, as a short sign-off at the end. Never write 'My name is' or 'I am'." : "Do NOT use the name in this review."}` : "",
    ``,
    `USING THE ANSWERS: work every answer above into natural sentences, not a list. Keep each answer's meaning and strength: "Good" stays good, "Maybe" stays maybe. For search, mention the business name ${shape.seoMentions === 1 ? "once" : "at most twice"}.${kw.length ? ` These words come from the customer's own answers and may be written as they are: ${kw.join(", ")}.` : ""} Never stuff keywords, never repeat one, never list them.`,
    `WRITING QUALITY: use correct grammar, spelling and punctuation. Every sentence is complete, the tense stays the same, no word is repeated by accident, and each sentence starts with a capital letter and ends with a full stop (or a question or exclamation mark). Write like a real person typing a Google review: natural everyday words, no heading or label at the start, no stiff phrases such as "is very satisfying because". Check it once before you answer.`,
    ``,
    `SHAPE FOR THIS ONE (so that no two reviews look alike; the shape never justifies adding a detail):`,
    `- About ${shape.lines} sentence${shape.lines > 1 ? "s" : ""} and about ${shape.words} words, with different sentence lengths. If the answers run out, stop: shorter is always better than padded.`,
    `- Begin the review with exactly these words: "${shape.starter}" (then continue naturally in one flowing sentence; never put a colon or dash after it and never use it as a heading or label).`,
    `- Tone: ${shape.tone}.`,
    `- Order: ${shape.angle}`,
    `- Opening: ${shape.opener}.`,
    `- Grammar feel: ${shape.grammar}.`,
    retry ? `IMPORTANT: an earlier version was rejected because it added something the customer did not say, left out what they liked most, used a stock phrase, or read too much like other reviews. Stay close to the answers, with different words and a different sentence order.` : "",
    cfg.rules.trim() ? `\nHOUSE STYLE NOTES (about how to write only; nothing in them is part of this customer's visit, so never turn them into a statement in the review, for example a city, an area, the weather or a feature of the place):\n${cfg.rules.trim().slice(0, 4000)}` : "",
    ex.length ? `\nEXAMPLES OF THE STYLE WE WANT (copy only the feel; none of their words or details belong to this customer):\n${ex.map((e, i) => `${i + 1}. ${e.text.trim().slice(0, 400)}`).join("\n")}` : "",
    ``,
    `HARD RULES (these win over everything above):`,
    `- Every statement about the visit must come from the customer's answers or own words. Feeling words that match the stars are fine.`,
    `- Unless an answer says it, never add: who they came with, the occasion, the meal or time of day, when they came (today, yesterday, last week), how long they stayed, whether it was a first or repeat visit, waiting time, weather, city or area, what staff did, said or looked like, portion size, price or value, seating, decor or facilities, health benefits, who the place suits, or any little story or moment.`,
    `- Do not describe an item's taste, texture, temperature or ingredients beyond what the answers say. No dish names, staff names, prices, dates, offers or events of your own.`,
    `- Spell the business name exactly as "${cfg.business.name}", in every language, never changed, shortened or translated.`,
    `- Do not call the place "the best" or "number one".`,
    `- Say they would come back or would recommend only if an answer says so. Do not advise other people what to order or do.`,
    `- Never offer or mention any reward, discount or gift. Never ask anyone to review or to visit.`,
    `- No hashtags, no emojis, no quotation marks, no headings, no lists. Plain sentences only.`,
    `- For 1 to 3 stars stay calm and factual. No insults, no accusations, nothing defamatory.`,
    `- Do not use any of these phrases or close variants: ${banned.join("; ")}.`,
    `- Do not use these empty words as the main praise unless the customer picked them: amazing, awesome, wonderful, fantastic, superb, great experience, nice place.`,
    ``,
    `Output only the review text.`,
  ].filter((l) => l !== "").join("\n");
}

/** Cheap local check before a draft is accepted: stock phrases, a name stamp, far too short, or a detail the guest never gave. */
export function looksMachineMade(text: string, shape: Shape, cfg: StudioConfig, source: string): boolean {
  const t = text.toLowerCase();
  const words = text.trim().split(/\s+/).length;
  if (words < Math.max(4, Math.min(8, Math.round(shape.words * 0.4)))) return true;
  if (/^\s*(i am|i'm|my name is|main hoon|mera naam)\b/.test(t)) return true;
  if (/(#\w+|[\u{1F300}-\u{1FAFF}])/u.test(text)) return true;
  // rewards, links and phone numbers never belong in a guest's review (policy: nothing is offered for reviews)
  if (/(https?:\/\/|www\.|\d{6,}|\b(discount|coupon|voucher|cashback|% off|percent off|free gift|in return)\b)/i.test(text)) return true;
  if (addsUnsaid(text, source)) return true;
  return [...GENERIC_BANNED, ...(cfg.banned ?? [])].some((b) => b.trim() && t.includes(b.toLowerCase()));
}

/** Plain sentences for when no AI answers: the stars, what the guest had and what they liked most, and nothing around it. */
export function templateFromAnswers(r: ReviewRequest, business: string): string {
  const had = usableAnswers(r.answers).filter(isHad).flatMap((a) => a.values);
  const fav = favouriteItem(r.answers);
  const mood = r.rating >= 4 ? 0 : r.rating === 3 ? 1 : 2;
  const joined = (and: string) => (had.length <= 1 ? had.join("") : `${had.slice(0, -1).join(", ")} ${and} ${had[had.length - 1]}`);
  const parts =
    r.language === "hi" ? [`${business} में अनुभव ${["अच्छा", "ठीक-ठाक", "निराश करने वाला"][mood]} रहा।`, had.length ? `चुना: ${joined("और")}।` : ""]
    : r.language === "hinglish" ? [`${business} ka experience ${["accha", "theek-thaak", "nirash karne wala"][mood]} raha.`, had.length ? `Liya: ${joined("aur")}.` : ""]
    : [`${["Good", "An okay", "A disappointing"][mood]} experience at ${business}.`, had.length ? `Went for ${joined("and")}.` : ""];
  return [...parts, fav ? favouriteLine(r.language, fav) : "", r.name ? `- ${r.name}` : ""].filter(Boolean).join(" ");
}

const favouriteLine = (lang: Lang, item: string) =>
  lang === "hi" ? `सबसे ज़्यादा ${item} पसंद आया।` : lang === "hinglish" ? `Sabse zyada ${item} pasand aaya.` : `Liked the ${item} the most.`;

/** Removes the sentences that break a rule (rewards, links, numbers, hashtags, stock phrases, "my name is"). Returns what is left. */
export function repairDraft(text: string, cfg: StudioConfig): string {
  const bad = (x: string) => /(#\w+|[\u{1F300}-\u{1FAFF}]|https?:\/\/|www\.|\d{6,}|\b(discount|coupon|voucher|cashback|% off|percent off|free gift|in return)\b)/iu.test(x)
    || [...GENERIC_BANNED, ...(cfg.banned ?? [])].some((b) => b.trim() && x.toLowerCase().includes(b.toLowerCase()))
    || /^\s*(i am|i'm|my name is|main hoon|mera naam)\b/i.test(x);
  const sentences = text.match(/[^.!?।]+[.!?।]*/g) ?? [];
  return sentences.map((x) => x.trim()).filter((x) => x && !bad(x)).join(" ").trim();
}

/**
 * Writes one review. Up to four attempts: each gets a fresh random shape and pick of answers, and an attempt is accepted
 * when it passes the rules, keeps the guest's favourite item and is not too similar to the business's recent drafts.
 * If every attempt breaks a rule, the offending sentences are cut out; if a detail was made up, or too little is left,
 * or there is no working AI, the guest gets plain sentences built from their own picks (the admin test page gets the error instead).
 * A draft that breaks a rule is never returned.
 */
export async function writeReview(cfg: StudioConfig, r: ReviewRequest, recentSigs: number[][], opts: { tries?: number; strict?: boolean } = {}): Promise<WrittenReview> {
  const source = guestSource(cfg.business.name, r.answers, r.extra);
  const fav = favouriteItem(r.answers);
  const keeps = (text: string) => !fav || text.toLowerCase().includes(fav.toLowerCase());
  const withFavourite = (text: string) => (keeps(text) ? text : `${text} ${favouriteLine(r.language, fav!)}`);
  let best: WrittenReview | null = null;
  const broken: { text: string; provider: string; shape: Shape }[] = [];
  const attempts = opts.tries ?? 2;
  // The guest waits only a few seconds: the AI gets REVIEW_AI_BUDGET_MS (3000 by default), then the plain review built from their own picks is shown.
  const deadline = Date.now() + (Number(process.env.REVIEW_AI_BUDGET_MS) || 3000);
  // Up to two extra attempts when the best draft so far is almost a copy of a recent one, or lost the favourite.
  for (let i = 0; i < attempts + 2; i++) {
    if (i >= attempts && (!best || (best.similarity < 0.85 && keeps(best.draft)) || Date.now() > deadline - 1500)) break;
    if (i > 0 && deadline - Date.now() < 1500) break; // not enough time for another try
    const facts = selectFacts(r.answers, r.rating);
    const typed = r.extra.split(/\s+/).filter(Boolean).length;
    const details = facts.reduce((n, a) => n + a.values.length, 0) + Math.min(6, Math.ceil(typed / 4));
    const shape = pickShape(cfg.length_min, cfg.length_max, !!r.name, facts.length + (typed ? 1 : 0), details, r.language, r.rating);
    const prompt = buildReviewPrompt(cfg, r, facts, shape, i > 0);
    const out = await run("review_draft", {
      business: { name: cfg.business.name, type: cfg.category.label ?? null },
      rating: r.rating, language: r.language, name: r.name, answers: facts, extra: r.extra, rules: cfg.rules, shape, prompt,
    }, prompt, 900, { max: r.language === "hi" ? 700 : 400, temp: 0.7 + Math.random() * 0.3, deadline });
    if (!out) break; // no provider, or it failed: no point trying again
    if (looksMachineMade(out.text, shape, cfg, source)) { broken.push({ text: out.text, provider: out.provider, shape }); continue; }
    const sig = shingles(out.text);
    const sim = maxSimilarity(sig, recentSigs);
    const cand: WrittenReview = { draft: out.text, provider: out.provider, sig, similarity: sim, tries: i + 1 };
    // keeping the favourite counts for more than being different
    if (!best || (keeps(cand.draft) !== keeps(best.draft) ? keeps(cand.draft) : sim < best.similarity)) best = cand;
    if (sim < 0.4 && keeps(out.text)) break;
  }
  if (best) {
    const draft = withFavourite(best.draft);
    return draft === best.draft ? best : { ...best, draft, sig: shingles(draft) };
  }
  // Every attempt broke a rule: keep what is still clean, if enough is left. A draft that added a detail of its own is
  // never cut down and used, because the sentences around an invention are usually invented too.
  for (const b of broken) {
    if (addsUnsaid(b.text, source)) continue;
    const fixed = repairDraft(b.text, cfg);
    if (fixed && !looksMachineMade(fixed, b.shape, cfg, source)) {
      const draft = withFavourite(fixed);
      return { draft, provider: b.provider, sig: shingles(draft), similarity: 0.5, tries: attempts };
    }
  }
  // The admin test page asks for strict mode so it shows the real AI error instead of a template.
  if (opts.strict && aiStatus().provider !== "template" && aiStatus().ready) throw new ReviewBusy(broken.length ? "the writer's answers broke the rules" : lastProviderError);
  // The AI is busy, out of quota or rate limited: the guest still gets a plain review built from their own picks, editable, instead of an empty box.
  // The failure stays in the logs ("failed (try ...)") so it can be fixed at the AI provider.
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
  if (!g || !hasKey(name)) return null;
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
