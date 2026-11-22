import { Lock } from "lucide-react";
import { loadClient } from "@/lib/dash";
import { TablesBoard } from "@/components/dash/TablesBoard";
import { tablesFit } from "@/lib/features";
import { isTablePlate } from "@/lib/pos";

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
  if (features.pos === true) {
    // With food orders on, every table plate opens the Taprizz menu by itself. Nothing to set up per table.
    const { data: plates } = await sb.from("plates").select("code, label").eq("client_id", client.id).eq("active", true).order("created_at");
    const list = (plates ?? []) as { code: string; label: string | null }[];
    const tables = list.filter((p) => isTablePlate(p.label));
    const others = list.filter((p) => !isTablePlate(p.label));
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Tables</h1>
          <p className="mt-1" style={{ color: "var(--d-muted)" }}>Every table plate opens your Taprizz menu with its own table number, so orders and requests reach <a className="underline" href={`/pos/${client.slug}`}>Food orders</a> with the table named. You do not set anything up per table. Taprizz adds a table plate with its number and it works.</p>
        </div>
        <section className="d-card p-4">
          <h2 className="font-semibold">{tables.length} table{tables.length === 1 ? "" : "s"} with the menu</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tables.map((p) => <li key={p.code}><a href={`/e/${p.code}`} target="_blank" rel="noopener" className="d-btn d-btn-s w-full justify-between">{p.label}<span className="text-xs" style={{ color: "var(--d-green)" }}>Menu on</span></a></li>)}
            {tables.length === 0 && <li className="col-span-full text-sm" style={{ color: "var(--d-muted)" }}>No table plates yet. Ask Taprizz to add your tables.</li>}
          </ul>
        </section>
        {others.length > 0 && (
          <section className="d-card p-4">
            <h2 className="font-semibold">Other plates ({others.map((p) => p.label ?? "Plate").join(", ")})</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Guests can look at the menu here. Whether they can also order is your choice in <a className="underline" href={`/pos/${client.slug}/settings`}>Food orders, Settings</a>.</p>
          </section>
        )}
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
