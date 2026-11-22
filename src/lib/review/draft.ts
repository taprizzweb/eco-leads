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
const firstName = (n: string) => n.trim().split(/\s+/).filter((w) => !/^(mr|mrs|ms|miss|dr|shri|smt)\.?$/i.test(w))[0] ?? "";

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

function replyPrompt(a: ReplyInput): string {
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
    `No emojis, no hashtags, no quotation marks. Output only the reply text.`,
  ].join("\n");
}

/** A reply that breaks a rule is replaced by the safe template, so nothing risky is ever shown or posted. */
export const replyIsSafe = (reply: string, a: ReplyInput) => {
  const t = reply.toLowerCase();
  if (reply.trim().length < 15 || REPLY_BANNED.some((w) => t.includes(w))) return false;
  if (/[\u{1F300}-\u{1FAFF}]/u.test(reply) || /#\w/.test(reply)) return false;
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

const callGemini: TextCaller = async (prompt, o) => {
  const model = o?.model || process.env.REVIEW_AI_MODEL || "gemini-2.0-flash";
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
    body: JSON.stringify({ model: o?.model || process.env.REVIEW_AI_MODEL || "claude-haiku-5-5", max_tokens: o?.max ?? 220, temperature: Math.min(1, o?.temp ?? 0.8), messages: [{ role: "user", content: prompt }] }),
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

export let lastProviderError = "";

async function run(task: "review_draft" | "review_reply", payload: Record<string, unknown>, prompt: string, max: number, opts?: CallOpts): Promise<{ text: string; provider: string } | null> {
  const name = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  try {
    if (name === "custom" && process.env.REVIEW_AI_URL) {
      const t = clean(await withTimeout(callCustom(task, payload), Math.max(2000, Math.min(12000, (opts?.deadline ?? Infinity) - Date.now()))), max);
      if (t) return { text: t, provider: "custom" };
    } else if (GENERAL[name] && process.env[GENERAL[name].key]) {
      // A busy or rate-limited model (typical on free plans) is retried once after a short pause, then the next model is tried.
      for (const model of modelChain()) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const left = (opts?.deadline ?? Infinity) - Date.now();
          if (left < 2500) return null; // out of time: the guest gets a clear "try again" instead of a hung page
          try {
            const t = clean(await withTimeout(GENERAL[name].call(prompt, { ...opts, model }), Math.min(12000, left)), max);
            if (t) return { text: t, provider: name };
            break;
          } catch (e) {
            lastProviderError = String((e as Error)?.message ?? e).slice(0, 160);
            console.error(`${task}: provider "${name}"${model ? ` model ${model}` : ""} failed (try ${attempt + 1}): ${lastProviderError}`);
            if (!retryable(e) || /timeout/i.test(lastProviderError)) break; // a timeout is not retried on the same model
            if (attempt === 0) await sleep(1200);
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
  5: "very satisfied. Show it through specifics, not through adjectives like amazing, awesome, wonderful or grateful",
  4: "pleased, with at most one small wish for improvement",
  3: "mixed: some things were good, some were only okay. Balanced and fair",
  2: "disappointed, but fair and polite. Say what fell short",
  1: "let down, but civil and factual. No anger, no insults",
};
const LANG_RULE: Record<Lang, string> = {
  en: "English, the way a regular Indian customer writes on Google: simple words, natural rhythm, no fancy vocabulary.",
  hi: "Hindi in Devanagari script only: everyday spoken Hindi, not bookish or formal. Write common English words (coffee, staff, service) in Devanagari too (कॉफ़ी, स्टाफ़, सर्विस). Only the business name may stay in English letters.",
  hinglish: "Hinglish: Hindi written in Roman letters mixed with English, exactly how people text each other (for example \"coffee ekdum mast thi, staff bhi kaafi helpful\"). Never Devanagari.",
};

// Phrases that make a review sound machine-made or copy-pasted. A draft containing one is rejected and rewritten.
const GENERIC_BANNED = [
  "hidden gem", "must visit", "must-visit", "a true delight", "nestled", "culinary journey", "elevated", "delve", "tapestry", "testament",
  "unforgettable experience", "five-star experience", "happy and grateful", "grateful today", "chill vibe", "good vibes", "positive vibes",
  "i will definitely come back", "maybe i will come back", "highly recommended", "highly recommend", "had a great time", "wow that was",
  "i felt relaxed", "felt relax", "love the really", "really good taste", "my name is", "overall a great", "great experience overall",
];

export function buildReviewPrompt(cfg: StudioConfig, r: ReviewRequest, shape: Shape, retry: boolean): string {
  const facts = r.answers.filter((a) => a.values.length).map((a) => `- ${a.label} ${a.values.join(", ")}`);
  const chosen = shuffle(facts).slice(0, Math.max(1, shape.mention));
  const banned = [...new Set([...GENERIC_BANNED, ...(cfg.banned ?? [])])].slice(0, 80);
  const ex = (cfg.examples ?? []).filter((e) => e.text?.trim() && (!e.language || e.language === r.language)).slice(0, 4);
  const own = r.extra.trim();
  const kw = shuffle(cfg.category.keywords ?? []).slice(0, 3);
  return [
    `You write ONE Google review as the real customer, in the first person, the way they would type it on their phone after the visit. It must read like a real person wrote it: specific, a little imperfect, never like marketing and never like a template.`,
    ``,
    `BUSINESS: ${cfg.business.name}${cfg.category.label ? ` (${cfg.category.label})` : ""}${cfg.business.tagline ? `. ${cfg.business.tagline}` : ""}`,
    cfg.category.notes ? `WHAT GUESTS OF THIS KIND OF PLACE CARE ABOUT: ${cfg.category.notes}` : "",
    ``,
    `STARS GIVEN: ${r.rating} out of 5. The customer feels: ${FEELING[r.rating] ?? FEELING[3]}.`,
    `LANGUAGE: ${LANG_RULE[r.language]}`,
    ``,
    `FACTS FROM THE CUSTOMER (the ONLY facts you may state; weave in about ${chosen.length} of them as concrete, specific sentences, not as a list):`,
    ...(chosen.length ? chosen : ["- (nothing specific; keep it short and general)"]),
    own ? `THE CUSTOMER'S OWN WORDS (if they carry a real detail, use that detail in your own phrasing; if it is only a vague word like "nice" or "good", treat it as mood only and never repeat it): "${own.slice(0, 300)}"` : "",
    r.name ? `CUSTOMER FIRST NAME: ${r.name}. ${shape.useName ? "Use the name once in a natural way, for example a short sign-off at the end or a casual self-mention. Never write 'My name is' or 'I am'." : "Do NOT use the name in this review."}` : "",
    ``,
    `HELPFUL AND SEARCHABLE (without sounding like SEO): make the review useful to the next customer by saying what they would actually want to know (what to try, who it suits, what it is good for) using only the facts above. Mention the business name ${shape.seoMentions === 1 ? "once" : "at most twice"}${cfg.category.label ? ` and naturally refer to what kind of place it is (${cfg.category.label})` : ""}.${kw.length ? ` If it fits naturally, you may use one of: ${kw.join(", ")}.` : ""} Never stuff keywords.`,
    ``,
    `SHAPE FOR THIS ONE (follow it so that no two reviews look alike):`,
    `- Write exactly ${shape.lines} sentences (about ${shape.words} words in total), with different sentence lengths.`,
    `- Begin the review with exactly these words: "${shape.starter}" (then continue naturally).`,
    `- Tone: ${shape.tone}.`,
    `- Structure: ${shape.angle}`,
    `- Opening: ${shape.opener}.`,
    `- Grammar feel: ${shape.grammar}.`,
    `- Do not finish with a "will come back" line unless the facts say the customer would return.`,
    retry ? `IMPORTANT: an earlier version was rejected for being too similar to other reviews or using stock phrases. Use completely different words, a different first word, and a different sentence order.` : "",
    ``,
    `HARD RULES:`,
    `- Never invent anything the customer did not tell us: no dish names, staff names, prices, dates, offers or events. You may add ordinary connecting words and how they felt, but no new factual claims.`,
    `- Never offer or mention any reward, discount or gift. Never ask anyone to review or to visit.`,
    `- No hashtags, no emojis, no quotation marks, no headings, no lists. Plain sentences only.`,
    `- For 1 to 3 stars stay calm and factual. No insults, no accusations, nothing defamatory.`,
    `- Do not use any of these phrases or close variants: ${banned.join("; ")}.`,
    `- Do not use these empty words as the main praise: amazing, awesome, wonderful, fantastic, superb, great experience, nice place.`,
    cfg.rules.trim() ? `\nHOUSE RULES FROM THE OWNER OF TAPRIZZ (follow these):\n${cfg.rules.trim().slice(0, 4000)}` : "",
    ex.length ? `\nEXAMPLES OF THE STYLE WE WANT (never copy their words, only the feel):\n${ex.map((e, i) => `${i + 1}. ${e.text.trim().slice(0, 400)}`).join("\n")}` : "",
    ``,
    `Output only the review text.`,
  ].filter((l) => l !== "").join("\n");
}

/** Cheap local check before a draft is accepted: stock phrases, a name stamp, or far too short. */
export function looksMachineMade(text: string, shape: Shape, cfg: StudioConfig): boolean {
  const t = text.toLowerCase();
  const words = text.trim().split(/\s+/).length;
  if (words < Math.max(8, shape.lines * 4)) return true;
  if (/^\s*(i am|i'm|my name is|main hoon|mera naam)\b/.test(t)) return true;
  if (/(#\w+|[\u{1F300}-\u{1FAFF}])/u.test(text)) return true;
  // rewards, links and phone numbers never belong in a guest's review (policy: nothing is offered for reviews)
  if (/(https?:\/\/|www\.|\d{6,}|\b(discount|coupon|voucher|cashback|% off|percent off|free gift|in return)\b)/i.test(text)) return true;
  return [...GENERIC_BANNED, ...(cfg.banned ?? [])].some((b) => b.trim() && t.includes(b.toLowerCase()));
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
/** Removes the sentences that break a rule (rewards, links, numbers, hashtags, stock phrases, "my name is"). Returns what is left. */
export function repairDraft(text: string, cfg: StudioConfig): string {
  const bad = (x: string) => /(#\w+|[\u{1F300}-\u{1FAFF}]|https?:\/\/|www\.|\d{6,}|\b(discount|coupon|voucher|cashback|% off|percent off|free gift|in return)\b)/iu.test(x)
    || [...GENERIC_BANNED, ...(cfg.banned ?? [])].some((b) => b.trim() && x.toLowerCase().includes(b.toLowerCase()))
    || /^\s*(i am|i'm|my name is|main hoon|mera naam)\b/i.test(x);
  const sentences = text.match(/[^.!?।]+[.!?।]*/g) ?? [];
  return sentences.map((x) => x.trim()).filter((x) => x && !bad(x)).join(" ").trim();
}

/**
 * Writes one review. Up to four attempts: each gets a fresh random shape, and an attempt is accepted only when it is
 * not too similar to the business's recent drafts and passes the rules. If every attempt breaks a rule, the offending
 * sentences are cut out; if too little is left, the guest is asked to try again. A draft that breaks a rule is never returned.
 * Without a connected AI it falls back to plain sentences.
 */
export async function writeReview(cfg: StudioConfig, r: ReviewRequest, recentSigs: number[][], opts: { tries?: number; strict?: boolean } = {}): Promise<WrittenReview> {
  const factCount = r.answers.filter((a) => a.values.length).length;
  let best: WrittenReview | null = null;
  const broken: { text: string; provider: string; shape: Shape }[] = [];
  const attempts = opts.tries ?? 4;
  const deadline = Date.now() + 24000; // the API route may run for 30 s at most
  // Up to two extra attempts when the best draft so far is almost a copy of a recent one.
  for (let i = 0; i < attempts + 2; i++) {
    if (i >= attempts && (!best || best.similarity < 0.85 || Date.now() > deadline - 6000)) break;
    const shape = pickShape(cfg.length_min, cfg.length_max, !!r.name, factCount, r.language, r.rating);
    const prompt = buildReviewPrompt(cfg, r, shape, i > 0);
    const out = await run("review_draft", {
      business: { name: cfg.business.name, type: cfg.category.label ?? null },
      rating: r.rating, language: r.language, name: r.name, answers: r.answers, extra: r.extra, rules: cfg.rules, shape, prompt,
    }, prompt, 900, { max: r.language === "hi" ? 700 : 400, temp: 0.9 + Math.random() * 0.3, deadline });
    if (!out) break; // no provider, or it failed: no point trying again
    if (looksMachineMade(out.text, shape, cfg)) { broken.push({ text: out.text, provider: out.provider, shape }); continue; }
    const sig = shingles(out.text);
    const sim = maxSimilarity(sig, recentSigs);
    const cand: WrittenReview = { draft: out.text, provider: out.provider, sig, similarity: sim, tries: i + 1 };
    if (!best || sim < best.similarity) best = cand;
    if (sim < 0.4) break;
  }
  if (best) return best;
  // Every attempt broke a rule: keep what is still clean, if enough is left.
  for (const b of broken) {
    const fixed = repairDraft(b.text, cfg);
    if (fixed && !looksMachineMade(fixed, { ...b.shape, lines: Math.min(b.shape.lines, 2) }, cfg)) {
      return { draft: fixed, provider: b.provider, sig: shingles(fixed), similarity: 0.5, tries: attempts };
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
