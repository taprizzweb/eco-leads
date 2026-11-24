// Search-engine text for a mini link page. Built only from what the page really contains: name, tagline, outlet city and address, real buttons and the owner's own search phrases.
import { safeUrl, telLink, type LinkData } from "@/lib/linkpage";

const cityOf = (d: LinkData) => d.outlets?.find((o) => o.city?.trim())?.city?.trim() ?? null;
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "").replace(/[,.;:\s]+$/, ""));

export function linkTitle(d: LinkData): string {
  const city = cityOf(d);
  const base = city ? `${d.name}, ${city}` : d.name;
  const kw = d.seo_keywords?.[0]?.trim();
  return kw && base.length + kw.length + 3 <= 60 ? `${base} | ${kw}` : base;
}

export function linkDescription(d: LinkData): string {
  const city = cityOf(d);
  const kws = (d.seo_keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 3);
  const labels = (d.buttons ?? []).map((b) => b.label.trim()).filter(Boolean).slice(0, 4);
  const parts = [
    `${d.name}${city ? ` in ${city}` : ""}${d.tagline ? `. ${d.tagline.replace(/[.\s]+$/, "")}` : ""}.`,
    kws.length ? `${kws.join(", ")}.` : "",
    labels.length ? `${labels.join(", ")} and more.` : "",
  ].filter(Boolean);
  return cut(parts.join(" "), 160);
}

/** schema.org LocalBusiness markup. Fields that the page does not have are left out, never guessed. */
export function linkJsonLd(d: LinkData, url: string): string {
  const o = d.outlets?.find((x) => x.address?.trim() || x.city?.trim());
  const s = d.socials ?? {};
  const same = [s.instagram, s.facebook, s.zomato, s.swiggy, s.website].map((u) => safeUrl(u)).filter((u): u is string => !!u && /^https?:/i.test(u));
  const tel = telLink(s.phone)?.replace(/^tel:/, "");
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: d.name, url,
    ...(d.tagline ? { description: d.tagline } : {}),
    ...(d.logo_url ? { image: d.logo_url, logo: d.logo_url } : {}),
    ...(same.length ? { sameAs: same } : {}),
    ...(tel ? { telephone: tel } : {}),
    ...(o ? { address: { "@type": "PostalAddress", ...(o.address?.trim() ? { streetAddress: o.address.trim() } : {}), ...(o.city?.trim() ? { addressLocality: o.city.trim() } : {}) } } : {}),
    ...(safeUrl(o?.map_url) ?? safeUrl(s.maps) ? { hasMap: safeUrl(o?.map_url) ?? safeUrl(s.maps) } : {}),
    ...(d.seo_keywords?.length ? { keywords: d.seo_keywords.join(", ") } : {}),
  };
  // "<" is escaped so nothing inside the data can close the script tag.
  return JSON.stringify(ld).replace(/</g, "\\u003c");
}
