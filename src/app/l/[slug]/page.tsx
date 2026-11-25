import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { LinkPage } from "@/components/link/LinkPage";
import type { LinkData } from "@/lib/linkpage";
import { linkDescription, linkJsonLd, linkTitle } from "@/lib/link-seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, preview: string | boolean): Promise<LinkData | null> {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("public_link_page", { p_slug: slug });
  if (data) return data as LinkData;
  if (!preview) return null;
  // The owner of a page that is not live yet sees it through their private control link.
  if (typeof preview === "string" && /^[a-f0-9]{64}$/.test(preview)) {
    const { data: own } = await sb.rpc("link_edit_load", { p_token: preview });
    return own && (own as { slug?: string }).slug === slug.toLowerCase() ? (own as unknown as LinkData) : null;
  }
  if (preview !== true && preview !== "1") return null;
  // The Taprizz team may preview a page that is not published yet (the table is closed to everyone else).
  const { data: row } = await sb.from("link_pages").select("id, slug, name, tagline, logo_url, theme, colors, seo_keywords, tags, socials, photos, photo_direction, buttons, outlets, offers, reviews").eq("slug", slug.toLowerCase()).maybeSingle();
  return row ? (row as unknown as LinkData) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug, false);
  if (!d) return { title: "Page not found" };
  const title = linkTitle(d), description = linkDescription(d);
  return {
    title, description,
    openGraph: { title, description, type: "website", siteName: d.name, ...(d.logo_url ? { images: [d.logo_url] } : {}) },
    twitter: { card: "summary", title, description, ...(d.logo_url ? { images: [d.logo_url] } : {}) },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const data = await load(slug, preview === "1" ? true : (preview ?? false));
  if (!data) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return (
    <>
      {host && preview !== "1" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: linkJsonLd(data, `https://${host}/l/${data.slug}`) }} />}
      <LinkPage data={data} preview={preview === "1"} />
    </>
  );
}
