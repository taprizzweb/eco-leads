import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

export type TeamRole = "owner" | "manager" | "rep";
const RANK: Record<TeamRole, number> = { rep: 1, manager: 2, owner: 3 };
export const atLeast = (role: TeamRole, min: TeamRole) => RANK[role] >= RANK[min];

// Only Taprizz team members get in. Everyone else is sent to their own dashboard.
export const requireTeam = cache(async () => {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: role } = await sb.rpc("my_team_role");
  if (!role) redirect("/dashboard?not-admin=1");
  return { sb, user, role: role as TeamRole };
});
