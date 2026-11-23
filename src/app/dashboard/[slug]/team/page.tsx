import { requireSection } from "@/lib/dash";
import { ExtrasBoard } from "@/components/dash/ExtrasBoard";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await requireSection(slug, "staff");
  const [staff, posters, thanks, complaints, recentThanks] = await Promise.all([
    sb.from("staff").select("id, name, photo_url, active, thanks_total").eq("client_id", client.id).order("sort").order("created_at"),
    sb.from("posters").select("id, image_url, caption, active").eq("client_id", client.id).order("sort").order("created_at"),
    sb.from("staff_thanks").select("id, staff_id, note, created_at").eq("client_id", client.id).not("note", "is", null).order("created_at", { ascending: false }).limit(30),
    sb.from("feedback").select("body, created_at").eq("client_id", client.id).eq("kind", "complaint").like("body", "[About %").order("created_at", { ascending: false }).limit(2000),
    sb.from("staff_thanks").select("staff_id, created_at").eq("client_id", client.id).gte("created_at", new Date(Date.now() - 30 * 86400e3).toISOString()).limit(5000),
  ]);
  // A complaint about a person is saved with "[About Name]" at the start, so it can be counted per person.
  const since30 = Date.now() - 30 * 86400e3;
  const rows = ((staff.data ?? []) as { id: string; name: string; photo_url: string | null; active: boolean; thanks_total: number }[]).map((m) => {
    const mine = (complaints.data ?? []).filter((c) => c.body.startsWith(`[About ${m.name}]`));
    return { ...m, complaintsAll: mine.length, complaints30: mine.filter((c) => new Date(c.created_at).getTime() >= since30).length, thanks30: (recentThanks.data ?? []).filter((t) => t.staff_id === m.id).length };
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Staff and new posters</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Add your team so guests can thank them or report a problem. Add posters for the red New button on your guest page.</p>
      </div>
      <section aria-label="Staff report" className="d-card overflow-x-auto">
        <div className="p-4 pb-2"><h2 className="font-semibold">Staff report</h2><p className="text-sm" style={{ color: "var(--d-muted)" }}>Thank-yous and complaints for each person. The last 30 days, and all time.</p></div>
        {rows.length === 0 ? <p className="px-4 pb-5 text-sm" style={{ color: "var(--d-muted)" }}>Add your team below and their report appears here.</p> : (
          <table className="w-full min-w-[460px] text-left text-sm">
            <thead style={{ color: "var(--d-muted)" }}><tr><th className="p-3">Name</th><th className="p-3 text-right">Thanks 30 days</th><th className="p-3 text-right">Thanks all time</th><th className="p-3 text-right">Complaints 30 days</th><th className="p-3 text-right">Complaints all time</th></tr></thead>
            <tbody>
              {[...rows].sort((a, b) => b.thanks30 - a.thanks30).map((m) => (
                <tr key={m.id} className="border-t" style={{ borderColor: "var(--d-line)", opacity: m.active ? 1 : 0.55 }}>
                  <td className="p-3 font-semibold">{m.name}</td>
                  <td className="p-3 text-right font-semibold" style={{ color: m.thanks30 ? "var(--d-green)" : undefined }}>{m.thanks30}</td>
                  <td className="p-3 text-right">{m.thanks_total}</td>
                  <td className="p-3 text-right font-semibold" style={{ color: m.complaints30 ? "var(--d-red)" : undefined }}>{m.complaints30}</td>
                  <td className="p-3 text-right">{m.complaintsAll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <ExtrasBoard clientId={client.id} staff={(staff.data ?? []) as never} posters={(posters.data ?? []) as never} thanks={(thanks.data ?? []) as never} />
    </div>
  );
}
