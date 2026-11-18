import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// Where the installed app opens: the admin for the owner, the dashboard for a business, the login for everyone else.
export const dynamic = "force-dynamic";
export const metadata = { title: "Taprizz", robots: { index: false } };

export default async function AppEntry() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await sb.rpc("my_team_role");
  redirect(role ? "/admin" : "/dashboard");
}
