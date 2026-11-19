import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ offerId: z.uuid(), device: z.string().trim().min(8).max(64).optional() });
const hits = new Map<string, number[]>();

// A guest opens an offer after tapping the Instagram button. Best-effort limit per address; the database also caps claims per offer per day.
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  if (recent.length >= 20) return NextResponse.json({ error: "Thodi der baad dobara try karo." }, { status: 429 });
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.clear();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Offer nahi mili." }, { status: 400 });
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("hub_claim", { p_offer: parsed.data.offerId, p_device: parsed.data.device ?? null });
  if (error || !data) {
    const m = error?.message ?? "";
    return NextResponse.json({ error: /not available/i.test(m) ? "Ye offer ab chal nahi rahi." : /too many/i.test(m) ? "Aaj ke liye offers khatam ho gaye. Kal dobara dekho." : "Offer abhi nahi khul paayi. Dobara try karo." }, { status: 400 });
  }
  return NextResponse.json(data);
}
