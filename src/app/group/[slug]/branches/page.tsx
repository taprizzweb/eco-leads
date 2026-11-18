import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { loadGroup, groupBranches } from "@/lib/group";
import { Pill } from "@/components/admin/ui";
import { BranchSearch } from "@/components/group/BranchSearch";

const SORTS: [string, string][] = [["name", "Name"], ["taps", "Most taps"], ["drafts", "Most reviews"], ["feedback", "Most complaints"], ["customers", "Most customers"]];
const SIZE = 25;

export default async function Branches({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; sort?: string; page?: string; days?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const sort = SORTS.some(([k]) => k === sp.sort) ? (sp.sort as string) : "name";
  const page = Math.max(0, parseInt(sp.page ?? "0") || 0);
  const search = (sp.q ?? "").slice(0, 60);
  const { sb, group } = await loadGroup(slug);
  const { rows, total } = await groupBranches(sb, group, { days, search, sort, page, size: SIZE });
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(search ? { q: search } : {}), sort, days: String(days), page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `/group/${group.slug}/branches?${p.toString()}`;
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Branches</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--d-muted)" }}>{total} {total === 1 ? "branch" : "branches"}{search ? ` matching "${search}"` : ""}. Numbers are for the last {days} days.</p>
      </div>
      <BranchSearch slug={group.slug} q={search} sort={sort} days={days} sorts={SORTS} />
      {rows.length === 0 ? <div className="d-card p-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>{search ? `No branch matches "${search}".` : "No branches yet."}</div> : (
        <div className="d-card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead><tr className="text-xs" style={{ color: "var(--d-muted)" }}>{["Branch", "Taps", "Reviews", "Copied", "Complaints", "Customers", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client_id} style={{ borderTop: "1px solid var(--d-line)", color: "var(--d-text)" }}>
                  <td className="px-4 py-2"><Link href={`/dashboard/${r.slug}`} className="font-medium hover:underline">{r.name}</Link>{r.status && r.status !== "active" && <span className="ml-2"><Pill tone="amber">{r.status}</Pill></span>}</td>
                  <td className="px-4 py-2 tabular-nums">{r.taps.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 tabular-nums">{r.drafts.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 tabular-nums">{r.copied.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 tabular-nums">{r.feedback_open ? <Pill tone="red">{r.feedback_open}</Pill> : "0"}</td>
                  <td className="px-4 py-2 tabular-nums">{r.customers.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-right"><Link className="d-btn d-btn-s !min-h-9 !px-3" href={`/dashboard/${r.slug}`} aria-label={`Open ${r.name}`}><ExternalLink size={14} /> Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page > 0 ? <Link className="d-btn d-btn-s" href={href({ page: page - 1 })}>Previous</Link> : <span />}
          <span className="text-sm" style={{ color: "var(--d-muted)" }}>Page {page + 1} of {pages}</span>
          {page + 1 < pages ? <Link className="d-btn d-btn-s" href={href({ page: page + 1 })}>Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
