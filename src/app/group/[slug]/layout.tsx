import Link from "next/link";
import { Suspense } from "react";
import { loadGroup } from "@/lib/group";
import { BackButton, ExitGuard, RememberPage } from "@/components/AppNav";
import { Mark } from "@/components/dash/AuthFrame";
import { GroupTabs } from "@/components/group/GroupTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chain dashboard", robots: { index: false } };

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { group } = await loadGroup(slug);
  const { data: { user } } = await (await import("@/lib/supabase/server")).supabaseServer().then((s) => s.auth.getUser());
  void user;
  return (
    <div className="dash min-h-dvh" data-mode="dark">
      <header className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{ borderColor: "var(--d-line)", background: "color-mix(in srgb, var(--d-bg) 85%, transparent)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <BackButton style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }} />
          {group.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={group.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            : <Mark size={32} />}
          <Link href={`/group/${group.slug}`} className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--d-text)" }}>{group.name}</Link>
          <form action="/auth/signout" method="post"><button className="d-btn d-btn-s !min-h-10 !px-4 !text-[13px]">Sign out</button></form>
        </div>
        <GroupTabs slug={group.slug} />
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 [overflow-x:clip]">{children}</main>
      <Suspense fallback={null}><RememberPage /></Suspense>
      <ExitGuard />
    </div>
  );
}
