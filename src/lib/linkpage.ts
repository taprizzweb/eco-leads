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
/** Colours a person picks freely. Each one is optional; an empty one keeps the template's own colour. */
export type LinkColors = { bg?: string; accent?: string; button?: string };
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex = (c: number[]) => "#" + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
const rgba = (h: string, a: number) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
/** Perceived brightness from 0 (black) to 1 (white). */
export const lightness = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/** The template's colours with the person's own background, accent and button colours laid on top. Text colour is chosen so it always reads. */
export function getLinkTheme(id: string | null | undefined, colors?: LinkColors | null) {
  const base = LINK_THEMES[(id as LinkTheme) in LINK_THEMES ? (id as LinkTheme) : "midnight"];
  const bg = isHex(colors?.bg) ? colors!.bg! : null;
  const accentIn = isHex(colors?.accent) ? colors!.accent! : null;
  const buttonIn = isHex(colors?.button) ? colors!.button! : null;
  if (!bg && !accentIn && !buttonIn) return base;
  const vars: Record<string, string> = { ...base.vars };
  let dark = base.dark;
  if (bg) {
    dark = lightness(bg) < 0.4;
    const text = dark ? "#f4f4f7" : "#17140e";
    Object.assign(vars, {
      "--l-bg": bg, "--l-text": text, "--l-muted": mix(text, bg, 0.42),
      "--l-surface": dark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.85)", "--l-surface-2": dark ? "rgba(255,255,255,0.09)" : "#ffffff",
      "--l-line": dark ? "rgba(255,255,255,0.10)" : "rgba(20,16,8,0.09)", "--l-sheet": dark ? mix(bg, "#ffffff", 0.06) : mix(bg, "#ffffff", 0.7),
      "--l-pill": dark ? "#ffffff" : text, "--l-pill-text": dark ? "#0b1020" : bg,
    });
    if (!accentIn) vars["--l-accent"] = dark ? mix(bg, "#ffffff", 0.8) : mix(bg, "#000000", 0.7);
  }
  const accent = accentIn ?? vars["--l-accent"];
  if (accentIn) vars["--l-accent"] = accentIn;
  if (accentIn || bg) { vars["--l-glow"] = rgba(accent, 0.3); vars["--l-accent-soft"] = rgba(accent, 0.16); }
  if (buttonIn) { vars["--l-pill"] = buttonIn; vars["--l-pill-text"] = lightness(buttonIn) > 0.45 ? "#111111" : "#ffffff"; }
  return { label: base.label, dark, vars };
}

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
  id: string; slug: string; name: string; tagline: string | null; logo_url: string | null; theme: string; colors?: LinkColors; seo_keywords?: string[]; tags: string[];
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
