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

type TextCaller = (prompt: string) => Promise<string>;

const callOpenAI: TextCaller = async (prompt) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.REVIEW_AI_MODEL || "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 200, temperature: 0.8 }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content ?? "";
};

const callGemini: TextCaller = async (prompt) => {
  const model = process.env.REVIEW_AI_MODEL || "gemini-2.0-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 200, temperature: 0.8 } }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

const callAnthropic: TextCaller = async (prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.REVIEW_AI_MODEL || "claude-haiku-5-5", max_tokens: 220, messages: [{ role: "user", content: prompt }] }),
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

async function run(task: "review_draft" | "review_reply", payload: Record<string, unknown>, prompt: string, max: number): Promise<{ text: string; provider: string } | null> {
  const name = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  try {
    if (name === "custom" && process.env.REVIEW_AI_URL) {
      const t = clean(await withTimeout(callCustom(task, payload)), max);
      if (t) return { text: t, provider: "custom" };
    } else if (GENERAL[name] && process.env[GENERAL[name].key]) {
      const t = clean(await withTimeout(GENERAL[name].call(prompt)), max);
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
