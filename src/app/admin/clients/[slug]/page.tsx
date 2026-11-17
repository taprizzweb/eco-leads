import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOverview } from "@/lib/admin-data";
import { ClientAdmin } from "@/components/admin/ClientAdmin";
import { PageHead } from "@/components/admin/ui";

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, role, clients, packages } = await loadOverview();
  const base = clients.find((c) => c.slug === slug);
  if (!base) notFound();
  const [plates, members, invites, audit] = await Promise.all([
    sb.from("plates").select("code, label, active").eq("client_id", base.id).order("created_at"),
    sb.rpc("admin_client_members", { p_client: base.id }),
    sb.from("invites").select("id, email, created_at").eq("client_id", base.id).is("claimed_at", null).order("created_at", { ascending: false }),
    sb.from("audit_log").select("id, action, created_at").eq("client_id", base.id).order("created_at", { ascending: false }).limit(12),
  ]);
  return (
    <>
      <PageHead title={base.name} sub={`taprizz.in/e/${base.slug}`}>
        <Link href={`/dashboard/${base.slug}`} className="d-btn d-btn-s">View as client</Link>
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
    </>
  );
}
