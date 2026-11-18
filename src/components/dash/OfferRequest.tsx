"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mentionsReviews } from "@/lib/creators";
import { useToast } from "./Toast";

export type MyReq = { id: string; message: string; image_url: string | null; audience_kind: "recent" | "not_returned" | "all"; audience_days: number; status: "pending" | "approved" | "rejected" | "sent"; admin_note: string | null; recipient_count: number | null; created_at: string };
const MAX = 1000;
const MAX_IMG = 5 * 1024 * 1024;
const AUD: { id: string; label: string; kind: MyReq["audience_kind"]; days: number }[] = [
  { id: "r30", label: "Customers from the last 30 days", kind: "recent", days: 30 },
  { id: "r45", label: "Customers from the last 45 days", kind: "recent", days: 45 },
  { id: "n30", label: "Customers who did not come back (30 days)", kind: "not_returned", days: 30 },
  { id: "n45", label: "Customers who did not come back (45 days)", kind: "not_returned", days: 45 },
  { id: "all", label: "All customers who said yes to offers", kind: "all", days: 30 },
];
const STATUS: Record<MyReq["status"], { text: string; color: string }> = {
  pending: { text: "Waiting for approval", color: "var(--d-amber)" },
  approved: { text: "Approved, going out", color: "var(--d-green)" },
  sent: { text: "Sent", color: "var(--d-blue)" },
  rejected: { text: "Not approved", color: "var(--d-red)" },
};

export function OfferRequest({ clientId, businessName, initial }: { clientId: string; businessName: string; initial: MyReq[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [aud, setAud] = useState("r30");
  const [img, setImg] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState(initial);
  const a = AUD.find((x) => x.id === aud)!;

  useEffect(() => {
    setCount(null);
    sb.rpc("wa_audience_count", { p_client: clientId, p_kind: a.kind, p_days: a.days }).then(({ data }) => setCount(typeof data === "number" ? data : null));
  }, [sb, clientId, a.kind, a.days]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(f.type)) return setErr("Please choose a JPG, PNG or WebP image.");
    if (f.size > MAX_IMG) return setErr("That image is over 5 MB. Please use a smaller one.");
    setErr("");
    setImg(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    const text = message.trim();
    if (!text) return setErr("Write your offer message first.");
    if (text.length > MAX) return setErr(`Keep the message within ${MAX} characters.`);
    if (mentionsReviews(text)) return setErr("Please do not mention Google or reviews in an offer. Nothing can be offered in return for a review.");
    setBusy(true);
    setErr("");
    let url: string | null = null;
    if (img) {
      const ext = img.type === "image/png" ? "png" : img.type === "image/webp" ? "webp" : "jpg";
      const path = `${clientId}/wa/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("page-assets").upload(path, img, { contentType: img.type });
      if (error) { setBusy(false); return setErr("The image did not upload. Try again."); }
      url = sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await sb.from("wa_requests").insert({ client_id: clientId, message: text, image_url: url, audience_kind: a.kind, audience_days: a.days }).select("id, message, image_url, audience_kind, audience_days, status, admin_note, recipient_count, created_at").single();
    setBusy(false);
    if (error || !data) return setErr("That did not send. Please try again.");
    setMine((m) => [data as MyReq, ...m]);
    setMessage(""); setImg(null); setPreview(null);
    toast("Sent to Taprizz for approval");
    router.refresh();
  }

  async function cancel(id: string) {
    const { error } = await sb.from("wa_requests").delete().eq("id", id);
    if (error) return toast("That could not be cancelled.", true);
    setMine((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="d-card space-y-4 p-5">
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Your message</span>
          <textarea className="d-input mt-1.5" rows={6} maxLength={MAX} value={message} onChange={(e) => { setMessage(e.target.value); setErr(""); }} placeholder={`Hi! This weekend at ${businessName}, ...`} />
          <span className="mt-1 block text-right text-xs tabular-nums" style={{ color: message.length > MAX - 50 ? "var(--d-amber)" : "var(--d-muted)" }}>{message.length} of {MAX}</span>
        </label>
        <div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          {preview ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Poster preview" className="max-h-40 rounded-xl object-contain" />
              <button type="button" className="d-btn d-btn-s" onClick={() => { setImg(null); setPreview(null); }}><Trash2 size={15} /> Remove</button>
            </div>
          ) : <button type="button" className="d-btn d-btn-s" onClick={() => file.current?.click()}><ImagePlus size={16} /> Add a poster (optional)</button>}
          <p className="mt-1.5 text-xs" style={{ color: "var(--d-muted)" }}>The poster goes out with your message. JPG, PNG or WebP, up to 5 MB.</p>
        </div>
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Who should get it</span>
          <select className="d-input mt-1.5" value={aud} onChange={(e) => setAud(e.target.value)}>{AUD.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          <span className="mt-1 block text-xs" style={{ color: "var(--d-muted)" }}>{count === null ? "Counting..." : `About ${count} customers. Only guests who said yes to WhatsApp offers are included.`}</span>
        </label>
        {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
        <button className="d-btn d-btn-p" disabled={busy} onClick={submit}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send for approval</button>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Your requests</h2>
        {mine.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>Nothing sent yet.</p> : (
          <div className="space-y-3">
            {mine.map((r) => (
              <article key={r.id} className="d-card space-y-2 p-4">
                <div className="flex items-center gap-2"><span className="text-sm font-medium" style={{ color: STATUS[r.status].color }}>{STATUS[r.status].text}</span><span className="ml-auto text-xs" style={{ color: "var(--d-muted)" }}>{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="max-h-32 rounded-lg object-contain" />
                )}
                <p className="whitespace-pre-wrap text-[15px]" style={{ color: "var(--d-text)" }}>{r.message}</p>
                {r.status === "rejected" && r.admin_note && <p className="text-sm" style={{ color: "var(--d-sub)" }}>Note from Taprizz: {r.admin_note}</p>}
                {(r.status === "approved" || r.status === "sent") && r.recipient_count != null && <p className="text-xs" style={{ color: "var(--d-muted)" }}>For {r.recipient_count} customers</p>}
                {r.status === "pending" && <button className="d-btn d-btn-s" onClick={() => cancel(r.id)}>Cancel request</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
