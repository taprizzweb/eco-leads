import { Lock } from "lucide-react";
import { loadClient } from "@/lib/dash";
import { OfferRequest, type MyReq } from "@/components/dash/OfferRequest";

export default async function OffersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const on = client.review_setup?.collect_contact === true;
  if (!on) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <Lock className="mx-auto" style={{ color: "var(--d-muted)" }} />
        <h1 className="mt-4 text-xl font-semibold">WhatsApp offers are not switched on</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Ask the Taprizz team to turn on WhatsApp offers for {client.name}. Then guests are asked for their name and number once, and you can send offers to them from here.</p>
      </div>
    );
  }
  const { data } = await sb.from("wa_requests").select("id, message, image_url, audience_kind, audience_days, status, admin_note, recipient_count, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(50);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Send an offer</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Write your offer and add a poster. Taprizz checks it and sends it to your customers on WhatsApp.</p>
      </div>
      <OfferRequest clientId={client.id} businessName={client.name} initial={(data ?? []) as MyReq[]} />
    </div>
  );
}
