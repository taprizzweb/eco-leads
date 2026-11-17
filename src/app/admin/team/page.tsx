import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { TeamAdmin } from "@/components/admin/TeamAdmin";
import { PageHead } from "@/components/admin/ui";

export default async function TeamPage() {
  const { sb, role, user } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const [{ data: members }, { data: invites }] = await Promise.all([
    sb.rpc("admin_team_list"),
    sb.from("invites").select("id, email, team_role, created_at").eq("kind", "team").is("claimed_at", null).order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHead title="Team" sub="Your reps and developers. Roles: Owner, Manager, Rep." />
      <TeamAdmin members={(members ?? []) as never} invites={(invites ?? []) as never} me={user.id} canEdit={role === "owner"} />
    </>
  );
}
