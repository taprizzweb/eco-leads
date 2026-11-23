"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, MessageCircle, Share, SquarePlus } from "lucide-react";

type Evt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** The page staff open to put the app on their phone: one Install button where the phone allows it, clear steps where it does not. */
export function InstallScreen({ link }: { link: string }) {
  const [evt, setEvt] = useState<Evt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as Evt); };
    const onDone = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt); window.addEventListener("appinstalled", onDone);
    QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setQr).catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onDone); };
  }, [link]);

  const copy = () => navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  const card = "rounded-2xl p-5 ring-1 ring-white/10";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-10" style={{ background: "#0f0f10", color: "#f2f2f2" }}>
      <header className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={84} height={84} className="mx-auto rounded-[22px]" />
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Get the Taprizz app</h1>
        <p className="mt-1 text-[15px] opacity-70">Orders, table requests and chat alerts on your phone. No app store needed.</p>
      </header>

      {installed ? (
        <section className={card} style={{ background: "#16a34a22" }}>
          <p className="flex items-center gap-2 font-semibold"><Check size={18} /> The app is already on this device</p>
          <a href="/app" className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-white font-semibold text-black">Open the app</a>
        </section>
      ) : evt ? (
        <button type="button" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setInstalled(true); setEvt(null); }} className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-white text-[17px] font-semibold text-black">
          <Download size={20} /> Install the app
        </button>
      ) : ios ? (
        <section className={card} style={{ background: "#1a1a1b" }}>
          <p className="font-semibold">On iPhone, in 3 steps</p>
          <ol className="mt-3 space-y-3 text-[15px]">
            <li className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">1</span><span>Open this page in <b>Safari</b>.</span></li>
            <li className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">2</span><span>Tap the <b>Share</b> button <Share size={15} className="inline" aria-label="Share" /> at the bottom.</span></li>
            <li className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">3</span><span>Choose <b>Add to Home Screen</b> <SquarePlus size={15} className="inline" aria-label="Add" />, then <b>Add</b>. Open it from the Home Screen.</span></li>
          </ol>
        </section>
      ) : (
        <section className={card} style={{ background: "#1a1a1b" }}>
          <p className="font-semibold">Install from your browser</p>
          <p className="mt-2 text-[15px] opacity-80">In <b>Chrome</b>, tap the menu (three dots) and choose <b>Install app</b> or <b>Add to Home screen</b>. On a computer, use the install icon at the right of the address bar.</p>
        </section>
      )}

      <section className={card} style={{ background: "#1a1a1b" }} aria-label="Share the link">
        <p className="font-semibold">Send this link to your team</p>
        <p className="mt-1 break-all text-sm opacity-70">{link}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={copy} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/10 font-semibold">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Install the Taprizz app: ${link}`)}`} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] font-semibold text-black"><MessageCircle size={16} /> WhatsApp</a>
        </div>
        {qr && (
          <div className="mt-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code of the app link" width={180} height={180} className="mx-auto rounded-xl bg-white p-2" />
            <p className="mt-2 text-xs opacity-60">Or scan this with the phone camera.</p>
          </div>
        )}
      </section>

      <p className="text-center text-xs opacity-60">After installing, sign in with the Google account the owner added. Then turn on alerts with the bell at the top.</p>
    </main>
  );
}
