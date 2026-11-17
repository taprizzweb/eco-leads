import { loadClient } from "@/lib/dash";
import { Shell } from "@/components/dash/Shell";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const { data: teamRole } = await sb.rpc("my_team_role");
  const [{ count: pendingCollabs }, { count: newPosts }] = await Promise.all([
    sb.from("creator_requests").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "pending"),
    sb.from("creator_posts").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "new"),
  ]);
  const { count } = await sb.from("feedback").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "new");
  return (
    <Shell slug={client.slug} clientName={client.name} logoUrl={client.logo_url} openCount={count ?? 0} contentCount={(pendingCollabs ?? 0) + (newPosts ?? 0)} isTeam={!!teamRole}>
      {children}
    </Shell>
  );
}
