import { requireSection } from "@/lib/dash";
import { PosSettingsForm } from "@/components/pos/PosSettingsForm";
import type { PosSettings } from "@/lib/pos";

export default async function PosSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await requireSection(slug, "pos-settings");
  const { data } = await sb.from("pos_settings").select("*").eq("client_id", client.id).maybeSingle();
  const initial: PosSettings = (data as PosSettings | null) ?? { client_id: client.id, accepting: true, gst_rate: 5, gst_inclusive: false, gstin: null, legal_name: client.name, address: null, bill_footer: null, geo_lat: null, geo_lng: null, geo_radius_m: 150, geo_required: false, counter_orders: true };
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Settings</h1>
      <PosSettingsForm initial={initial} />
    </div>
  );
}
