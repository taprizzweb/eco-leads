import QRCode from "qrcode";
import { PLATE_BASE } from "@/lib/features";

/** Downloads a print-ready PNG of the plate link (taprizz.in/e/<code>). */
export async function downloadQr(code: string, label?: string | null) {
  const url = await QRCode.toDataURL(`${PLATE_BASE}/e/${code}`, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
  const a = document.createElement("a");
  a.href = url;
  a.download = `taprizz-${(label || code).replace(/\s+/g, "-").toLowerCase()}.png`;
  a.click();
}
