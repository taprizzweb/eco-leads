import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { LinkEditor } from "@/components/admin/LinkEditor";

export default async function LinkEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { data } = await sb.from("link_pages").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const { data: client } = data.client_id ? await sb.from("clients").select("name").eq("id", data.client_id).maybeSingle() : { data: null };
  return (
    <>
      <PageHead title={data.name} sub="Edit the page. Press Save to see changes in the preview." />
      <LinkEditor initial={data as never} clientName={client?.name ?? null} />
    </>
  );
}
