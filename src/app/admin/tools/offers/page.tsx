import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { OffersAdmin, type Req } from "@/components/admin/OffersAdmin";

export default async function OffersToolPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { data } = await sb.from("wa_requests").select("id, client_id, message, image_url, audience_kind, audience_days, status, admin_note, recipient_count, created_at, sender, clients(name, slug)").order("created_at", { ascending: false }).limit(100);
  const reqs = (data ?? []).map((r) => { const c = (r as unknown as { clients: { name: string; slug: string } | null }).clients; return { ...r, clients: undefined, business: c?.name ?? "Unknown", slug: c?.slug ?? "" }; });
  return (
    <>
      <PageHead title="WhatsApp Offers" sub="Offer requests from owners. Nothing is sent until you approve it." />
      <OffersAdmin initial={reqs as unknown as Req[]} />
    </>
  );
}
