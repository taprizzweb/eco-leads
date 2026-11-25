import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { MiniAdmin, type MiniOverview } from "@/components/admin/MiniAdmin";

export const dynamic = "force-dynamic";

export default async function MiniPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { data } = await sb.rpc("mini_admin_overview");
  return (
    <>
      <PageHead title="Mini Link sign-ups" sub="People who built their own mini link. Check each Rs 150 payment against your bank before you approve." />
      <MiniAdmin data={(data ?? { payments: [], pages: [], reports: [], settings: {} }) as MiniOverview} />
    </>
  );
}
