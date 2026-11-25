// Self-serve mini links: the preset link rows, and turning what a person typed into a clean web address.

export const MINI_SOCIALS = [
  { key: "instagram", label: "Instagram", ph: "@yourcafe or instagram.com/yourcafe", kind: "handle", base: "https://instagram.com/" },
  { key: "facebook", label: "Facebook", ph: "facebook.com/yourcafe", kind: "handle", base: "https://facebook.com/" },
  { key: "whatsapp", label: "WhatsApp", ph: "", kind: "phone", base: "" },
  { key: "phone", label: "Call", ph: "", kind: "phone", base: "" },
  { key: "website", label: "Website", ph: "www.yourcafe.com", kind: "url", base: "" },
  { key: "maps", label: "Google Maps", ph: "Paste your Google Maps link", kind: "url", base: "" },
  { key: "zomato", label: "Zomato", ph: "Paste your Zomato link", kind: "url", base: "" },
  { key: "swiggy", label: "Swiggy", ph: "Paste your Swiggy link", kind: "url", base: "" },
] as const;

const WEB = /^https?:\/\/\S+$/i;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/** "www.cafe.com" becomes "https://www.cafe.com". Returns "" when nothing was typed and null when it is not a web address. */
export function toUrl(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return "";
  if (WEB.test(t)) return t;
  if (DOMAIN.test(t)) return "https://" + t;
  return null;
}

/** "@yourcafe" or "yourcafe" becomes the profile address. Full links stay as they are. */
export function toHandleUrl(v: string | undefined, base: string): string | null {
  const t = (v ?? "").trim();
  if (!t) return "";
  const h = t.replace(/^@/, "");
  if (/^[A-Za-z0-9._]{1,40}$/.test(h)) return base + h;
  return toUrl(t);
}

type Btn = { label: string; url: string; icon: string };

export const isMenuBtn = (b: Btn) => b.icon === "menu" && !b.url.startsWith("#");
export const isOutletsBtn = (b: Btn) => b.url === "#outlets";
export const isOffersBtn = (b: Btn) => b.url === "#offers";
export const isCustomBtn = (b: Btn) => !isMenuBtn(b) && !isOutletsBtn(b) && !isOffersBtn(b);

/** Checks and cleans every link of a mini page before it is saved. */
export function miniNormalize(socials: Record<string, string>, buttons: Btn[]): { socials: Record<string, string>; buttons: Btn[]; error?: string } {
  const out: Record<string, string> = { ...socials };
  for (const p of MINI_SOCIALS) {
    const raw = socials[p.key];
    if (!raw || !raw.trim()) { delete out[p.key]; continue; }
    if (p.kind === "phone") continue;
    const v = p.kind === "handle" ? toHandleUrl(raw, p.base) : toUrl(raw);
    if (v === null) return { socials, buttons, error: `${p.label}: please paste a link like https://... or just your handle.` };
    out[p.key] = v;
  }
  const bs: Btn[] = [];
  for (const b of buttons) {
    if (b.url.startsWith("#")) { bs.push(b); continue; }
    const v = toUrl(b.url);
    if (v === null || (v === "" && b.label.trim())) return { socials, buttons, error: `The button "${b.label || "new"}" needs a link like https://...` };
    if (!b.label.trim() && !v) continue;
    bs.push({ ...b, url: v });
  }
  return { socials: out, buttons: bs };
}

export const FREE_PERKS = [
  "Your page goes live at once",
  "8 templates and any colour you like",
  "3 photos",
  "Instagram, WhatsApp, Call, Website, Maps, Zomato, Swiggy and Menu links",
  "1 extra link of your own",
  "All your outlets in one list",
];
export const PREMIUM_PERKS = [
  "Everything in Free",
  "Videos (2) and up to 10 photos",
  "An Offers section, with an Offers button",
  "The scrolling keywords line under your name",
  "6 extra links instead of 1",
  "No \"Make your own page\" line at the bottom",
  "Your page can show up in Google search",
  "Help on WhatsApp",
];
