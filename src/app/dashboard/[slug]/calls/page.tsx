import { loadClient } from "@/lib/dash";
import { tablesFit } from "@/lib/features";
import { CallsBoard } from "@/components/dash/CallsBoard";

export default async function CallsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await loadClient(slug);
  if (features.call_server !== true || !tablesFit(client.business_type)) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">Call server is not switched on</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>When it is on, a bell appears on your table plates. A guest taps it and the table shows up here. Ask Taprizz to switch it on.</p>
      </div>
    );
  }
  const since = new Date(Date.now() - 12 * 3600e3).toISOString();
  const { data } = await sb.from("server_calls").select("id, label, status, created_at").eq("client_id", client.id).gte("created_at", since).order("created_at", { ascending: false }).limit(60);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Calls</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Tables that tapped the bell. Keep this screen open at the counter. It refreshes every few seconds and beeps for a new call.</p>
      </div>
      <CallsBoard clientId={client.id} initial={(data ?? []) as never} />
    </div>
  );
}
