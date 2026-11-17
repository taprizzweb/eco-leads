import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { translateQuestions } from "@/lib/review/draft";
import { cleanQuestions } from "@/lib/review/questions";

export const maxDuration = 60;

const Body = z.object({ from: z.enum(["hinglish", "en", "hi"]), questions: z.array(z.unknown()).max(10) });

// Write the questions once in one language; the connected model fills in the other two.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: role } = await sb.rpc("my_team_role");
  if (role !== "owner" && role !== "manager") return NextResponse.json({ error: "Only managers and owners can translate questions." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add at least one question first." }, { status: 400 });
  const qs = cleanQuestions(parsed.data.questions);
  if (!qs.length) return NextResponse.json({ error: "Add at least one question with chips first." }, { status: 400 });
  const to = (["hinglish", "en", "hi"] as const).filter((l) => l !== parsed.data.from);
  try {
    const tr = await translateQuestions(qs, parsed.data.from, [...to]);
    if (!tr) return NextResponse.json({ error: "No AI is connected yet. Connect a model in the Connection tab and try again." }, { status: 409 });
    const out = qs.map((q) => ({ ...q, tr: { ...tr[q.id], [parsed.data.from]: { label: q.label, chips: q.chips } } }));
    const missing = out.filter((q) => to.some((l) => !q.tr[l])).length;
    return NextResponse.json({ questions: out, missing });
  } catch (e) {
    console.error("translate-questions failed", e);
    return NextResponse.json({ error: "The AI could not translate right now. Try again in a moment." }, { status: 502 });
  }
}
