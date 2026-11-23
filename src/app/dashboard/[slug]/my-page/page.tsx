import { requireSection } from "@/lib/dash";
import Link from "next/link";
import { PageEditor } from "@/components/dash/PageEditor";

export default async function MyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await requireSection(slug, "mypage");
  const [gallery, offers, events, links, tpl] = await Promise.all([
    sb.from("gallery_photos").select("id, url, label, caption, sort").eq("client_id", client.id).order("sort"),
    sb.from("offers").select("id, title, details, starts_at, ends_at, claimable").eq("client_id", client.id).order("created_at", { ascending: false }),
    sb.from("events").select("id, title, details, starts_at").eq("client_id", client.id).order("starts_at"),
    sb.from("client_links").select("id, label, url, sort").eq("client_id", client.id).order("sort").order("created_at"),
    client.business_type ? sb.from("business_templates").select("review_chips, card_copy, keywords, tagline").eq("id", client.business_type).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
    <Link href={`/dashboard/${slug}/team`} className="d-btn d-btn-s mb-4 inline-flex">Staff and new posters</Link>
    <PageEditor
      client={client}
      features={features}
      template={tpl.data as { review_chips: string[]; card_copy: Record<string, { title?: string; help?: string }>; keywords: string[]; tagline: string | null } | null}
      initialGallery={gallery.data ?? []}
      initialOffers={offers.data ?? []}
      initialEvents={events.data ?? []}
      initialLinks={links.data ?? []}
    />
    </>
  );
}
