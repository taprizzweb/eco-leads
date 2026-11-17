import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { writeReply } from "@/lib/review/draft";

const Body = z.object({
  clientId: z.uuid(),
  id: z.uuid().optional(),                 // regenerate the reply for a saved review
  author: z.string().trim().max(80).default(""),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(2000),
});

// Owners paste a Google review here and get a suggested reply back. Only members of the business can call it;
// row-level security does the checking because every query below runs as the signed-in person.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add the star rating and the review text first." }, { status: 400 });
  const b = parsed.data;

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { data: client } = await sb.from("clients").select("id, name, business_type").eq("id", b.clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "You do not have access to this business." }, { status: 403 });

  // Cost control: at most 40 new reviews an hour per business.
  if (!b.id) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("google_reviews").select("id", { count: "exact", head: true }).eq("client_id", client.id).gte("created_at", since);
    if ((count ?? 0) >= 40) return NextResponse.json({ error: "That is a lot of reviews in an hour. Please try again shortly." }, { status: 429 });
  }

  const { reply, provider } = await writeReply({ businessName: client.name, businessType: client.business_type, author: b.author, rating: b.rating, text: b.text });

  if (b.id) {
    const { error } = await sb.from("google_reviews").update({ reply_draft: reply, author: b.author || "Guest", rating: b.rating, body: b.text }).eq("id", b.id).eq("client_id", client.id);
    if (error) return NextResponse.json({ error: "The reply could not be saved." }, { status: 500 });
    return NextResponse.json({ id: b.id, reply, provider });
  }
  const { data: row, error } = await sb.from("google_reviews")
    .insert({ client_id: client.id, author: b.author || "Guest", rating: b.rating, body: b.text, reply_draft: reply, show_on_page: false, source: "manual" })
    .select("id").single();
  if (error || !row) return NextResponse.json({ error: "The review could not be saved." }, { status: 500 });
  return NextResponse.json({ id: row.id, reply, provider });
}
