import { loadOverview } from "@/lib/admin-data";
import { PackagesAdmin } from "@/components/admin/PackagesAdmin";
import { PageHead } from "@/components/admin/ui";

export default async function PackagesPage() {
  const { role, packages, clients } = await loadOverview();
  const counts: Record<string, number> = {};
  for (const c of clients) counts[c.package_id] = (counts[c.package_id] ?? 0) + 1;
  return (
    <>
      <PageHead title="Packages" sub="A package is only a preset of switches. Edit the prices and what each plan unlocks here; a change applies to every client on that package straight away." />
      <PackagesAdmin packages={packages} counts={counts} canEdit={role !== "rep"} />
    </>
  );
}
