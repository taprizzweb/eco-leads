import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { LinkManager } from "@/components/link/LinkManager";
import { ContactList } from "@/components/link/ContactList";
import { LinkControl } from "@/components/admin/LinkControl";

export default async function LinkEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { data } = await sb.from("link_pages").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const { data: client } = data.client_id ? await sb.from("clients").select("name").eq("id", data.client_id).maybeSingle() : { data: null };
  const { data: contacts } = await sb.rpc("link_contacts_list", { p_id: id, p_limit: 100 });
  return (
    <>
      <PageHead title={data.name} sub="Edit the page. Press Save to see changes in the preview." />
      <div className="mb-4"><LinkControl name={data.name} slug={data.slug} linkId={data.id} initialToken={data.edit_token ?? null} initialEnabled={data.edit_enabled !== false} /></div>
      <ContactList rows={(contacts ?? []) as Parameters<typeof ContactList>[0]["rows"]} />
      <LinkManager initial={data as never} clientName={client?.name ?? null} mode="admin" />
    </>
  );
}
