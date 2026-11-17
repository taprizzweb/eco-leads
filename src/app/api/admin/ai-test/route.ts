import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { aiProbe } from "@/lib/review/draft";

// Managers and owners of the Taprizz team can send one test review to the connected writer.
export async function POST() {
  const sb = await supabaseServer();
  const { data: role } = await sb.rpc("my_team_role");
  if (role !== "owner" && role !== "manager") return NextResponse.json({ error: "Only managers and owners can run this test." }, { status: 403 });
  return NextResponse.json(await aiProbe());
}
