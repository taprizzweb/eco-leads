import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { ChainEditor, type Branch, type Head } from "@/components/admin/ChainEditor";

export default async function ChainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { data: group } = await sb.from("groups").select("id, slug, name, logo_url").eq("id", id).maybeSingle();
  if (!group) notFound();
  const [{ data: branches }, { data: invites }] = await Promise.all([
    sb.from("clients").select("id, name, slug, status").eq("group_id", id).order("name"),
    sb.from("invites").select("id, email, claimed_at, claimed_by, created_at").eq("kind", "group").eq("group_id", id).order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHead title={group.name} sub="Edit the chain, its branches and who can open it." />
      <ChainEditor group={group} branches={(branches ?? []) as Branch[]} heads={(invites ?? []) as Head[]} />
    </>
  );
}
