/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { qrDataUrl } from "@/lib/qr-logo";
import { Check, Copy, Crown, Loader2, ImagePlus, Smartphone } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { linkUrl } from "@/lib/features";
import { FREE_PERKS, PREMIUM_PERKS } from "@/lib/mini";
import { useToast } from "@/components/dash/Toast";

export type MiniState = { plan: string; published: boolean; paid_at: string | null; premium: boolean; payment: { status: "pending" | "approved" | "rejected"; note: string | null; at: string } | null };
export type MiniSettings = { price: number; upi_id: string; upi_name: string; whatsapp: string };

const ERR: Record<string, string> = {
  "bad utr": "The transaction ID looks wrong. It is the 12-digit UTR in your UPI app, under the payment details.",
  "utr used": "That transaction ID was already used. Please check it in your UPI app.",
  "already pending": "Your payment is already waiting to be checked.",
  "too many tries": "Too many tries. Please message us on WhatsApp and we will help.",
  "bad proof": "The screenshot did not upload properly. Please try again.",
  "already live": "Your page is already Premium.",
};

/** The top of the editor: the page is live for free; Premium is one UPI payment away. */
export function MiniPlanCard({ token, slug, state, settings }: { token: string; slug: string; state: MiniState; settings: MiniSettings }) {
  const toast = useToast();
  const [st, setSt] = useState(state);
  const [open, setOpen] = useState(false);
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = linkUrl(slug);
  const upi = settings.upi_id ? `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(settings.upi_name)}&am=${settings.price}&cu=INR&tn=${encodeURIComponent("Taprizz Premium " + slug)}` : "";
  const wa = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hi Taprizz, I have a question about my mini link (${slug}).`)}`;

  useEffect(() => { if (upi && open) void qrDataUrl(upi, { width: 300, margin: 1 }).then(setQr).catch(() => setQr(null)); }, [upi, open]);
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

  const copyLink = () => { void navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const share = <a className="d-btn d-btn-s" href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener">Share on WhatsApp</a>;

  if (st.premium) {
    return (
      <div className="d-card mb-4 space-y-3 p-5" style={{ boxShadow: "inset 0 0 0 1.5px var(--d-green)" }}>
        <p className="flex items-center gap-2 font-semibold"><Crown size={18} style={{ color: "var(--d-green)" }} /> Premium is on. Your page is live.</p>
        <p className="break-all text-sm"><a className="underline" href={url} target="_blank" rel="noopener">{url.replace(/^https?:\/\//, "")}</a></p>
        <div className="flex flex-wrap gap-2"><button type="button" className="d-btn d-btn-p" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />} Copy link</button>{share}</div>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Put it in your Instagram bio. Videos, offers, keywords and more links are open for you below. Keep this control page private: whoever has its link can change your page.</p>
      </div>
    );
  }

  const pending = st.payment?.status === "pending";
  const rejected = st.payment?.status === "rejected";
  return (
    <div className="mb-4 space-y-3">
      <div className="d-card space-y-3 p-5" style={{ boxShadow: "inset 0 0 0 1.5px var(--d-green)" }}>
        <p className="flex items-center gap-2 font-semibold"><Check size={18} style={{ color: "var(--d-green)" }} /> Your free page is live</p>
        <p className="break-all text-sm"><a className="underline" href={url} target="_blank" rel="noopener">{url.replace(/^https?:\/\//, "")}</a></p>
        <div className="flex flex-wrap gap-2"><button type="button" className="d-btn d-btn-p" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />} Copy link</button>{share}</div>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Put this link in your Instagram bio. Bookmark this page, it is the only way back to your editor. Keep it private: whoever has its link can change your page.</p>
      </div>

      <div className="d-card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}><Crown size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Want more? Go Premium for Rs {settings.price}, once</h2>
            <p className="text-sm" style={{ color: "var(--d-muted)" }}>Videos, more photos, offers, a keywords line and more links. No monthly fee.</p>
          </div>
          <button type="button" className="d-btn d-btn-s shrink-0" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Close" : "See what you get"}</button>
        </div>

        {open && (
          <>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl p-4" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
                <p className="font-semibold">Free (what you have now)</p>
                <ul className="mt-2 space-y-1.5">{FREE_PERKS.map((p) => <li key={p} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--d-muted)" }} />{p}</li>)}</ul>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 2px var(--d-green)" }}>
                <p className="font-semibold">Premium, Rs {settings.price} once</p>
                <ul className="mt-2 space-y-1.5">{PREMIUM_PERKS.map((p) => <li key={p} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--d-green)" }} />{p}</li>)}</ul>
              </div>
            </div>
            <div className="rounded-xl p-4 text-sm" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
              <p className="font-semibold">Your link is the front door. Taprizz can do more behind it.</p>
              <p className="mt-1" style={{ color: "var(--d-muted)" }}>More Google reviews: guests pick what they liked and get a review draft in three taps. Private feedback that reaches you first. Your menu, offers, outlets and Instagram, all in one place. Many Jaipur cafes already use this.</p>
              <div className="mt-3 flex flex-wrap gap-2"><a className="d-btn d-btn-s" href="/create/premium" target="_blank" rel="noopener">See the full story</a><a className="d-btn d-btn-s" href={wa} target="_blank" rel="noopener">Talk to us on WhatsApp</a></div>
            </div>

            {pending ? (
              <div className="rounded-xl p-4 text-sm" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
                <p className="font-semibold">We are checking your payment</p>
                <p className="mt-1" style={{ color: "var(--d-muted)" }}>This usually takes a few hours. Premium opens as soon as we confirm it. Your free page stays live meanwhile.</p>
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
                        {qr && <img src={qr} alt={`UPI QR for Rs ${settings.price}`} width={160} height={160} className="rounded-xl bg-white p-2" />}
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
                      <label className="block"><span className="font-medium">Transaction ID (UTR)</span><input className="d-input mt-1.5" autoComplete="off" maxLength={30} value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit number from your UPI app" /></label>
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
                    <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>We match the transaction ID with our bank. A wrong or reused ID is rejected, and you can send it again. If we cannot unlock Premium, we refund you. <a className="underline" href="/create/terms" target="_blank">Terms and refund</a></p>
                  </li>
                </ol>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
