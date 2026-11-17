// Review drafts are written ONLY from the guest's own answers (rating, chips,
// company, recommend). Never invent dishes, staff names or experiences.
// Provider is pluggable via REVIEW_AI_PROVIDER; with no key we use templates.

export type ReviewAnswers = {
  rating: number;
  chips: string[];
  company?: string; // "friends", "family", "partner", "solo", "work"
  recommend?: "yes" | "maybe" | "no";
  businessName: string;
  businessType?: string | null;
};

export type DraftResult = { draft: string; provider: string };

const COMPANY_PHRASE: Record<string, string> = {
  friends: "with friends",
  family: "with family",
  partner: "with my partner",
  solo: "on my own",
  work: "for work",
};

function list(items: string[]): string {
  const lower = items.map((s) => s.toLowerCase());
  if (lower.length <= 1) return lower.join("");
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

function prompt(a: ReviewAnswers): string {
  return [
    `Write a short, natural Google review (2 to 3 sentences, under 60 words) in first person, in plain English.`,
    `Use ONLY these facts from the guest. Do not invent dishes, names, prices, or details that are not listed.`,
    `Business: ${a.businessName}${a.businessType ? ` (${a.businessType})` : ""}`,
    `Star rating: ${a.rating} out of 5`,
    `What stood out: ${a.chips.length ? a.chips.join(", ") : "nothing specific"}`,
    a.company ? `Came ${COMPANY_PHRASE[a.company] ?? a.company}` : "",
    a.recommend ? `Would recommend: ${a.recommend}` : "",
    `Match the tone to the rating. No hashtags, no emojis, no quotation marks. Output only the review text.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callOpenAI(a: ReviewAnswers): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.REVIEW_AI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt(a) }],
      max_tokens: 160,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function callGemini(a: ReviewAnswers): Promise<string> {
  const model = process.env.REVIEW_AI_MODEL || "gemini-2.0-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt(a) }] }],
      generationConfig: { maxOutputTokens: 160, temperature: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callAnthropic(a: ReviewAnswers): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.REVIEW_AI_MODEL || "claude-haiku-5-5",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt(a) }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const j = await res.json();
  return j.content?.[0]?.text ?? "";
}

const PROVIDERS: Record<string, { key: string; call: (a: ReviewAnswers) => Promise<string> }> = {
  openai: { key: "OPENAI_API_KEY", call: callOpenAI },
  gemini: { key: "GEMINI_API_KEY", call: callGemini },
  anthropic: { key: "ANTHROPIC_API_KEY", call: callAnthropic },
};

export async function writeDraft(a: ReviewAnswers): Promise<DraftResult> {
  const name = (process.env.REVIEW_AI_PROVIDER || "template").toLowerCase();
  const p = PROVIDERS[name];
  if (p && process.env[p.key]) {
    try {
      const ctrl = AbortSignal.timeout(6000);
      const text = await Promise.race([
        p.call(a),
        new Promise<string>((_, rej) => ctrl.addEventListener("abort", () => rej(new Error("timeout")))),
      ]);
      const clean = text.trim().replace(/^["']|["']$/g, "");
      if (clean) return { draft: clean.slice(0, 600), provider: name };
    } catch (e) {
      console.error("review draft provider failed, using template", e);
    }
  }
  return { draft: templateDraft(a), provider: "template" };
}
