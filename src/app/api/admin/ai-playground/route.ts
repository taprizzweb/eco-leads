import { NextResponse } from "next/server";
import { rpcKeyed } from "@/lib/review/serverkey";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { ReviewBusy, writeReview } from "@/lib/review/draft";
import { buildAnswers, cleanName, cleanText, resolveQuestions, toConfig } from "@/lib/review/prepare";

export const maxDuration = 60;

const Body = z.object({
  clientId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  language: z.enum(["hinglish", "en", "hi"]),
  name: z.string().max(60).default(""),
  answers: z.array(z.object({ id: z.string().max(24), values: z.array(z.string().max(120)).max(12) })).max(10).default([]),
  extra: z.string().max(400).default(""),
  count: z.number().int().min(1).max(5).default(4),
});

// Managers and owners of the Taprizz team can generate samples for any business, to judge the writing.
// Nothing is saved, and the samples are compared with each other and with the business's recent drafts.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: role } = await sb.rpc("my_team_role");
  if (role !== "owner" && role !== "manager") return NextResponse.json({ error: "Only managers and owners can use the playground." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a business and a star rating first." }, { status: 400 });
  const b = parsed.data;

  const { data: client } = await sb.from("clients").select("id, name, business_type, review_setup").eq("id", b.clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "Business not found." }, { status: 404 });
  const { data: tpl } = client.business_type ? await sb.from("business_templates").select("questions").eq("id", client.business_type).maybeSingle() : { data: null };
  const setup = (client.review_setup ?? {}) as { questions?: unknown; max_questions?: number };
  const questions = resolveQuestions({ questions: setup.questions ?? tpl?.questions, max_questions: setup.max_questions }, client.business_type);
  const answers = buildAnswers(questions, b.answers);

  const [{ data: cfgRaw }, { data: sigs }] = await Promise.all([rpcKeyed(sb, "review_ai_config", { p_client: client.id }), rpcKeyed(sb, "guest_recent_sigs", { p_client: client.id })]);
  const cfg = toConfig(cfgRaw, client.name);
  const seen = [...((sigs ?? []) as number[][])];
  const out: { text: string; provider: string; similarity: number; ms: number; tries: number; words: number }[] = [];
  for (let i = 0; i < b.count; i++) {
    const t0 = Date.now();
    let r;
    try { r = await writeReview(cfg, { rating: b.rating, language: b.language, name: cleanName(b.name), answers, extra: cleanText(b.extra, 300) }, seen, { tries: 2 }); } catch (e) {
      if (e instanceof ReviewBusy) return NextResponse.json({ error: `The AI did not answer${e.message ? ` (${e.message})` : ""}. A free model is often rate-limited: try a paid or Gemini model, or add REVIEW_AI_FALLBACK_MODELS.` }, { status: 502 });
      throw e;
    }
    seen.push(r.sig);
    out.push({ text: r.draft, provider: r.provider, similarity: Math.round(r.similarity * 100), ms: Date.now() - t0, tries: r.tries, words: r.draft.split(/\s+/).filter(Boolean).length });
  }
  return NextResponse.json({ results: out });
}
