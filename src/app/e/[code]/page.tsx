import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GuestPage } from "@/components/guest/GuestPage";
import type { GuestPageData } from "@/lib/types";

// Plates point to taprizz.in/e/<code>. The code never changes once printed;
// the admin reassigns which client and table it belongs to.
export const dynamic = "force-dynamic";

async function load(code: string) {
  if (!/^[a-zA-Z0-9-]{3,40}$/.test(code)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("guest_page", { p_code: code });
  return data as GuestPageData | null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const d = await load(code);
  if (!d) return { title: "Taprizz" };
  return {
    title: d.client.name,
    description: d.client.tagline ?? `Review, share and see offers at ${d.client.name}`,
    robots: { index: false },
  };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await load(code);
  if (!data) notFound();

  const sb = await supabaseServer();
  after(async () => {
    await sb.rpc("guest_log_tap", { p_client: data.client.id, p_code: data.plate?.code ?? null });
  });

  return <GuestPage data={data} code={code} />;
}
