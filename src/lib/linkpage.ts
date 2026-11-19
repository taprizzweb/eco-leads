// Mini link pages: the premium one-page site a business puts in its Instagram bio.

export type LinkTheme = "midnight" | "graphite" | "obsidian" | "ocean" | "wine" | "forest" | "plum" | "ivory";

type ThemeDef = { label: string; dark: boolean; vars: Record<string, string> };

// Every template defines the same variables, so the page never hard-codes a colour.
export const LINK_THEMES: Record<LinkTheme, ThemeDef> = {
  midnight: { label: "Midnight Blue", dark: true, vars: { "--l-bg": "#050a1a", "--l-glow": "rgba(64,102,255,0.30)", "--l-surface": "rgba(255,255,255,0.055)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#eef2ff", "--l-muted": "#8f9bc0", "--l-accent": "#7b9bff", "--l-accent-soft": "rgba(123,155,255,0.16)", "--l-pill": "#ffffff", "--l-pill-text": "#0b1020", "--l-sheet": "#0a1128" } },
  graphite: { label: "Graphite", dark: true, vars: { "--l-bg": "#0f0f10", "--l-glow": "rgba(255,255,255,0.11)", "--l-surface": "rgba(255,255,255,0.05)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#f2f2f2", "--l-muted": "#9b9b9f", "--l-accent": "#d6d6da", "--l-accent-soft": "rgba(255,255,255,0.10)", "--l-pill": "#ffffff", "--l-pill-text": "#111111", "--l-sheet": "#1a1a1b" } },
  obsidian: { label: "Obsidian Gold", dark: true, vars: { "--l-bg": "#09090a", "--l-glow": "rgba(212,175,95,0.22)", "--l-surface": "rgba(255,255,255,0.05)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#f6f1e7", "--l-muted": "#a39b88", "--l-accent": "#d8b25c", "--l-accent-soft": "rgba(216,178,92,0.16)", "--l-pill": "#ffffff", "--l-pill-text": "#0b1020", "--l-sheet": "#121110" } },
  ocean: { label: "Deep Ocean", dark: true, vars: { "--l-bg": "#041418", "--l-glow": "rgba(32,201,190,0.24)", "--l-surface": "rgba(255,255,255,0.055)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#e9fbfa", "--l-muted": "#86b1b2", "--l-accent": "#3fd9cc", "--l-accent-soft": "rgba(63,217,204,0.15)", "--l-pill": "#ffffff", "--l-pill-text": "#0b1020", "--l-sheet": "#07222a" } },
  wine: { label: "Burgundy", dark: true, vars: { "--l-bg": "#14060b", "--l-glow": "rgba(214,59,96,0.26)", "--l-surface": "rgba(255,255,255,0.055)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#fdeef2", "--l-muted": "#b58a96", "--l-accent": "#f0678b", "--l-accent-soft": "rgba(240,103,139,0.16)", "--l-pill": "#ffffff", "--l-pill-text": "#0b1020", "--l-sheet": "#1f0b12" } },
  forest: { label: "Forest", dark: true, vars: { "--l-bg": "#05130b", "--l-glow": "rgba(66,200,115,0.22)", "--l-surface": "rgba(255,255,255,0.055)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#ecfaf1", "--l-muted": "#8fb59d", "--l-accent": "#58d58a", "--l-accent-soft": "rgba(88,213,138,0.15)", "--l-pill": "#ffffff", "--l-pill-text": "#0b1020", "--l-sheet": "#0a2013" } },
  plum: { label: "Plum", dark: true, vars: { "--l-bg": "#0d0716", "--l-glow": "rgba(150,90,255,0.28)", "--l-surface": "rgba(255,255,255,0.055)", "--l-surface-2": "rgba(255,255,255,0.09)", "--l-line": "rgba(255,255,255,0.10)", "--l-text": "#f4eeff", "--l-muted": "#a592c8", "--l-accent": "#a984ff", "--l-accent-soft": "rgba(169,132,255,0.16)", "--l-pill": "#ffffff", "--l-pill-text": "#0b1020", "--l-sheet": "#170d2a" } },
  ivory: { label: "Ivory (light)", dark: false, vars: { "--l-bg": "#f7f3ec", "--l-glow": "rgba(214,170,90,0.28)", "--l-surface": "rgba(255,255,255,0.85)", "--l-surface-2": "rgba(255,255,255,1)", "--l-line": "rgba(20,16,8,0.09)", "--l-text": "#1b1710", "--l-muted": "#7b7365", "--l-accent": "#a87a1f", "--l-accent-soft": "rgba(168,122,31,0.12)", "--l-pill": "#1b1710", "--l-pill-text": "#f7f3ec", "--l-sheet": "#fffdf8" } },
};
export const getLinkTheme = (id: string | null | undefined) => LINK_THEMES[(id as LinkTheme) in LINK_THEMES ? (id as LinkTheme) : "midnight"];

