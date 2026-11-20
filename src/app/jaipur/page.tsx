import Link from "next/link";
import { Star } from "lucide-react";
import { HUB_NAME, HUB_PATH, MIN_GUESTS, OFFER_KINDS, endsLabel, loadChains, loadHub } from "@/lib/hub";
import { AreaPicker } from "@/components/hub/AreaPicker";
import { HubMark } from "@/components/hub/HubBack";

export default async function HubPage({ searchParams }: { searchParams: Promise<{ area?: string; cat?: string }> }) {
  const sp = await searchParams;
  const area0 = /^[a-z0-9-]{2,40}$/.test(sp.area ?? "") ? sp.area! : "";
  const cat0 = /^[a-z0-9_-]{2,40}$/.test(sp.cat ?? "") ? sp.cat! : "";
  const [hub, chains] = await Promise.all([loadHub(area0, cat0), loadChains(area0, cat0)]);
  const area = hub.areas.some((a) => a.id === area0) ? area0 : "";
  const areaName = hub.areas.find((a) => a.id === area)?.name ?? "Jaipur";
  const catLabel = hub.categories.find((c) => c.id === cat0)?.label;
  const link = (c: string) => `${HUB_PATH}?${new URLSearchParams({ ...(area ? { area } : {}), ...(c ? { cat: c } : {}) })}`;
  const chip = "d-btn !min-h-11 !px-4 shrink-0";

  return (
    <div className="space-y-6">
      <HubMark />
      <div>
        <h1 className="text-[30px] leading-[1.08] font-bold tracking-[-0.045em]" style={{ color: "var(--d-text)" }}>{areaName} ke sabse acche{catLabel ? ` ${catLabel}` : " jagah"}</h1>
        <p className="mt-2 text-[15px]" style={{ color: "var(--d-muted)" }}>Asli guests ki rating se. Paise dene se number nahi badalta.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2"><AreaPicker areas={hub.areas} area={area} cat={cat0} /></div>

      <nav aria-label="Category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href={link("")} className={`${chip} ${!cat0 ? "d-btn-p" : "d-btn-s"}`} aria-current={!cat0 ? "page" : undefined}>Sab</Link>
        {hub.categories.map((c) => <Link key={c.id} href={link(c.id)} className={`${chip} ${cat0 === c.id ? "d-btn-p" : "d-btn-s"}`} aria-current={cat0 === c.id ? "page" : undefined}>{c.label}</Link>)}
      </nav>

      {hub.sponsors.length > 0 && (
        <section aria-labelledby="sp">
          <div className="mb-3 flex items-center gap-2"><h2 id="sp" className="text-base font-semibold" style={{ color: "var(--d-text)" }}>Khaas offers</h2><span className="d-chip" style={{ ["--c" as string]: "var(--d-amber)" }}>Sponsored</span></div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {hub.sponsors.map((s) => (
              <Link key={s.offer_id} href={`${HUB_PATH}/${s.slug}`} className="d-raise flex min-h-[148px] w-[250px] shrink-0 snap-start flex-col justify-between p-4" style={{ background: "radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--d-amber) 16%, transparent), transparent 60%), var(--d-raise)", borderRadius: 18 }}>
                <span className="d-chip w-fit" style={{ ["--c" as string]: "var(--d-amber)" }}>{OFFER_KINDS[s.kind] ?? "Special offer"}</span>
                <div>
                  <p className="text-[19px] leading-tight font-semibold tracking-[-0.02em]" style={{ color: "var(--d-text)" }}>{s.name}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--d-muted)" }}>{s.area} · {endsLabel(s.ends_on)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {chains.length > 0 && (
        <section aria-labelledby="co">
          <h2 id="co" className="mb-3 text-base font-semibold" style={{ color: "var(--d-text)" }}>Companies, sab branches ek jagah</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {chains.map((c) => (
              <Link key={c.slug} href={`${HUB_PATH}/company/${c.slug}`} className="d-raise flex w-[112px] shrink-0 flex-col items-center gap-2 p-3 text-center" style={{ borderRadius: 18 }}>
                {c.logo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.logo_url} alt="" loading="lazy" className="h-16 w-16 rounded-full object-cover" />
                  : <span className="grid h-16 w-16 place-items-center rounded-full text-xl font-bold" style={{ background: "var(--d-surface)", color: "var(--d-text)" }}>{c.name.slice(0, 1)}</span>}
                <b className="line-clamp-2 text-[13px] leading-tight font-semibold" style={{ color: "var(--d-text)" }}>{c.name}</b>
                <span className="text-[11px]" style={{ color: "var(--d-muted)" }}>{c.branches} branches</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="top">
        <h2 id="top" className="mb-3 text-base font-semibold" style={{ color: "var(--d-text)" }}>Top list</h2>
        {hub.places.length === 0 ? (
          <div className="d-card p-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>Is area mein abhi koi nahi. Jaldi aa raha hai.</div>
        ) : (
          <ol className="space-y-2.5">
            {hub.places.map((p) => (
              <li key={p.slug}>
                <Link href={`${HUB_PATH}/${p.slug}`} className="d-raise flex items-center gap-3 p-3.5">
                  <span className="w-9 shrink-0 text-center text-[26px] font-bold tracking-[-0.04em]" style={{ color: p.rank <= 3 ? "var(--d-amber)" : "var(--d-text)" }}>{p.rank}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold" style={{ color: "var(--d-text)" }}>{p.name}</b>
                    <span className="block truncate text-xs" style={{ color: "var(--d-muted)" }}>{p.area}{p.category ? ` · ${p.category}` : ""}{p.has_offer ? " · offer chal rahi hai" : ""}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold" style={{ color: "var(--d-amber)" }}>
                    <Star size={14} fill="currentColor" aria-hidden />{p.guests >= MIN_GUESTS ? p.rating.toFixed(1) : <span className="d-chip" style={{ ["--c" as string]: "var(--d-muted)" }}>Naya</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="text-center text-xs" style={{ color: "var(--d-muted)" }}>{HUB_NAME}: rating un guests ki hai jinhone dukaan par plate scan karke di. Pichhle 90 din.</p>
    </div>
  );
}
