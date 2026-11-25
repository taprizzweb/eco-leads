/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Loader2, Lock, ImagePlus, Smartphone } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { linkUrl } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";

export type MiniState = { plan: string; published: boolean; paid_at: string | null; payment: { status: "pending" | "approved" | "rejected"; note: string | null; at: string } | null };
export type MiniSettings = { price: number; upi_id: string; upi_name: string; whatsapp: string };

const ERR: Record<string, string> = {
  "bad utr": "The transaction ID looks wrong. It is the 12-digit UTR in your UPI app, under the payment details.",
  "utr used": "That transaction ID was already used. Please check it in your UPI app.",
  "already pending": "Your payment is already waiting to be checked.",
  "too many tries": "Too many tries. Please message us on WhatsApp and we will help.",
  "bad proof": "The screenshot did not upload properly. Please try again.",
  "already live": "Your page is already live.",
};

/** Shows what is needed to put the page live: pay Rs 150 by UPI, send the screenshot, then wait for the check. */
export function MiniPublishCard({ token, slug, state, settings }: { token: string; slug: string; state: MiniState; settings: MiniSettings }) {
  const toast = useToast();
  const [st, setSt] = useState(state);
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = linkUrl(slug);
  const upi = settings.upi_id ? `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(settings.upi_name)}&am=${settings.price}&cu=INR&tn=${encodeURIComponent("Taprizz mini link " + slug)}` : "";
  const wa = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hi Taprizz, I need help with my mini link (${slug}).`)}`;

  useEffect(() => { if (upi) void QRCode.toDataURL(upi, { width: 300, margin: 1 }).then(setQr).catch(() => setQr(null)); }, [upi]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function refresh() {
    const { data } = await supabaseBrowser().rpc("mini_state", { p_token: token });
    if (data) setSt(data as MiniState);
  }

  async function submit() {
    const u = utr.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z0-9]{8,30}$/.test(u)) return toast("Type the transaction ID (UTR) from your UPI app. It is usually 12 digits.", true);
    if (!file) return toast("Attach the screenshot of your payment.", true);
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const blob = await toWebp(file, 1600);
      const path = `${token}/${crypto.randomUUID()}.webp`;
      const up = await sb.storage.from("pay-proofs").upload(path, blob, { contentType: "image/webp" });
      if (up.error) throw new Error("upload");
      const { error } = await sb.rpc("mini_submit_payment", { p_token: token, p_utr: u, p_proof: path });
      if (error) { const k = Object.keys(ERR).find((e) => error.message.includes(e)); throw new Error(k ? ERR[k] : "That did not send. Please try again."); }
      toast("Sent. We will check your payment now.");
      setUtr(""); setFile(null); setPreview(null);
      await refresh();
    } catch (e) {
      toast(e instanceof Error && e.message !== "upload" ? e.message : "The screenshot did not upload. Try a JPG or PNG.", true);
    } finally { setBusy(false); }
  }

  if (st.published) {
    return (
      <div className="d-card mb-4 space-y-3 p-5" style={{ boxShadow: "inset 0 0 0 1.5px var(--d-green)" }}>
        <p className="flex items-center gap-2 font-semibold"><Check size={18} style={{ color: "var(--d-green)" }} /> Your page is live</p>
        <p className="break-all text-sm"><a className="underline" href={url} target="_blank" rel="noopener">{url.replace(/^https?:\/\//, "")}</a></p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="d-btn d-btn-p" onClick={() => { void navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? <Check size={15} /> : <Copy size={15} />} Copy link</button>
          <a className="d-btn d-btn-s" href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener">Share on WhatsApp</a>
        </div>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Put it in your Instagram bio. You can keep editing below, and the page updates at once. Keep this control page private: whoever has its link can change your page.</p>
      </div>
    );
  }

  const pending = st.payment?.status === "pending";
  const rejected = st.payment?.status === "rejected";
  return (
    <div className="d-card mb-4 space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}><Lock size={18} /></span>
        <div>
          <h2 className="font-semibold">Your page is ready, but it is not live yet</h2>
          <p className="text-sm" style={{ color: "var(--d-muted)" }}>Build it below and see it on the right. To put it live for everyone, pay Rs {settings.price} once. No monthly fee.</p>
        </div>
      </div>

      {pending ? (
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
          <p className="font-semibold">We are checking your payment</p>
          <p className="mt-1" style={{ color: "var(--d-muted)" }}>This usually takes a few hours. Your page goes live as soon as we confirm it, and you do not need to do anything. Come back to this page to see it.</p>
          <div className="mt-3 flex gap-2"><button type="button" className="d-btn d-btn-s" onClick={() => void refresh()}>Check again</button><a className="d-btn d-btn-s" href={wa} target="_blank" rel="noopener">Message us</a></div>
        </div>
      ) : (
        <>
          {rejected && <p role="alert" className="rounded-xl p-3 text-sm" style={{ background: "color-mix(in srgb, var(--d-red) 14%, transparent)" }}>We could not confirm that payment{st.payment?.note ? `: ${st.payment.note}` : "."} Please check the details and send it again.</p>}
          <ol className="space-y-4 text-sm">
            <li>
              <p className="font-semibold">1. Pay Rs {settings.price} by UPI</p>
              {upi ? (
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {qr && (<img src={qr} alt={`UPI QR for Rs ${settings.price}`} width={160} height={160} className="rounded-xl bg-white p-2" />)}
                  <div className="space-y-2">
                    <a className="d-btn d-btn-p" href={upi}><Smartphone size={15} /> Pay with a UPI app</a>
                    <p style={{ color: "var(--d-muted)" }}>Or scan this QR from any UPI app.<br />UPI ID: <b style={{ color: "var(--d-text)" }}>{settings.upi_id}</b> ({settings.upi_name})<br />Amount: <b style={{ color: "var(--d-text)" }}>Rs {settings.price}</b></p>
                  </div>
                </div>
              ) : <p style={{ color: "var(--d-muted)" }}>Payment details are not set up yet. <a className="underline" href={wa} target="_blank" rel="noopener">Message us on WhatsApp</a>.</p>}
            </li>
            <li>
              <p className="font-semibold">2. Send us the proof</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="font-medium">Transaction ID (UTR)</span><input className="d-input mt-1.5" inputMode="text" autoComplete="off" maxLength={30} value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit number from your UPI app" /></label>
                <div>
                  <span className="font-medium">Screenshot of the payment</span>
                  <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; setFile(f); setPreview(f ? URL.createObjectURL(f) : null); }} />
                  <button type="button" className="d-btn d-btn-s mt-1.5" onClick={() => input.current?.click()}><ImagePlus size={15} /> {file ? "Change screenshot" : "Attach screenshot"}</button>
                  {preview && <img src={preview} alt="Your payment screenshot" className="mt-2 h-24 rounded-lg object-cover" />}
                </div>
              </div>
            </li>
            <li>
              <p className="font-semibold">3. Submit</p>
              <button type="button" className="d-btn d-btn-p mt-2" disabled={busy} onClick={() => void submit()}>{busy && <Loader2 size={15} className="animate-spin" />} Submit payment for checking</button>
              <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>We match the transaction ID with our bank. A wrong or reused ID is rejected, and you can send it again. If your page cannot go live, we refund you. <a className="underline" href="/create/terms" target="_blank">Terms and refund</a></p>
            </li>
          </ol>
        </>
      )}
    </div>
  );
}
