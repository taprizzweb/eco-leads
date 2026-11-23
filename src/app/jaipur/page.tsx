import Link from "next/link";
import { HUB_NAME, HUB_PATH, OFFER_KINDS, endsLabel, loadCards, loadChains, loadHub } from "@/lib/hub";
import { PlaceCard } from "@/components/hub/PlaceCard";
import { AreaPicker } from "@/components/hub/AreaPicker";
import { HubMark } from "@/components/hub/HubBack";
import { NearMe } from "@/components/hub/NearMe";

export default async function HubPage({ searchParams }: { searchParams: Promise<{ area?: string; cat?: string }> }) {
  const sp = await searchParams;
  const area0 = /^[a-z0-9-]{2,40}$/.test(sp.area ?? "") ? sp.area! : "";
  const cat0 = /^[a-z0-9_-]{2,40}$/.test(sp.cat ?? "") ? sp.cat! : "";
  const [hub, chains, cards] = await Promise.all([loadHub(area0, cat0), loadChains(area0, cat0), loadCards(area0, cat0)]);
  const area = hub.areas.some((a) => a.id === area0) ? area0 : "";
  const areaName = hub.areas.find((a) => a.id === area)?.name ?? "Jaipur";
  const catLabel = hub.categories.find((c) => c.id === cat0)?.label;
  const link = (c: string) => `${HUB_PATH}?${new URLSearchParams({ ...(area ? { area } : {}), ...(c ? { cat: c } : {}) })}`;
  const chip = "d-btn !min-h-11 !px-4 shrink-0";

  return (
    <div className="space-y-6">
      <HubMark />
      <div>
        <h1 className="text-[34px] leading-[1.04] font-extrabold tracking-[-0.045em]" style={{ color: "#fff" }}>Discover the best {catLabel ?? "of"} {areaName === "Jaipur" ? "Jaipur" : `in ${areaName}`}</h1>
        <p className="mt-2 text-[15px]" style={{ color: "var(--d-muted)" }}>Cafes, salons, gyms and more, ranked by real guests. Paying never changes the order.</p>
      </div>

      <NearMe />

      <h2 className="text-base font-semibold" style={{ color: "var(--d-text)" }}>Explore by area</h2>
      <div className="flex flex-wrap items-center gap-2"><AreaPicker areas={hub.areas} area={area} cat={cat0} /></div>

      <nav aria-label="Category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href={link("")} className={`${chip} ${!cat0 ? "d-btn-p" : "d-btn-s"}`} aria-current={!cat0 ? "page" : undefined}>All</Link>
        {hub.categories.map((c) => <Link key={c.id} href={link(c.id)} className={`${chip} ${cat0 === c.id ? "d-btn-p" : "d-btn-s"}`} aria-current={cat0 === c.id ? "page" : undefined}>{c.label}</Link>)}
      </nav>

      {hub.sponsors.length > 0 && (
        <section aria-labelledby="sp">
          <div className="mb-3 flex items-center gap-2"><h2 id="sp" className="text-base font-semibold" style={{ color: "var(--d-text)" }}>Featured offers</h2><span className="d-chip" style={{ ["--c" as string]: "var(--d-amber)" }}>Sponsored</span></div>
          <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {hub.sponsors.map((s) => {
              const card = cards.find((c) => c.slug === s.slug);
              return card
                ? <div key={s.offer_id} className="snap-start"><PlaceCard size="mid" p={{ ...card, offer: { kind: s.kind, ends_on: s.ends_on, follow_first: true, title: card.offer?.title ?? null } }} /></div>
                : (
                  <Link key={s.offer_id} href={`${HUB_PATH}/${s.slug}`} className="d-raise mr-3 flex min-h-[148px] w-[250px] shrink-0 snap-start flex-col justify-between p-4" style={{ background: "radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--d-amber) 16%, transparent), transparent 60%), var(--d-raise)", borderRadius: 18 }}>
                    <span className="d-chip w-fit" style={{ ["--c" as string]: "var(--d-amber)" }}>{OFFER_KINDS[s.kind] ?? "Special offer"}</span>
                    <div><p className="text-[19px] leading-tight font-semibold tracking-[-0.02em]" style={{ color: "var(--d-text)" }}>{s.name}</p><p className="mt-1 text-xs" style={{ color: "var(--d-muted)" }}>{s.area} · {endsLabel(s.ends_on)}</p></div>
                  </Link>
                );
            })}
          </div>
        </section>
      )}

      {chains.length > 0 && (
        <section aria-labelledby="co">
          <h2 id="co" className="mb-3 text-base font-semibold" style={{ color: "var(--d-text)" }}>Companies and all their branches</h2>
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
        <h2 id="top" className="mb-3 text-base font-semibold" style={{ color: "var(--d-text)" }}>Top rated in Jaipur</h2>
        {cards.length === 0 ? (
          <div className="d-card p-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>No places listed here yet. More are coming soon.</div>
        ) : (
          <ol className="space-y-5">
            {cards.map((p) => <li key={p.slug}><PlaceCard p={p} /></li>)}
          </ol>
        )}
      </section>
      <p className="text-center text-xs" style={{ color: "var(--d-muted)" }}>{HUB_NAME}: ratings come from guests who scanned a plate at the place, over the last 90 days.</p>
    </div>
  );
}
