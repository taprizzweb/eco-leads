import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ offerId: z.uuid(), kind: z.enum(["view", "follow"]) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const sb = await supabaseServer();
  await sb.rpc("hub_track", { p_offer: parsed.data.offerId, p_kind: parsed.data.kind });
  return NextResponse.json({ ok: true });
}
