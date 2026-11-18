import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { LinkPage } from "@/components/link/LinkPage";
import type { LinkData } from "@/lib/linkpage";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, preview: boolean): Promise<LinkData | null> {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("public_link_page", { p_slug: slug });
  if (data) return data as LinkData;
  if (!preview) return null;
  // The Taprizz team may preview a page that is not published yet (the table is closed to everyone else).
  const { data: row } = await sb.from("link_pages").select("id, slug, name, tagline, logo_url, theme, tags, socials, photos, buttons, outlets, reviews").eq("slug", slug.toLowerCase()).maybeSingle();
  return row ? (row as unknown as LinkData) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug, false);
  return d ? { title: d.name, description: d.tagline ?? `${d.name} on Taprizz` } : { title: "Page not found" };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const data = await load(slug, preview === "1");
  if (!data) notFound();
  return <LinkPage data={data} preview={preview === "1"} />;
}
