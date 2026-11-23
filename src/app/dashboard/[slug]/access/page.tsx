import { requireSection } from "@/lib/dash";
import { AccessBoard } from "@/components/dash/AccessBoard";

export default async function AccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, role } = await requireSection(slug, "access");
  const { data } = await sb.rpc("client_access_list", { p_client: client.id });
  const d = (data ?? { members: [], invites: [] }) as { members: never[]; invites: never[] };
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Team access</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Give your manager, reception and waiters their own sign in, each with only the screens they need. For several outlets together, use the chain view.</p>
      </div>
      <AccessBoard clientId={client.id} me={role} initialMembers={d.members} initialInvites={d.invites} />
    </div>
  );
}
