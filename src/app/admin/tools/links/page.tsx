import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { LinksAdmin, type LinkRow, type ClientOpt } from "@/components/admin/LinksAdmin";

export default async function LinksPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const [{ data: links }, { data: clients }] = await Promise.all([
    sb.from("link_pages").select("id, slug, name, logo_url, theme, published, fee_inr, client_id, updated_at").order("updated_at", { ascending: false }),
    sb.from("clients").select("id, name, slug").order("name"),
  ]);
  const ids = (links ?? []).map((l) => l.id);
  const { data: stats } = ids.length ? await sb.from("link_stats").select("link_id, views, clicks").in("link_id", ids) : { data: [] };
  const tot = new Map<string, { views: number; clicks: number }>();
  for (const s of stats ?? []) { const t = tot.get(s.link_id) ?? { views: 0, clicks: 0 }; t.views += s.views; t.clicks += s.clicks; tot.set(s.link_id, t); }
  const rows = (links ?? []).map((l) => ({ ...l, views: tot.get(l.id)?.views ?? 0, clicks: tot.get(l.id)?.clicks ?? 0 }));
  return (
    <>
      <PageHead title="Mini Links" sub="A premium one-page site a business puts in its Instagram bio: photos, menus, outlets, delivery apps and reviews." />
      <LinksAdmin links={rows as LinkRow[]} clients={(clients ?? []) as ClientOpt[]} />
    </>
  );
}
