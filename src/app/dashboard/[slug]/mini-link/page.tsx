import { requireSection } from "@/lib/dash";
import { LinkManager } from "@/components/link/LinkManager";
import { LINK_BASE } from "@/lib/features";

export default async function MiniLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await requireSection(slug, "mypage", "minilink");
  const { data } = await sb.rpc("link_my_page", { p_client: client.id });
  if (!data) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">No mini link yet</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>A mini link is one page for your Instagram bio with your menus, offers, outlets and buttons. Ask Taprizz to set one up.</p>
      </div>
    );
  }
  const row = { fee_inr: 0, billing_note: null, ...(data as object) } as Parameters<typeof LinkManager>[0]["initial"];
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Mini link</h1>
      <p className="mt-1 mb-4 text-sm" style={{ color: "var(--d-muted)" }}>
        Your page: <a className="underline" href={`/l/${row.slug}`} target="_blank" rel="noopener">{LINK_BASE.replace(/^https?:\/\//, "")}/{row.slug}</a>. See which buttons people tap, and change anything on the page.
      </p>
      <LinkManager initial={row} clientName={client.name} mode="member" />
    </>
  );
}
