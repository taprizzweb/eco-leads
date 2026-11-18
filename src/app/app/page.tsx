import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Where the installed app opens: the screen it was left on, otherwise the admin for the owner,
// the dashboard for a business, the login for everyone else.
export const dynamic = "force-dynamic";
export const metadata = { title: "Taprizz", robots: { index: false } };

export default async function AppEntry() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await sb.rpc("my_team_role");
  const jar = await cookies();
  const last = safeNext(decodeURIComponent(jar.get("tz_last")?.value ?? ""), "");
  // Only go back to a screen this person may open: the admin only for the owner, the rest for anyone signed in.
  if (last && /^\/(dashboard|group)(\/|$)/.test(last)) redirect(last);
  if (last && /^\/admin(\/|$)/.test(last) && role === "owner") redirect(last);
  redirect(role ? "/admin" : "/dashboard");
}
