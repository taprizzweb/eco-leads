import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { HUB_NAME, HUB_PATH, MIN_GUESTS, loadChain } from "@/lib/hub";
import { HubBack } from "@/components/hub/HubBack";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await loadChain((await params).slug);
  return c ? { title: `${c.name} · ${HUB_NAME}`, description: `${c.name}: saari branches, Jaipur mein.` } : { title: HUB_NAME };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await loadChain((await params).slug);
  if (!c) notFound();
  return (
    <div className="space-y-5">
      <HubBack />
      <section className="flex items-center gap-4">
        {c.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-2xl font-bold" style={{ background: "var(--d-surface)", color: "var(--d-text)" }}>{c.name.slice(0, 1)}</span>}
        <div>
          <h1 className="text-[28px] leading-[1.05] font-bold tracking-[-0.045em]" style={{ color: "var(--d-text)" }}>{c.name}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>{c.branches.length} branches. Jis branch ka page dekhna hai, use chuno.</p>
        </div>
      </section>
      <ul className="space-y-2.5">
        {c.branches.map((b) => (
          <li key={b.slug}>
            <Link href={`${HUB_PATH}/${b.slug}`} className="d-raise flex items-center gap-3 p-3.5">
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold" style={{ color: "var(--d-text)" }}>{b.name}</b>
                <span className="block truncate text-xs" style={{ color: "var(--d-muted)" }}>{b.area}{b.category ? ` · ${b.category}` : ""}{b.has_offer ? " · offer chal rahi hai" : ""}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold" style={{ color: "var(--d-amber)" }}>
                <Star size={14} fill="currentColor" aria-hidden />{b.guests >= MIN_GUESTS ? b.rating.toFixed(1) : <span className="d-chip" style={{ ["--c" as string]: "var(--d-muted)" }}>Naya</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
