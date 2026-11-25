// Every switch a package can set and the admin can override per client.
// Keys match packages.features / clients.feature_overrides in the database.
export type FeatureDef =
  | { key: string; label: string; hint?: string; type: "bool" }
  | { key: string; label: string; hint?: string; type: "number"; min: number; max: number }
  | { key: string; label: string; hint?: string; type: "enum"; options: { value: string; label: string }[] };

export const FEATURE_DEFS: FeatureDef[] = [
  { key: "menu", label: "Menu card", type: "bool" },
  { key: "review", label: "Review flow", type: "bool" },
  { key: "offers_strip", label: "Offers strip", type: "bool" },
  { key: "keywords", label: "Keyword strip", type: "bool" },
  { key: "photo_limit", label: "Gallery photo limit", type: "number", min: 0, max: 100 },
  { key: "table_ordering", label: "Table ordering links", hint: "each table plate opens that table's own ordering link", type: "bool" },
  { key: "call_server", label: "Call server bell", hint: "cafes and hotels: a bell on the table plate; the owner sees the table on the Calls screen", type: "bool" },
  { key: "pos", label: "Food orders (POS)", hint: "online menu and ordering from the table QR, live orders, GST bills, KOT, table requests and chat for the owner", type: "bool" },
  { key: "complaints", label: "Complaint inbox", hint: "with voice notes", type: "bool" },
  { key: "suggestions", label: "Suggestions", type: "bool" },
  { key: "offers_card", label: "Check offers card", hint: "with claim codes", type: "bool" },
  { key: "events", label: "Events", type: "bool" },
  { key: "membership", label: "Membership", type: "bool" },
  { key: "creators", label: "Creators corner", hint: "tag, follow and share photos or clips", type: "bool" },
  { key: "whatsapp_capture", label: "WhatsApp contact capture", type: "bool" },
  {
    key: "review_replies",
    label: "Review replies",
    type: "enum",
    options: [
      { value: "copy", label: "Copy" },
      { value: "approve", label: "Approve and post" },
      { value: "auto_4_5", label: "Auto for 4 and 5 stars" },
      { value: "managed", label: "Our team handles" },
    ],
  },
  {
    key: "report",
    label: "Monthly report",
    type: "enum",
    options: [
      { value: "basic", label: "Basic" },
      { value: "full", label: "Full" },
      { value: "full_call", label: "Full plus a call" },
    ],
  },
  {
    key: "whatsapp_campaigns",
    label: "WhatsApp campaigns",
    type: "enum",
    options: [
      { value: "payg", label: "Pay as you go" },
      { value: "some", label: "Some included" },
      { value: "capped", label: "Included up to a cap" },
    ],
  },
  { key: "custom_links", label: "Extra link buttons", hint: "how many the owner may add, 0 is off", type: "number", min: 0, max: 20 },
  { key: "content_help", label: "Content help", hint: "editing, posting, calendar", type: "bool" },
];

export type FeatureMap = Record<string, unknown>;

/** Effective value = package preset overlaid with the client's overrides. */
export const effective = (preset: FeatureMap, overrides: FeatureMap): FeatureMap => ({ ...preset, ...overrides });

/** Keep only the keys whose value differs from the package preset. */
export function diffOverrides(preset: FeatureMap, wanted: FeatureMap): FeatureMap {
  const out: FeatureMap = {};
  for (const [k, v] of Object.entries(wanted)) if (preset[k] !== v) out[k] = v;
  return out;
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// 6 characters, no look-alikes (0/O, 1/l/I), for plate links like taprizz.in/e/k7m2qx
export function newPlateCode(len = 6) {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => a[b % a.length]).join("");
}

export const PLATE_BASE = process.env.NEXT_PUBLIC_PLATE_BASE_URL || "https://taprizz.in";

/** Table ordering links only make sense where guests order at a table or in a room. Gyms, salons and clinics never see the Tables tab. */
export const TABLE_TYPES = ["cafe", "hotel", "resort"];
export const tablesFit = (businessType: string | null | undefined) => !businessType || TABLE_TYPES.includes(businessType);

/** Where mini links are shown to people. link.taprizz.in is connected; NEXT_PUBLIC_LINK_BASE_URL can still override it. */
export const LINK_BASE = (process.env.NEXT_PUBLIC_LINK_BASE_URL || "https://link.taprizz.in").replace(/\/+$/, "");
export const linkUrl = (slug: string) => `${LINK_BASE}/${slug}`;
