import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { writeReview } from "@/lib/review/draft";
import { buildAnswers, cleanName, cleanText, resolveQuestions, toConfig } from "@/lib/review/prepare";
import type { GuestPageData } from "@/lib/types";

export const maxDuration = 30;

const Body = z.object({
  code: z.string().min(3).max(40),
  rating: z.number().int().min(1).max(5),
  language: z.enum(["hinglish", "en", "hi"]),
  name: z.string().max(60).default(""),
  answers: z.array(z.object({ id: z.string().max(24), values: z.array(z.string().max(120)).max(12) })).max(10).default([]),
  extra: z.string().max(400).default(""),
});

// Best-effort limit per visitor on this server instance. The real hourly cap per business is in the database.
const hits = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 12;
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please pick a star rating first." }, { status: 400 });
  const b = parsed.data;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(`${ip}:${b.code}`)) return NextResponse.json({ error: "That is a lot of tries. Please wait a few minutes." }, { status: 429 });

  const sb = await supabaseServer();
  const { data: page } = await sb.rpc("guest_page", { p_code: b.code });
  const g = page as (GuestPageData & { review?: { questions?: unknown; max_questions?: number; languages?: string[] } }) | null;
  if (!g) return NextResponse.json({ error: "This page could not be found." }, { status: 404 });
  if (!g.live || !g.features.review) return NextResponse.json({ error: "Reviews are not available on this page right now." }, { status: 403 });
  if (g.review?.languages && !g.review.languages.includes(b.language)) return NextResponse.json({ error: "That language is not available here." }, { status: 400 });

  const { data: okBudget } = await sb.rpc("review_budget_ok", { p_client: g.client.id, p_max: 120 });
  if (okBudget === false) return NextResponse.json({ error: "We are very busy right now. Please try again in a little while." }, { status: 429 });

  const questions = resolveQuestions(g.review, g.client.business_type);
  const answers = buildAnswers(questions, b.answers);
  const name = cleanName(b.name);
  const [{ data: cfgRaw }, { data: sigs }] = await Promise.all([
    sb.rpc("review_ai_config", { p_client: g.client.id }),
    sb.rpc("guest_recent_sigs", { p_client: g.client.id }),
  ]);
  const cfg = toConfig(cfgRaw, g.client.name);
  const out = await writeReview(cfg, { rating: b.rating, language: b.language, name, answers, extra: cleanText(b.extra, 300) }, (sigs ?? []) as number[][]);

  const { data: id } = await sb.rpc("guest_save_review", {
    p_client: g.client.id,
    p_code: g.plate?.code ?? null,
    p_rating: b.rating,
    p_answers: { qa: answers, extra: cleanText(b.extra, 300) },
    p_draft: out.draft,
    p_provider: out.provider,
    p_language: b.language,
    p_name: name || null,
    p_shingles: out.sig,
  });
  return NextResponse.json({ id, draft: out.draft });
}
