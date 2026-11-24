// Picks page colours from a logo, in the browser. Nothing is uploaded; the image is read on a small canvas.
import { lightness } from "@/lib/linkpage";

export type Palette = { name: string; bg: string; accent: string; button: string };
type Hsl = [number, number, number]; // hue 0-360, saturation 0-1, lightness 0-1

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function toHsl(r: number, g: number, b: number): Hsl {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function toHex([h, s, l]: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

/** The main colours of an image, most important first. Transparent, near-white and near-black pixels count for little. */
export function dominantColors(px: Uint8ClampedArray | number[]): Hsl[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2];
    bins.set(key, e);
  }
  const cands = [...bins.values()].map((e) => {
    const hsl = toHsl(e.r / e.n, e.g / e.n, e.b / e.n);
    const [, s, l] = hsl;
    // Colourful, mid-light colours are the brand. Whites and blacks are background, so they score low.
    const w = l > 0.93 || l < 0.07 ? 0.05 : 0.25 + s;
    return { hsl, score: e.n * w };
  }).sort((a, b) => b.score - a.score);
  const out: Hsl[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    const far = out.every((o) => { const dh = Math.min(Math.abs(o[0] - c.hsl[0]), 360 - Math.abs(o[0] - c.hsl[0])); return dh > 28 || Math.abs(o[2] - c.hsl[2]) > 0.3; });
    if (far && c.score > 0) out.push(c.hsl);
  }
  return out;
}

/** A few ready-made looks built from the logo's colours. */
export function palettesFrom(cols: Hsl[]): Palette[] {
  if (!cols.length) return [];
  const [h, s0] = cols[0];
  const grey = s0 < 0.08; // a black, white or grey logo stays neutral instead of getting a tint
  const sat = (v: number, lo: number, hi: number) => (grey ? 0 : clamp(v, lo, hi));
  const brandMid = toHex([h, sat(s0, 0.35, 0.9), 0.5]);
  const brandBright = toHex([h, sat(s0, 0.4, 1), 0.62]);
  const brandDeep = toHex([h, sat(s0, 0.3, 0.8), 0.2]);
  const out: Palette[] = [
    { name: "Dark with your colour", bg: toHex([h, sat(s0, 0, 0.55), 0.08]), accent: brandBright, button: "#ffffff" },
    { name: "Light and clean", bg: toHex([h, sat(s0, 0, 0.6), 0.95]), accent: brandMid, button: brandDeep },
    { name: "Your colour, bold", bg: toHex([h, sat(s0, 0.35, 0.9), 0.34]), accent: toHex([h, sat(s0, 0.4, 1), 0.7]), button: "#ffffff" },
    { name: "Black with your buttons", bg: "#0a0a0b", accent: brandBright, button: brandMid },
  ];
  // A second colour only counts when it is a real colour, not a grey or a faded edge.
  const second = cols.slice(1).find((c) => c[1] >= 0.3 && c[2] > 0.15 && c[2] < 0.85);
  if (second && !grey) {
    const sec = toHex([second[0], clamp(second[1], 0.4, 0.95), 0.58]);
    out.push({ name: "Both logo colours", bg: toHex([h, sat(s0, 0, 0.55), 0.09]), accent: sec, button: sec });
  }
  // Drop a look whose button would vanish into its own background.
  return out.filter((p) => Math.abs(lightness(p.bg) - lightness(p.button)) > 0.12);
}

/** Reads a logo (a file just chosen, or an address) and returns looks built from it. Throws when the image cannot be read. */
export async function logoPalettes(src: Blob | string): Promise<Palette[]> {
  const blob = typeof src === "string" ? await (await fetch(src, { mode: "cors" })).blob() : src;
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, 80 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return palettesFrom(dominantColors(ctx.getImageData(0, 0, w, h).data));
}
