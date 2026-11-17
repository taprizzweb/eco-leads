import { loadClient } from "@/lib/dash";
import { ReviewsBoard } from "@/components/dash/ReviewsBoard";

export default async function ReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await loadClient(slug);
  const monthStart = (() => { const [y, m] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-"); return new Date(`${y}-${m}-01T00:00:00+05:30`).toISOString(); })();
  const head = { count: "exact" as const, head: true };
  const [reviews, drafts, made, copied, plates] = await Promise.all([
    sb.from("google_reviews").select("id, author, rating, body, reply_draft, replied_at, show_on_page, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(100),
    sb.from("review_drafts").select("id, rating, answers, draft, copied, plate_code, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(40),
    sb.from("review_drafts").select("id", head).eq("client_id", client.id).gte("created_at", monthStart),
    sb.from("review_drafts").select("id", head).eq("client_id", client.id).eq("copied", true).gte("created_at", monthStart),
    sb.from("plates").select("code, label").eq("client_id", client.id),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-[30px] leading-tight font-semibold tracking-[-0.04em]">Reviews</h1>
      <p className="mb-6" style={{ color: "var(--d-muted)" }}>Reply to your Google reviews, and see what guests wrote with Taprizz.</p>
      <ReviewsBoard
        clientId={client.id}
        reviews={(reviews.data ?? []) as never}
        drafts={(drafts.data ?? []) as never}
        stats={{ drafts: made.count ?? 0, copied: copied.count ?? 0 }}
        replyMode={String(features.review_replies ?? "copy")}
        labels={Object.fromEntries((plates.data ?? []).map((p) => [p.code, p.label ?? p.code]))}
      />
    </div>
  );
}
