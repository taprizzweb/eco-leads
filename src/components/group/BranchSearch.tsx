"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Search and sort for the branch table. The page is rebuilt on the server for every change, so it stays fast with hundreds of branches.
export function BranchSearch({ slug, q, sort, days, sorts }: { slug: string; q: string; sort: string; days: number; sorts: [string, string][] }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => router.replace(`/group/${slug}/branches?${new URLSearchParams({ ...(text ? { q: text } : {}), sort, days: String(days) })}`), 350);
    return () => clearTimeout(t);
  }, [text, q, slug, sort, days, router]);
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
        <input type="search" aria-label="Search branches" className="d-input !pl-10" placeholder="Search a branch" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <select aria-label="Sort branches" className="d-input !w-auto" value={sort} onChange={(e) => router.replace(`/group/${slug}/branches?${new URLSearchParams({ ...(text ? { q: text } : {}), sort: e.target.value, days: String(days) })}`)}>
        {sorts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select aria-label="Period" className="d-input !w-auto" value={days} onChange={(e) => router.replace(`/group/${slug}/branches?${new URLSearchParams({ ...(text ? { q: text } : {}), sort, days: e.target.value })}`)}>
        {[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
      </select>
    </div>
  );
}
