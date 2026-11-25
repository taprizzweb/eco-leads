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
  const aiOn = !!(data as { ai_review?: boolean }).ai_review;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const head = { count: "exact" as const, head: true };
  const [written, copied, complaints] = aiOn ? await Promise.all([
    sb.from("review_drafts").select("id", head).eq("client_id", client.id).eq("plate_code", "mini").gte("created_at", since),
    sb.from("review_drafts").select("id", head).eq("client_id", client.id).eq("plate_code", "mini").eq("copied", true).gte("created_at", since),
    sb.from("feedback").select("id, body, status, created_at").eq("client_id", client.id).eq("kind", "complaint").like("body", "[Mini link]%").order("created_at", { ascending: false }).limit(20),
  ]) : [null, null, null];
  const row = { fee_inr: 0, billing_note: null, ...(data as object) } as Parameters<typeof LinkManager>[0]["initial"];
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Mini link</h1>
      <p className="mt-1 mb-4 text-sm" style={{ color: "var(--d-muted)" }}>
        Your page: <a className="underline" href={`/l/${row.slug}`} target="_blank" rel="noopener">{LINK_BASE.replace(/^https?:\/\//, "")}/{row.slug}</a>. See which buttons people tap, and change anything on the page.
      </p>
      {aiOn && (
        <section className="d-card mb-4 p-5">
          <h2 className="font-semibold">AI Review by Tap (last 30 days)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[["Reviews written for guests", written?.count ?? 0], ["Copied to post on Google", copied?.count ?? 0], ["Complaints received", complaints?.data?.length ?? 0]].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl p-4" style={{ background: "var(--d-surface-2, var(--d-surface))", boxShadow: "inset 0 0 0 1px var(--d-line)" }}><p className="text-sm" style={{ color: "var(--d-muted)" }}>{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{String(v)}</p></div>
            ))}
          </div>
          {(complaints?.data?.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-2">
              {complaints!.data!.map((f) => (
                <li key={f.id} className="rounded-xl p-3 text-sm" style={{ boxShadow: "inset 0 0 0 1px var(--d-line)" }}>
                  <p>{String(f.body).replace(/^\[Mini link\]\s*/, "")}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--d-muted)" }}>{new Date(f.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <LinkManager initial={row} clientName={client.name} mode="member" />
    </>
  );
}
