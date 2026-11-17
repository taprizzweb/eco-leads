import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { writeDraft } from "@/lib/review/draft";
import type { GuestPageData } from "@/lib/types";

const Body = z.object({
  code: z.string().min(3).max(40),
  rating: z.number().int().min(1).max(5),
  chips: z.array(z.string().max(30)).max(8).default([]),
  company: z.enum(["friends", "family", "partner", "solo", "work"]).optional(),
  recommend: z.enum(["yes", "maybe", "no"]).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please pick a rating first." }, { status: 400 });
  const b = parsed.data;

  const sb = await supabaseServer();
  const { data: page } = await sb.rpc("guest_page", { p_code: b.code });
  const g = page as GuestPageData | null;
  if (!g) return NextResponse.json({ error: "This page could not be found." }, { status: 404 });

  // Only chips the business actually offers are accepted, so the draft stays grounded.
  const chips = b.chips.filter((c) => g.client.review_chips.includes(c));
  const { draft, provider } = await writeDraft({
    rating: b.rating,
    chips,
    company: b.company,
    recommend: b.recommend,
    businessName: g.client.name,
    businessType: g.client.business_type,
  });

  const { data: id } = await sb.rpc("guest_save_review", {
    p_client: g.client.id,
    p_code: g.plate?.code ?? null,
    p_rating: b.rating,
    p_answers: { chips, company: b.company, recommend: b.recommend },
    p_draft: draft,
    p_provider: provider,
  });

  return NextResponse.json({ id, draft });
}
