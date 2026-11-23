import { redirect } from "next/navigation";
import { requireSection } from "@/lib/dash";
import { HUB_ENABLED } from "@/lib/hub-shared";
import { JaipurBoard, type MyOffer } from "@/components/dash/JaipurBoard";
import { HubLocation } from "@/components/dash/HubLocation";
import { can } from "@/lib/roles";

export default async function JaipurPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!HUB_ENABLED) redirect(`/dashboard/${slug}`);
  const { sb, client, role } = await requireSection(slug, "jaipur");
  const { data: row } = await sb.from("clients").select("hub_listed, hub_area, business_type").eq("id", client.id).single();
  const listed = row?.hub_listed === true;
  if (!listed) return <JaipurBoard clientId={client.id} slug={client.slug} areaId={null} listed={false} areaName={null} categoryLabel={null} rank={null} total={0} rating={0} guests={0} stats={{ views: 0, follows: 0, claims: 0, redeems: 0 }} offers={[]} hasInstagram={false} />;
  const since = new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [{ data: offers }, { data: place }, area, cat] = await Promise.all([
    sb.from("hub_offers").select("id, kind, title, details, starts_on, ends_on, follow_first, status, admin_note").eq("client_id", client.id).order("created_at", { ascending: false }).limit(30),
    sb.rpc("hub_place", { p_slug: client.slug }),
    row?.hub_area ? sb.from("hub_areas").select("name").eq("id", row.hub_area).maybeSingle() : Promise.resolve({ data: null }),
    row?.business_type ? sb.from("business_templates").select("label").eq("id", row.business_type).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ids = (offers ?? []).map((o) => o.id);
  const { data: counts } = ids.length ? await sb.from("hub_counts").select("kind, n").in("offer_id", ids).gte("day", since) : { data: [] };
  const sum = (k: string) => (counts ?? []).filter((c) => c.kind === k).reduce((a, c) => a + (c.n as number), 0);
  const p = (place ?? null) as { rank: number | null; total: number; rating: number; guests: number } | null;
  const insta = typeof client.socials?.instagram === "string" && /^https:\/\//.test(client.socials.instagram);
  const { data: geo } = await sb.from("clients").select("hub_lat, hub_lng, hub_terms").eq("id", client.id).single();
  const g = (geo ?? {}) as { hub_lat: number | null; hub_lng: number | null; hub_terms: string | null };
  const { data: rivals } = g.hub_lat != null && g.hub_lng != null ? await sb.rpc("hub_nearby_places", { p_lat: g.hub_lat, p_lng: g.hub_lng, p_radius_km: 5, p_exclude: client.slug, p_cat: row?.business_type ?? null }) : { data: [] };
  return (
    <div className="space-y-6">
      <HubLocation clientId={client.id} lat={g.hub_lat} lng={g.hub_lng} terms={g.hub_terms} rivals={(Array.isArray(rivals) ? rivals : []) as never} canEdit={can(role, "access")} />
    <JaipurBoard
      clientId={client.id} slug={client.slug} areaId={row?.hub_area ?? null} listed areaName={(area.data as { name: string } | null)?.name ?? null} categoryLabel={(cat.data as { label: string } | null)?.label ?? null}
      rank={p?.rank ?? null} total={p?.total ?? 0} rating={Number(p?.rating ?? 0)} guests={p?.guests ?? 0}
      stats={{ views: sum("view"), follows: sum("follow"), claims: sum("claim"), redeems: sum("redeem") }}
      offers={(offers ?? []) as MyOffer[]} hasInstagram={insta}
    />
    </div>
  );
}
