"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { QrCode, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

// Downloads a print-ready PNG for each plate (taprizz.in/e/<code>).
export function QrButton({ plates, base }: { plates: { code: string; label: string | null }[]; base: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function download() {
    if (!plates.length) { toast("No plates linked yet. Taprizz will add them for you.", true); return; }
    setBusy(true);
    try {
      for (const p of plates) {
        const url = await QRCode.toDataURL(`${base}/e/${p.code}`, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
        const a = document.createElement("a");
        a.href = url;
        a.download = `taprizz-${p.label?.replace(/\s+/g, "-").toLowerCase() || p.code}.png`;
        a.click();
      }
      toast(plates.length === 1 ? "QR code downloaded" : `${plates.length} QR codes downloaded`);
    } catch {
      toast("The QR code did not download. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={download} disabled={busy} className="d-btn d-btn-s">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />} Download QR
    </button>
  );
}