export type LinkSocials = Partial<Record<"instagram" | "facebook" | "zomato" | "swiggy" | "phone" | "maps" | "whatsapp" | "website", string>>;
export type LinkPhoto = { url: string; caption?: string; kind?: "image" | "video" };
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const isVideo = (p: { url: string; kind?: string }) => p.kind === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(p.url);
export type LinkButton = { label: string; url: string; icon: string };
export type LinkOutlet = { name: string; city?: string; address?: string; instagram?: string; image_url?: string; map_url?: string; phone?: string; whatsapp?: string; review_url?: string };
/** An offer of one outlet. `outlet` is the outlet name; empty means every outlet. */
export type LinkOffer = { outlet: string; title: string; details?: string; link?: string; valid_till?: string };
export type LinkReview = { author: string; rating: number; body: string; date?: string; avatar?: string };
export type LinkData = {
  id: string; slug: string; name: string; tagline: string | null; logo_url: string | null; theme: string; tags: string[];
  socials: LinkSocials; photos: LinkPhoto[]; photo_direction?: "forward" | "backward"; buttons: LinkButton[]; outlets: LinkOutlet[]; offers?: LinkOffer[]; reviews: LinkReview[];
};

export const BUTTON_ICONS = ["menu", "drink", "map", "mail", "phone", "globe", "calendar", "star", "gift", "bag", "outlets", "whatsapp", "zomato", "swiggy", "district", "link"] as const;
export const ICON_LABEL: Record<string, string> = { menu: "Food menu", drink: "Drinks", map: "Location", mail: "Contact", phone: "Call", globe: "Website", calendar: "Booking", star: "Reviews", gift: "Offers", bag: "Order", outlets: "Outlets", whatsapp: "WhatsApp", zomato: "Zomato", swiggy: "Swiggy", district: "District", link: "Link" };

/** wa.me link from any phone number a person types. A 10-digit Indian number gets 91 in front. */
/** Digits of an Indian mobile number from anything a person types: "+91 98765 43210", "098765 43210", "9876543210". Null when it is not 10 digits. */
export function indianNational(v: string | undefined | null): string | null {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** wa.me link. A 10-digit Indian number gets +91 in front; a number that already has another country code is kept. */
export function waLink(v: string | undefined | null): string | null {
  const raw = (v ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  const nat = indianNational(raw);
  return `https://wa.me/${nat ? "91" + nat : d}`;
}
export function telLink(v: string | undefined | null): string | null {
  const raw = (v ?? "").trim();
  if (!raw.replace(/\D/g, "")) return null;
  const nat = indianNational(raw);
  return nat ? `tel:+91${nat}` : `tel:${raw.replace(/[^\d+]/g, "")}`;
}
export const safeUrl = (v: string | undefined | null) => { const s = (v ?? "").trim(); return /^https?:\/\//i.test(s) || /^tel:|^mailto:/i.test(s) ? s : null; };

export const DEFAULT_BUTTONS: LinkButton[] = [
  { label: "Food Menu", url: "", icon: "menu" },
  { label: "Beverage Menu", url: "", icon: "drink" },
  { label: "Offers", url: "#offers", icon: "gift" },
  { label: "Our Outlets", url: "#outlets", icon: "outlets" },
  { label: "Contact Us", url: "", icon: "mail" },
];
