import type { ReactNode } from "react";
import { AtSign, Facebook, Ghost, Github, Linkedin, MapPin, MessageCircle, Mail, Music, Music2, Phone, Pin, Play, Send, ShoppingCart, Tv, Twitch } from "lucide-react";
import { BRAND, DistrictIcon, InstagramIcon, SwiggyIcon, WhatsappIcon, ZomatoIcon } from "@/components/guest/BrandIcons";

// A link added to the mini page gets the logo of the app it points to, picked from the web address (or from the name given to the button).
// Anything unknown keeps the generic link icon.

const XMark = ({ size = 16 }: { size?: number }) => (
  <svg role="img" aria-label="X" viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
);

const badge = (bg: string, fg: string, glyph: ReactNode, round = false) => (
  <span className={`grid h-7 w-7 place-items-center ${round ? "rounded-full" : "rounded-lg"}`} style={{ background: bg, color: fg }}>{glyph}</span>
);
const S = { size: 16, strokeWidth: 2.2 } as const;

type Rule = { name: string; hosts: string[]; label?: RegExp; paths?: RegExp; node: () => ReactNode };
const RULES: Rule[] = [
  { name: "instagram", hosts: ["instagram.com", "instagr.am"], label: /instagram/i, node: () => <InstagramIcon size={28} /> },
  { name: "facebook", hosts: ["facebook.com", "fb.com", "fb.me", "fb.watch"], label: /facebook/i, node: () => badge("#1877F2", "#fff", <Facebook {...S} />) },
  { name: "youtube", hosts: ["youtube.com", "youtu.be"], label: /youtube/i, node: () => badge("#FF0000", "#fff", <Play size={15} fill="currentColor" strokeWidth={0} />) },
  { name: "linkedin", hosts: ["linkedin.com", "lnkd.in"], label: /linked\s?in/i, node: () => badge("#0A66C2", "#fff", <Linkedin {...S} />) },
  { name: "x", hosts: ["x.com", "twitter.com", "t.co"], label: /^(x|twitter)$|twitter/i, node: () => badge("#000000", "#fff", <XMark size={15} />) },
  { name: "whatsapp", hosts: ["wa.me", "whatsapp.com", "api.whatsapp.com"], label: /whats\s?app/i, node: () => <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "#25D366", color: "#fff" }}><WhatsappIcon size={17} /></span> },
  { name: "telegram", hosts: ["t.me", "telegram.me", "telegram.org"], label: /telegram/i, node: () => badge("#26A5E4", "#fff", <Send size={15} strokeWidth={2.2} />, true) },
  { name: "tiktok", hosts: ["tiktok.com"], label: /tik\s?tok/i, node: () => badge("#000000", "#fff", <Music2 {...S} />) },
  { name: "snapchat", hosts: ["snapchat.com"], label: /snap\s?chat/i, node: () => badge("#FFFC00", "#000", <Ghost {...S} />) },
  { name: "pinterest", hosts: ["pinterest.com", "pin.it"], label: /pinterest/i, node: () => badge("#E60023", "#fff", <Pin {...S} />, true) },
  { name: "threads", hosts: ["threads.net", "threads.com"], label: /threads/i, node: () => badge("#000000", "#fff", <AtSign {...S} />) },
  { name: "spotify", hosts: ["spotify.com", "open.spotify.com", "spoti.fi"], label: /spotify/i, node: () => badge("#1DB954", "#000", <Music {...S} />, true) },
  { name: "maps", hosts: ["maps.app.goo.gl", "maps.google.com", "goo.gl"], paths: /^\/maps/i, label: /(google\s)?maps|directions|location/i, node: () => badge("#EA4335", "#fff", <MapPin {...S} />, true) },
  { name: "zomato", hosts: ["zomato.com", "zoma.to"], label: /zomato/i, node: () => <span className="grid h-6 w-9 place-items-center rounded-md" style={{ background: BRAND.zomato.bg, color: BRAND.zomato.fg }}><ZomatoIcon size={15} /></span> },
  { name: "swiggy", hosts: ["swiggy.com", "swiggy.in"], label: /swiggy/i, node: () => <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: BRAND.swiggy.bg, color: BRAND.swiggy.fg }}><SwiggyIcon size={17} /></span> },
  { name: "district", hosts: ["district.in"], label: /district/i, node: () => <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: BRAND.district.bg, color: BRAND.district.fg }}><DistrictIcon size={17} /></span> },
  { name: "github", hosts: ["github.com"], label: /github/i, node: () => badge("#181717", "#fff", <Github {...S} />) },
  { name: "discord", hosts: ["discord.com", "discord.gg"], label: /discord/i, node: () => badge("#5865F2", "#fff", <MessageCircle {...S} />) },
  { name: "twitch", hosts: ["twitch.tv"], label: /twitch/i, node: () => badge("#9146FF", "#fff", <Twitch {...S} />) },
  { name: "reddit", hosts: ["reddit.com", "redd.it"], label: /reddit/i, node: () => badge("#FF4500", "#fff", <MessageCircle {...S} />, true) },
  { name: "amazon", hosts: ["amazon.in", "amazon.com", "amzn.to", "amzn.in"], label: /amazon/i, node: () => badge("#FF9900", "#000", <ShoppingCart {...S} />) },
  { name: "flipkart", hosts: ["flipkart.com", "fkrt.it"], label: /flipkart/i, node: () => badge("#2874F0", "#FFE500", <ShoppingCart {...S} />) },
  { name: "ott", hosts: ["netflix.com", "hotstar.com", "primevideo.com"], label: /netflix|hotstar|prime video/i, node: () => badge("#E50914", "#fff", <Tv {...S} />) },
];

const parse = (url: string): { host: string; path: string } | null => {
  try { const u = new URL(url); return { host: u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, ""), path: u.pathname }; } catch { return null; }
};

/** Which app a link belongs to. The address decides first; the button's name is only a backup for links that hide the address. */
export function matchBrand(url: string, label = ""): string | null {
  if (url.startsWith("mailto:")) return "mail";
  if (url.startsWith("tel:")) return "phone";
  const p = parse(url);
  if (p) {
    for (const r of RULES) {
      const hostHit = r.hosts.some((h) => p.host === h || p.host.endsWith(`.${h}`));
      const pathOk = !r.paths || p.host !== "goo.gl" || r.paths.test(p.path);
      if (hostHit && pathOk) return r.name;
    }
    if (p.host === "google.com" && /^\/maps/i.test(p.path)) return "maps";
  }
  // A known name on a link shortener or custom address still gets its logo, unless the address clearly belongs to another app.
  const named = RULES.find((r) => r.label?.test(label.trim()));
  if (!named) return null;
  const otherApp = p && RULES.some((r) => r.hosts.some((h) => p.host === h || p.host.endsWith(`.${h}`)));
  return otherApp ? null : named.name;
}

/** The logo for a link, or null when the app is not one we know. */
export function brandFor(url: string, label = ""): ReactNode | null {
  const k = matchBrand(url, label);
  if (k === "mail") return badge("#EA4335", "#fff", <Mail {...S} />);
  if (k === "phone") return badge("#16A34A", "#fff", <Phone {...S} />, true);
  return k ? RULES.find((r) => r.name === k)?.node() ?? null : null;
}
