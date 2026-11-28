// The Taprizz partners list lives on the Taprizz website. The mini link reads it from there (kept for a minute), so one change shows in both places.
export type PartnerLite = { name: string; slug: string; category: string; image: string; about: string };

export async function loadPartners(): Promise<PartnerLite[]> {
  try {
    const res = await fetch("https://www.taprizz.in/api/partners", { next: { revalidate: 60 }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return [];
    const j = (await res.json()) as { partners?: PartnerLite[] };
    return (j.partners ?? []).filter((p) => p?.name).slice(0, 40);
  } catch {
    return []; // the section is simply left out when the website cannot be reached
  }
}
