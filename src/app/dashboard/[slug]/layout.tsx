import { loadClient } from "@/lib/dash";
import { Shell } from "@/components/dash/Shell";
import { tablesFit } from "@/lib/features";
import { HUB_ENABLED } from "@/lib/hub-shared";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features, role } = await loadClient(slug);
  const { data: teamRole } = await sb.rpc("my_team_role");
  const { data: pendingMoments } = await sb.from("moments").select("group_id, id").eq("client_id", client.id).eq("status", "pending").limit(500);
  const newMoments = new Set((pendingMoments ?? []).map((m) => m.group_id ?? m.id)).size;
  const { data: hubRow } = await sb.from("clients").select("hub_listed, group_id").eq("id", client.id).single();
  // A branch opened from its chain, or a business opened by the team, needs a way back up from its first page.
  const { data: grp } = hubRow?.group_id ? await sb.from("groups").select("slug").eq("id", hubRow.group_id).maybeSingle() : { data: null };
  const upHref = grp?.slug ? `/group/${grp.slug}` : teamRole ? `/admin/clients/${client.slug}` : undefined;
  const { count } = await sb.from("feedback").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "new");
  const callsOn = features.call_server === true && tablesFit(client.business_type);
  const { count: callsOpen } = callsOn ? await sb.from("server_calls").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "new") : { count: 0 };
  return (
    <Shell clientId={client.id} slug={client.slug} clientName={client.name} logoUrl={client.logo_url} openCount={count ?? 0} contentCount={newMoments} isTeam={!!teamRole} waOn={client.review_setup?.collect_contact === true} tablesOn={(features.table_ordering === true || features.pos === true) && tablesFit(client.business_type)} jaipurOn={HUB_ENABLED && hubRow?.hub_listed === true} upHref={upHref} callsOn={callsOn} callsOpen={callsOpen ?? 0} posOn={features.pos === true} role={role}>
      {children}
    </Shell>
  );
}
