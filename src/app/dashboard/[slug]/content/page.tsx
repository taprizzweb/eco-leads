import Link from "next/link";
import { Lock } from "lucide-react";
import { requireSection } from "@/lib/dash";
import { MomentsBoard, type Moment } from "@/components/dash/MomentsBoard";

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await requireSection(slug, "moments");
  if (!features.creators) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <Lock className="mx-auto" style={{ color: "var(--d-muted)" }} />
        <h1 className="mt-4 text-xl font-semibold">Creators corner comes with Premium</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Guests tag your Instagram, follow you, and send you their best photos and clips with a caption, ready for you to post.</p>
        <Link href={`/dashboard/${slug}/plan`} className="d-btn d-btn-p mt-6">See plans</Link>
      </div>
    );
  }
  const { data } = await sb.from("moments").select("id, group_id, media_path, caption, instagram_handle, status, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(300);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Guest moments</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Photos and clips your guests send from the Creators corner, with the caption they want and their Instagram username. Post them to your story or feed.</p>
      </div>
      <MomentsBoard moments={(data ?? []) as Moment[]} instagram={client.socials?.instagram ?? null} />
    </div>
  );
}
