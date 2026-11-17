import { loadOverview } from "@/lib/admin-data";
import { PlatesAdmin } from "@/components/admin/PlatesAdmin";
import { PageHead } from "@/components/admin/ui";

export default async function PlatesPage() {
  const { sb, role, clients } = await loadOverview();
  const { data: plates } = await sb.from("plates").select("code, label, active, client_id").order("created_at", { ascending: false });
  return (
    <>
      <PageHead title="Plates and QR links" sub="Every NFC plate and QR code points to taprizz.in/e/<code>. A code never changes; you can move it to another client or table." />
      <PlatesAdmin plates={plates ?? []} clients={clients.map((c) => ({ id: c.id, name: c.name }))} canManage={role !== "rep"} />
    </>
  );
}
