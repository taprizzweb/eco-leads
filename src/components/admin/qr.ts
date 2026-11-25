import { qrDataUrl } from "@/lib/qr-logo";
import { PLATE_BASE } from "@/lib/features";

/** Downloads a print-ready PNG of the plate link (taprizz.in/e/<code>). */
export async function downloadQr(code: string, label?: string | null) {
  const url = await qrDataUrl(`${PLATE_BASE}/e/${code}`, { width: 1024, margin: 2 });
  const a = document.createElement("a");
  a.href = url;
  a.download = `taprizz-${(label || code).replace(/\s+/g, "-").toLowerCase()}.png`;
  a.click();
}

/** Downloads a print-ready PNG of any web address, for a standee or a table. */
export async function downloadUrlQr(url: string, name: string) {
  const data = await qrDataUrl(url, { width: 1024, margin: 2 });
  const a = document.createElement("a");
  a.href = data;
  a.download = `taprizz-${name.replace(/\s+/g, "-").toLowerCase()}.png`;
  a.click();
}
