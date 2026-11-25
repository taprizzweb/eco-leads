import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { LinkManager } from "@/components/link/LinkManager";
import { TokenShell } from "@/components/link/TokenShell";
import { LINK_BASE } from "@/lib/features";
import { MiniPublishCard, type MiniSettings, type MiniState } from "@/components/link/MiniPublishCard";

export const dynamic = "force-dynamic";
// A private link: never indexed, never passed on as a referrer.
export const metadata: Metadata = { title: "Mini link control", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function EditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) notFound();
  const sb = await supabaseServer();
  const { data } = await sb.rpc("link_edit_load", { p_token: token });
  if (!data) {
    return (
      <div className="dash min-h-dvh grid place-items-center px-6" data-mode="light">
        <div className="d-card max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold">This control link is not active</h1>
          <p className="mt-2" style={{ color: "var(--d-muted)" }}>It may have been replaced or switched off. Ask Taprizz for the new link.</p>
        </div>
      </div>
    );
  }
  const [{ data: st }, { data: cfg }] = await Promise.all([sb.rpc("mini_state", { p_token: token }), sb.rpc("mini_public_settings")]);
  const state = st as MiniState | null;
  const mini = state?.plan === "mini";
  const row = { fee_inr: 0, billing_note: null, ...(data as object) } as Parameters<typeof LinkManager>[0]["initial"];
  return (
    <TokenShell name={row.name}>
      {mini && state && cfg && <MiniPublishCard token={token} slug={row.slug} state={state} settings={cfg as MiniSettings} />}
      <p className="mb-4 text-sm" style={{ color: "var(--d-muted)" }}>
        Your page: {mini && !state?.published ? <span>{LINK_BASE.replace(/^https?:\/\//, "")}/{row.slug} (live after payment)</span> : <a className="underline" href={`/l/${row.slug}`} target="_blank" rel="noopener">{LINK_BASE.replace(/^https?:\/\//, "")}/{row.slug}</a>}. Keep this control link private: anyone who has it can change your page.{mini ? " Bookmark this page, it is the only way back to your editor." : ""}
      </p>
      <LinkManager initial={row} clientName={null} mode="token" token={token} mini={mini} />
    </TokenShell>
  );
}
