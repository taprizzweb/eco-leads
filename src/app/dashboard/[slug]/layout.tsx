import { loadClient } from "@/lib/dash";
import { Shell } from "@/components/dash/Shell";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const { count } = await sb.from("feedback").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "new");
  return (
    <Shell slug={client.slug} clientName={client.name} logoUrl={client.logo_url} openCount={count ?? 0}>
      {children}
    </Shell>
  );
}
