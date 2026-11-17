import { loadOverview } from "@/lib/admin-data";
import { NewClientForm } from "@/components/admin/NewClientForm";
import { PageHead } from "@/components/admin/ui";

export default async function NewClient() {
  const { sb, packages } = await loadOverview();
  const { data: templates } = await sb.from("business_templates").select("id, label").order("sort");
  return (
    <>
      <PageHead title="Add client" sub="Name, type and Google link. The business type fills the page wording, review chips and sample offers for you." />
      <NewClientForm templates={templates ?? []} packages={packages.map((p) => ({ id: p.id, name: p.name, price_inr: p.price_inr }))} />
    </>
  );
}
