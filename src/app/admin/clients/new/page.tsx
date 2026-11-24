import { loadOverview } from "@/lib/admin-data";
import { NewClientForm } from "@/components/admin/NewClientForm";
import { PageHead } from "@/components/admin/ui";

export default async function NewClient({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const { sb, packages } = await loadOverview();
  const { data: templates } = await sb.from("business_templates").select("id, label").order("sort");
  const { data: src } = from ? await sb.from("clients").select("id, name, business_type, package_id").eq("slug", from).maybeSingle() : { data: null };
  return (
    <>
      <PageHead title={src ? `Duplicate ${src.name}` : "Add client"} sub={src ? "A new business with the same setup. Give it its own name, link and Google review link, and choose what to copy." : "Name, type and Google link. The business type fills the page wording, review chips and sample offers for you."} />
      <NewClientForm templates={templates ?? []} packages={packages.map((p) => ({ id: p.id, name: p.name, price_inr: p.price_inr }))} copyFrom={src ? { id: src.id, name: src.name, type: src.business_type ?? "", pkg: src.package_id } : undefined} />
    </>
  );
}
