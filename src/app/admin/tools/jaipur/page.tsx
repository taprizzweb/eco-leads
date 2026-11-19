import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { HubAdmin, type AdminOffer, type AdminSponsor, type AdminClient, type AdminArea } from "@/components/admin/HubAdmin";

export default async function JaipurAdminPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const [offers, sponsors, clients, areas] = await Promise.all([
    sb.from("hub_offers").select("id, client_id, kind, title, details, starts_on, ends_on, follow_first, status, admin_note, created_at, clients(name)").order("created_at", { ascending: false }).limit(200),
    sb.from("hub_sponsors").select("id, offer_id, area, starts_on, ends_on, hub_offers(title, clients(name))").order("created_at", { ascending: false }).limit(100),
    sb.from("clients").select("id, name, slug, hub_listed, hub_area").order("name").limit(500),
    sb.from("hub_areas").select("id, name, sort, active").order("sort").order("name"),
  ]);
  return (
    <>
      <PageHead title="Jaipur page" sub="Kaun listed hai, kaun si offers chalengi, aur sponsored jagah. Ranking apne aap banti hai, usse yahan se badla nahi ja sakta." />
      <HubAdmin offers={(offers.data ?? []) as unknown as AdminOffer[]} sponsors={(sponsors.data ?? []) as unknown as AdminSponsor[]} clients={(clients.data ?? []) as AdminClient[]} areas={(areas.data ?? []) as AdminArea[]} />
    </>
  );
}
