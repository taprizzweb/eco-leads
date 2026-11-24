import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOverview } from "@/lib/admin-data";
import { ClientAdmin } from "@/components/admin/ClientAdmin";
import { ClientReviewSetup } from "@/components/admin/ClientReviewSetup";
import { ClientChain } from "@/components/admin/ClientChain";
import { PageHead } from "@/components/admin/ui";

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, role, clients, packages } = await loadOverview();
  const base = clients.find((c) => c.slug === slug);
  if (!base) notFound();
  const [plates, members, invites, audit, cats, setupRow, groupsQ] = await Promise.all([
    sb.from("plates").select("code, label, active, menu_url, redirect_url").eq("client_id", base.id).order("created_at"),
    sb.rpc("admin_client_members", { p_client: base.id }),
    sb.from("invites").select("id, email, created_at").eq("client_id", base.id).is("claimed_at", null).order("created_at", { ascending: false }),
    sb.from("audit_log").select("id, action, created_at").eq("client_id", base.id).order("created_at", { ascending: false }).limit(12),
    sb.from("business_templates").select("id, label, questions").order("sort"),
    sb.from("clients").select("review_setup, business_type, group_id").eq("id", base.id).single(),
    sb.from("groups").select("id, name, slug").order("name"),
  ]);
  const groups = (groupsQ.data ?? []) as { id: string; name: string; slug: string }[];
  const current = groups.find((g) => g.id === setupRow.data?.group_id) ?? null;
  return (
    <>
      <PageHead title={base.name} sub={`taprizz.in/e/${base.slug}`}>
        <Link href={`/dashboard/${base.slug}`} className="d-btn d-btn-s">View as client</Link>
        {role !== "rep" && <Link href={`/admin/clients/new?from=${base.slug}`} className="d-btn d-btn-s">Duplicate client</Link>}
        <a href={`/e/${base.slug}`} target="_blank" rel="noopener" className="d-btn d-btn-s">Open guest page</a>
      </PageHead>
      <ClientAdmin
        client={base}
        packages={packages}
        plates={plates.data ?? []}
        members={(members.data ?? []) as { user_id: string; email: string; role: string }[]}
        invites={invites.data ?? []}
        audit={audit.data ?? []}
        role={role}
      />
      {role !== "rep" && (
        <div className="mt-4 max-w-4xl"><ClientChain clientId={base.id} clientName={base.name} current={current} groups={groups} /></div>
      )}
      <div className="mt-4 max-w-4xl">
        <ClientReviewSetup
          key={JSON.stringify(setupRow.data)}
          clientId={base.id}
          clientName={base.name}
          category={setupRow.data?.business_type ?? null}
          setup={(setupRow.data?.review_setup ?? {}) as never}
          categories={(cats.data ?? []) as never}
        />
      </div>
    </>
  );
}
