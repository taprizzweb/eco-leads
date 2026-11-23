import { requireSection } from "@/lib/dash";
import { AnnouncementsBoard } from "@/components/dash/AnnouncementsBoard";

export default async function AnnouncePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await requireSection(slug, "announce");
  const { data } = await sb.from("offers").select("id, title, details, starts_at, ends_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(60);
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Announcements</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Offers you announce here run in the moving strip on your guest page and on your mini link, and they disappear on their end date. This is not the WhatsApp message to guests.</p>
      </div>
      <AnnouncementsBoard clientId={client.id} initial={(data ?? []) as never} today={today} />
    </div>
  );
}
