import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import type { GuestPageData } from "@/lib/types";
import { MenuApp, type MenuData } from "@/components/menu/MenuApp";

// The guest's online menu and ordering page. Reached from the "View menu" card on the table QR page.
export const dynamic = "force-dynamic";

async function load(code: string) {
  if (!/^[a-zA-Z0-9-]{3,40}$/.test(code)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("guest_page", { p_code: code });
  const page = data as GuestPageData | null;
  if (!page) return null;
  const { data: menu } = await sb.rpc("guest_menu", { p_client: page.client.id });
  return { page, menu: menu as MenuData | null };
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const d = await load(code);
  return { title: d ? `${d.page.client.name} · Menu` : "Menu", robots: { index: false } };
}

export default async function MenuPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = await load(code);
  if (!d) notFound();
  // Ordering switched off or paused: send the guest back to the normal page, never a dead end.
  if (!d.menu || !d.page.plate) redirect(`/e/${code}`);
  return <MenuApp data={d.page} menu={d.menu} code={code} />;
}
