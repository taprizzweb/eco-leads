import Link from "next/link";
import { Lock } from "lucide-react";
import { loadClient } from "@/lib/dash";
import { ContentBoard } from "@/components/dash/ContentBoard";
import { CreatorSetup } from "@/components/dash/CreatorSetup";
import type { CreatorSettings } from "@/lib/creators";

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await loadClient(slug);
  if (!features.creators) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <Lock className="mx-auto" style={{ color: "var(--d-muted)" }} />
        <h1 className="mt-4 text-xl font-semibold">Creators corner comes with Premium</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Local Instagram creators visit, post about you and send you their reels, with approvals, visit codes and a monthly cap so food cost stays safe.</p>
        <Link href={`/dashboard/${slug}/plan`} className="d-btn d-btn-p mt-6">See plans</Link>
      </div>
    );
  }
  const settings = (client.creator_settings ?? {}) as CreatorSettings;
  const monthStart = (() => { const [y, m] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-"); return new Date(`${y}-${m}-01T00:00:00+05:30`).toISOString(); })();
  const [reqs, posts, used] = await Promise.all([
    sb.from("creator_requests").select("id, name, handle, followers_range, city, phone, plan, preferred_day, always_welcome, status, visit_code, approved_at, redeemed_at, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(200),
    sb.from("creator_posts").select("id, request_id, handle, post_url, media_path, status, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(100),
    sb.from("creator_requests").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "approved").gte("approved_at", monthStart),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Content</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Creators who want to collab with you, and the posts they send back.</p>
      </div>
      <ContentBoard businessName={client.name} barter={settings.barter ?? ""} cap={settings.monthly_cap ?? 8} usedThisMonth={used.count ?? 0} requests={(reqs.data ?? []) as never} posts={(posts.data ?? []) as never} />
      <CreatorSetup clientId={client.id} businessType={client.business_type} initial={settings} />
    </div>
  );
}
