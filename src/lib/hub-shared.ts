// Pure values and helpers used by both server and client code.
// One place to rename the product. Everything on the public pages reads this.
export const HUB_NAME = "Jaipur Ki Raay";
export const HUB_PATH = "/jaipur";
export const MIN_GUESTS = 30;

export const OFFER_KINDS: Record<string, string> = {
  new_year: "New Year special", diwali: "Diwali special", festival: "Festival special",
  new_launch: "New launch", new_product: "New product", other: "Special offer",
};

export type HubArea = { id: string; name: string };
export type HubCategory = { id: string; label: string };
export type HubPlace = { slug: string; name: string; area: string; category: string | null; rating: number; guests: number; rank: number; has_offer: boolean };
export type HubSponsor = { offer_id: string; kind: string; ends_on: string; slug: string; name: string; area: string };
export type HubHome = { areas: HubArea[]; categories: HubCategory[]; sponsors: HubSponsor[]; places: HubPlace[] };
export type HubOffer = { id: string; kind: string; ends_on: string; follow_first: boolean; title: string | null };
export type HubPlaceFull = {
  name: string; slug: string; tagline: string | null; logo_url: string | null; area: string; category: string | null;
  instagram: string | null; maps: string | null; phone: string | null; rating: number; guests: number; rank: number | null; total: number; offers: HubOffer[];
};

export function daysLeft(iso: string): number {
  const end = new Date(iso + "T23:59:59+05:30").getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 864e5));
}
export const endsLabel = (iso: string) => {
  const d = daysLeft(iso);
  return d <= 1 ? "Aaj last din" : `${d} din baaki`;
};
