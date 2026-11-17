import { notFound } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

export type DashClient = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  google_review_url: string | null;
  menu_url: string | null;
  theme: string;
  socials: Record<string, string>;
  keywords: string[];
  card_config: Record<string, unknown>;
  business_type: string | null;
  package_id: string;
  status: "active" | "paused";
  expires_at: string | null;
};

// RLS decides access: a non-member simply gets no row and sees a 404.
export const loadClient = cache(async (slug: string) => {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("clients")
    .select("id, slug, name, tagline, logo_url, google_review_url, menu_url, theme, socials, keywords, card_config, business_type, package_id, status, expires_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  const { data: features } = await sb.rpc("client_features", { cid: data.id });
  return { sb, client: data as DashClient, features: (features ?? {}) as Record<string, unknown> };
});

export { timeAgo } from "./dash-time";
