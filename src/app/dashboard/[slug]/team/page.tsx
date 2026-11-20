import { loadClient } from "@/lib/dash";
import { ExtrasBoard } from "@/components/dash/ExtrasBoard";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const [staff, posters, thanks] = await Promise.all([
    sb.from("staff").select("id, name, photo_url, active, thanks_total").eq("client_id", client.id).order("sort").order("created_at"),
    sb.from("posters").select("id, image_url, caption, active").eq("client_id", client.id).order("sort").order("created_at"),
    sb.from("staff_thanks").select("id, staff_id, note, created_at").eq("client_id", client.id).not("note", "is", null).order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Staff and new posters</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Add your team so guests can thank them or report a problem. Add posters for the red New button on your guest page.</p>
      </div>
      <ExtrasBoard clientId={client.id} staff={(staff.data ?? []) as never} posters={(posters.data ?? []) as never} thanks={(thanks.data ?? []) as never} />
    </div>
  );
}
