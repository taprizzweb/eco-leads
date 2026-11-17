import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const parsed = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const sb = await supabaseServer();
  await sb.rpc("guest_mark_copied", { p_id: parsed.data.id });
  return NextResponse.json({ ok: true });
}
