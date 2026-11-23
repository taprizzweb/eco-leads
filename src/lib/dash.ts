import { notFound } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { can, toRole, type Role, type Section } from "@/lib/roles";
import { redirect } from "next/navigation";

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
  creator_settings: Record<string, unknown>;
  review_setup: Record<string, unknown> | null;
  package_id: string;
  status: "active" | "paused";
  expires_at: string | null;
};

// RLS decides access: a non-member simply gets no row and sees a 404.
export const loadClient = cache(async (slug: string) => {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("clients")
    .select("id, slug, name, tagline, logo_url, google_review_url, menu_url, theme, socials, keywords, card_config, business_type, creator_settings, review_setup, package_id, status, expires_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  const [{ data: features }, { data: roleRaw }] = await Promise.all([sb.rpc("client_features", { cid: data.id }), sb.rpc("my_client_role", { cid: data.id })]);
  return { sb, client: data as DashClient, features: (features ?? {}) as Record<string, unknown>, role: toRole(roleRaw) };
});

export { timeAgo } from "./dash-time";

/** Pages call this first. A person whose role does not include the page is sent to the page that is theirs. */
export async function requireSection(slug: string, section: Section) {
  const ctx = await loadClient(slug);
  if (!can(ctx.role, section)) redirect(can(ctx.role, "pos") && ctx.features.pos === true ? `/pos/${slug}` : can(ctx.role, "calls") ? `/dashboard/${slug}/calls` : "/dashboard");
  return ctx;
}
export type { Role };
