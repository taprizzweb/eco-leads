"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// "Install app": a real install on Android phones and on Chrome / Edge on a laptop. iPhone has no install button, so it gets the two taps to do instead.
export function InstallApp({ className = "", compact = false, style }: { className?: string; compact?: boolean; style?: React.CSSProperties }) {
  const [evt, setEvt] = useState<Prompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    const on = (e: Event) => { e.preventDefault(); setEvt(e as Prompt); };
    const done = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed || (!evt && !ios)) return null;

  async function go() {
    if (evt) { await evt.prompt(); await evt.userChoice.catch(() => null); setEvt(null); } else setHelp(true);
  }

  return (
    <>
      <button type="button" onClick={go} aria-label="Install the Taprizz app" title="Install the Taprizz app" className={className || "d-btn d-btn-s"} style={style}>
        <Download size={16} aria-hidden />{!compact && " Install app"}
      </button>
      {help && (
        <div role="dialog" aria-label="Install on iPhone" className="fixed inset-x-3 bottom-4 z-[60] mx-auto max-w-sm rounded-2xl p-4 shadow-2xl" style={{ background: "var(--d-surface, #1a1a1b)", color: "var(--d-text, #f2f2f2)", boxShadow: "inset 0 0 0 1px var(--d-line-2, rgba(255,255,255,0.12)), 0 20px 60px rgba(0,0,0,0.6)" }}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">Install Taprizz on your iPhone</p>
            <button type="button" aria-label="Close" onClick={() => setHelp(false)} className="grid h-8 w-8 place-items-center"><X size={16} /></button>
          </div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm" style={{ color: "var(--d-sub, #cfcfd2)" }}>
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap the <b>Share</b> button <Share size={14} className="inline" aria-hidden /> at the bottom.</li>
            <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          </ol>
        </div>
      )}
    </>
  );
}
