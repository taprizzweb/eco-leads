import { loadClient } from "@/lib/dash";
import { InboxBoard, type Item } from "@/components/dash/InboxBoard";

export default async function InboxPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ open?: string }> }) {
  const { slug } = await params;
  const { open } = await searchParams;
  const { sb, client, features } = await loadClient(slug);
  const [{ data }, { data: plates }] = await Promise.all([
    sb.from("feedback")
      .select("id, kind, body, media_paths, contact_name, contact_phone, contact_consent, status, private_note, plate_code, created_at, resolved_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(300),
    sb.from("plates").select("code, label").eq("client_id", client.id),
  ]);
  const labels = Object.fromEntries((plates ?? []).map((p) => [p.code, p.label ?? p.code]));
  const enabled = !!features.complaints || !!features.suggestions;
  return <InboxBoard initial={(data ?? []) as Item[]} labels={labels} openId={open ?? null} enabled={enabled} slug={slug} />;
}
