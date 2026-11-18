import { loadClient } from "@/lib/dash";
import { Shell } from "@/components/dash/Shell";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const { data: teamRole } = await sb.rpc("my_team_role");
  const { data: pendingMoments } = await sb.from("moments").select("group_id, id").eq("client_id", client.id).eq("status", "pending").limit(500);
  const newMoments = new Set((pendingMoments ?? []).map((m) => m.group_id ?? m.id)).size;
  const { count } = await sb.from("feedback").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "new");
  return (
    <Shell slug={client.slug} clientName={client.name} logoUrl={client.logo_url} openCount={count ?? 0} contentCount={newMoments} isTeam={!!teamRole}>
      {children}
    </Shell>
  );
}
