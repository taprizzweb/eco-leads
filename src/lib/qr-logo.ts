"use client";

import QRCode from "qrcode";

const LOGO = "/brand/taprizz-logo.png";
let logo: Promise<HTMLImageElement> | null = null;
const loadLogo = () => (logo ??= new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = LOGO; }));

/**
 * A QR code with the small round Taprizz logo in the middle. The code is made with the highest error
 * correction, so the little logo never stops a phone from reading it. If the logo cannot load, the plain QR is returned.
 */
export async function qrDataUrl(text: string, o: { width?: number; margin?: number; dark?: string; light?: string } = {}): Promise<string> {
  const width = o.width ?? 512, light = o.light ?? "#ffffff";
  const c = document.createElement("canvas");
  await QRCode.toCanvas(c, text, { width, margin: o.margin ?? 2, errorCorrectionLevel: "H", color: { dark: o.dark ?? "#000000", light } });
  try {
    const img = await loadLogo();
    const ctx = c.getContext("2d");
    if (ctx) {
      const d = Math.round(c.width * 0.19), cx = c.width / 2, cy = c.height / 2;
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(cx, cy, d / 2 + c.width * 0.014, 0, Math.PI * 2); ctx.fill();   // a clear ring so no square touches the logo
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
      const h = d * 0.62, w = h * (img.naturalWidth / img.naturalHeight || 0.727);
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
  } catch { /* the plain code still works */ }
  return c.toDataURL("image/png");
}
