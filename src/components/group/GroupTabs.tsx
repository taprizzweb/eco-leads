"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({ slug }: { slug: string }) {
  const path = usePathname();
  const tabs = [{ href: `/group/${slug}`, label: "Overview", exact: true }, { href: `/group/${slug}/branches`, label: "Branches" }];
  return (
    <nav aria-label="Chain" className="mx-auto max-w-6xl px-4 pb-2">
      <div className="d-seg w-fit max-w-full overflow-x-auto">
        {tabs.map((t) => <Link key={t.href} href={t.href} aria-current={(t.exact ? path === t.href : path.startsWith(t.href)) ? "page" : undefined}>{t.label}</Link>)}
      </div>
    </nav>
  );
}
