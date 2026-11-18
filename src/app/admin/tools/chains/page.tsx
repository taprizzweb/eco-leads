import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { ChainsAdmin, type GroupRow } from "@/components/admin/ChainsAdmin";

export default async function ChainsPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const [{ data: groups }, { data: branches }] = await Promise.all([
    sb.from("groups").select("id, slug, name, logo_url, created_at").order("name"),
    sb.from("clients").select("group_id").not("group_id", "is", null),
  ]);
  const count = new Map<string, number>();
  for (const b of branches ?? []) count.set(b.group_id as string, (count.get(b.group_id as string) ?? 0) + 1);
  const rows = (groups ?? []).map((g) => ({ ...g, branches: count.get(g.id) ?? 0 }));
  return (
    <>
      <PageHead title="Chains" sub="A company with many branches, controlled from one dashboard. Make a group, add its branches, and give its head a login." />
      <ChainsAdmin groups={rows as GroupRow[]} />
    </>
  );
}
