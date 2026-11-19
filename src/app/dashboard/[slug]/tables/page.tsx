import { Lock } from "lucide-react";
import { loadClient } from "@/lib/dash";
import { TablesBoard } from "@/components/dash/TablesBoard";
import { tablesFit } from "@/lib/features";

export default async function TablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await loadClient(slug);
  if (!tablesFit(client.business_type)) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">Table ordering is for cafes, restaurants and hotels</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Your plates open your guest page with reviews, offers and feedback. There is no table menu to set up.</p>
      </div>
    );
  }
  if (features.table_ordering !== true) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <Lock className="mx-auto" style={{ color: "var(--d-muted)" }} />
        <h1 className="mt-4 text-xl font-semibold">Table ordering links come with the Pro plan</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>With Pro, each table plate opens that table&apos;s own ordering link, so your guests order straight from the table they are sitting at.</p>
      </div>
    );
  }
  const { data } = await sb.from("plates").select("code, label, menu_url").eq("client_id", client.id).order("created_at");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Tables</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Give each table plate the ordering link of that table from your ordering software. When a guest taps View menu on Table 1, Table 1&apos;s link opens, and the order reaches your screen with the table number.</p>
      </div>
      <TablesBoard plates={(data ?? []) as never} />
    </div>
  );
}
