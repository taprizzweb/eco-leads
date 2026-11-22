import { loadClient } from "@/lib/dash";
import { PosShell } from "@/components/pos/PosShell";

export const dynamic = "force-dynamic";

export default async function PosLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await loadClient(slug);
  if (features.pos !== true) {
    return (
      <PosShell slug={client.slug} clientName={client.name}>
        <div className="d-card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold">Food orders are not switched on</h1>
          <p className="mt-2" style={{ color: "var(--d-muted)" }}>When it is on, guests open your menu from the table QR, order from their phone, and you see every order, table request and chat here live. Ask Taprizz to switch it on.</p>
        </div>
      </PosShell>
    );
  }
  const { data: threads } = await sb.from("chat_threads").select("unread_staff").eq("client_id", client.id).gt("unread_staff", 0).limit(100);
  return <PosShell slug={client.slug} clientName={client.name} chatUnread={(threads ?? []).length}>{children}</PosShell>;
}
