"use client";

import { useState } from "react";
import { Star, Copy, RefreshCw, Trash2, Check, Loader2, ExternalLink, Info } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/dash-time";
import { useToast } from "./Toast";

type Review = { id: string; author: string; rating: number; body: string | null; reply_draft: string | null; replied_at: string | null; show_on_page: boolean; created_at: string };
type Draft = { id: string; rating: number; answers: { chips?: string[]; company?: string; recommend?: string; qa?: { label: string; values: string[] }[]; extra?: string } | null; draft: string | null; copied: boolean; plate_code: string | null; created_at: string };

const Stars = ({ n, size = 15 }: { n: number; size?: number }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`${n} stars`}>
    {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={size} className={s <= n ? "fill-amber-400 text-amber-400" : ""} style={s <= n ? undefined : { color: "var(--d-line-2)" }} />)}
  </span>
);

export function ReviewsBoard({ clientId, reviews: r0, drafts, stats, replyMode, labels }: {
  clientId: string; reviews: Review[]; drafts: Draft[]; stats: { drafts: number; copied: number };
  replyMode: string; labels: Record<string, string>;
}) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [reviews, setReviews] = useState(r0);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  const [f, setF] = useState({ author: "", rating: 0, text: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function call(body: Record<string, unknown>) {
    const res = await fetch("/api/review-reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
    return j as { id: string; reply: string };
  }

  async function suggest() {
    if (!f.rating) return setErr("Tap the star rating the guest gave.");
    if (!f.text.trim()) return setErr("Paste the review text.");
    setBusy("new"); setErr("");
    try {
      const j = await call({ author: f.author, rating: f.rating, text: f.text });
      setReviews((s) => [{ id: j.id, author: f.author || "Guest", rating: f.rating, body: f.text.trim(), reply_draft: j.reply, replied_at: null, show_on_page: false, created_at: new Date().toISOString() }, ...s]);
      setF({ author: "", rating: 0, text: "" });
      toast("Reply ready. Edit it, copy it, then post it on Google.");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  async function regenerate(r: Review) {
    setBusy(r.id);
    try {
      const j = await call({ id: r.id, author: r.author, rating: r.rating, text: r.body ?? "" });
      setReviews((s) => s.map((x) => (x.id === r.id ? { ...x, reply_draft: j.reply } : x)));
      toast("New reply written");
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(null); }
  }

  async function patch(r: Review, p: Partial<Review>, done: string) {
    const { error } = await sb.from("google_reviews").update(p).eq("id", r.id);
    if (error) return toast("That change did not save. Please try again.", true);
    setReviews((s) => s.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
    toast(done);
  }

  async function remove(r: Review) {
    const { error } = await sb.from("google_reviews").delete().eq("id", r.id);
    if (error) return toast("The review was not removed.", true);
    setReviews((s) => s.filter((x) => x.id !== r.id));
    toast("Review removed");
  }

  const shown = reviews.filter((r) => filter === "all" || (filter === "todo" ? !r.replied_at : !!r.replied_at));
  const todo = reviews.filter((r) => !r.replied_at).length;

  return (
    <div className="space-y-6">
      <section className="d-card p-5" aria-labelledby="paste">
        <h2 id="paste" className="font-semibold">Reply to a Google review</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Paste a review from your Google Business Profile. We write a reply you can edit, copy and post.</p>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); suggest(); }} noValidate>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Reviewer name</span>
              <input className="d-input mt-1.5" value={f.author} maxLength={80} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="Ananya S." /></label>
            <fieldset className="text-sm"><legend className="font-medium" style={{ color: "var(--d-text)" }}>Stars</legend>
              <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} role="radio" aria-checked={f.rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => { setF({ ...f, rating: n }); setErr(""); }} className="grid h-11 w-11 place-items-center rounded-lg" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
                    <Star size={20} className={n <= f.rating ? "fill-amber-400 text-amber-400" : ""} style={n <= f.rating ? undefined : { color: "var(--d-muted)" }} />
                  </button>
                ))}
              </div></fieldset>
          </div>
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Review</span>
            <textarea className="d-input mt-1.5" rows={4} maxLength={2000} value={f.text} onChange={(e) => { setF({ ...f, text: e.target.value }); setErr(""); }} placeholder="Paste what the guest wrote on Google" /></label>
          {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
          <button className="d-btn d-btn-p" disabled={busy === "new"}>{busy === "new" && <Loader2 size={16} className="animate-spin" />} {busy === "new" ? "Writing the reply" : "Write a reply"}</button>
        </form>
        <p className="mt-4 flex gap-2 text-xs" style={{ color: "var(--d-muted)" }}><Info size={14} className="mt-0.5 shrink-0" />
          {replyMode === "copy" ? "Your plan copies the reply: paste it under the review on Google." : "One-click posting and automatic fetching switch on once Google approves our access. Until then, copy the reply and paste it under the review on Google."}
        </p>
      </section>

      <section aria-labelledby="list">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="list" className="font-semibold">Your reviews {todo > 0 && <span className="d-chip ml-1" style={{ ["--c" as string]: "var(--d-amber)" }}>{todo} to reply</span>}</h2>
          <div className="d-seg" role="group" aria-label="Filter">
            {([["all", "All"], ["todo", "To reply"], ["done", "Replied"]] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>{reviews.length ? "Nothing in this view." : "No reviews yet. Paste your first Google review above and we write the reply."}</div>
        ) : (
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id} className="d-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium" style={{ color: "var(--d-text)" }}>{r.author}</span><Stars n={r.rating} />
                  <span className="text-xs" style={{ color: "var(--d-muted)" }}>{timeAgo(r.created_at)}</span>
                  {r.replied_at && <span className="d-chip" style={{ ["--c" as string]: "var(--d-green)" }}><Check size={11} /> Replied</span>}
                </div>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--d-sub)" }}>{r.body}</p>
                <label className="mt-3 block text-xs font-medium" style={{ color: "var(--d-muted)" }} htmlFor={`rp-${r.id}`}>Suggested reply</label>
                <textarea id={`rp-${r.id}`} className="d-input mt-1" rows={3} value={r.reply_draft ?? ""} onChange={(e) => setReviews((s) => s.map((x) => (x.id === r.id ? { ...x, reply_draft: e.target.value } : x)))} onBlur={(e) => e.target.value !== "" && sb.from("google_reviews").update({ reply_draft: e.target.value }).eq("id", r.id).then(() => {})} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {!r.reply_draft?.trim() ? (
                    <button className="d-btn d-btn-p !min-h-10 !px-4" disabled={busy === r.id} onClick={() => regenerate(r)}>{busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Write a reply</button>
                  ) : (
                  <button className="d-btn d-btn-p !min-h-10 !px-4" onClick={() => navigator.clipboard.writeText(r.reply_draft ?? "").then(() => toast("Reply copied. Paste it under the review on Google.")).catch(() => toast("Could not copy. Select the text instead.", true))}><Copy size={15} /> Copy reply</button>
                  )}
                  <a className="d-btn d-btn-s !min-h-10 !px-4" href="https://business.google.com/reviews" target="_blank" rel="noopener"><ExternalLink size={15} /> Open Google reviews</a>
                  {!!r.reply_draft?.trim() && <button className="d-btn d-btn-s !min-h-10 !px-4" disabled={busy === r.id} onClick={() => regenerate(r)}>{busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Write another</button>}
                  <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => patch(r, { replied_at: r.replied_at ? null : new Date().toISOString() }, r.replied_at ? "Marked as not replied" : "Marked as replied")}>{r.replied_at ? "Undo replied" : "Mark replied"}</button>
                  <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => patch(r, { show_on_page: !r.show_on_page }, r.show_on_page ? "Hidden from your page" : "Now shown on your page")}>{r.show_on_page ? "Hide from page" : "Show on my page"}</button>
                  <button className="grid h-10 w-10 place-items-center" style={{ color: "var(--d-muted)" }} aria-label="Remove review" onClick={() => remove(r)}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="guest">
        <h2 id="guest" className="mb-1 font-semibold">What guests wrote with Taprizz</h2>
        <p className="mb-3 text-sm" style={{ color: "var(--d-muted)" }}>Each guest who tapped Review us on Google answers a few questions and gets a draft. {stats.drafts} this month, {stats.copied} copied to Google.</p>
        {drafts.length === 0 ? (
          <div className="d-card px-6 py-10 text-center text-sm" style={{ color: "var(--d-muted)" }}>No guest drafts yet. They appear here when a guest taps your plate and starts a review.</div>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="d-raise p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--d-muted)" }}>
                  <Stars n={d.rating} size={13} /><span>{timeAgo(d.created_at)}</span>{d.plate_code && <span>{labels[d.plate_code] ?? d.plate_code}</span>}
                  {d.copied ? <span className="d-chip" style={{ ["--c" as string]: "var(--d-green)" }}>Copied to Google</span> : <span className="d-chip" style={{ ["--c" as string]: "var(--d-muted)" }}>Not copied</span>}
                </div>
                {d.answers?.qa?.length ? <p className="mt-1.5 text-xs" style={{ color: "var(--d-muted)" }}>{d.answers.qa.filter((x) => x.values?.length).map((x) => `${x.label}: ${x.values.join(", ")}`).join(" · ")}</p> : d.answers?.chips?.length ? <p className="mt-1.5 text-xs" style={{ color: "var(--d-muted)" }}>Stood out: {d.answers.chips.join(", ")}{d.answers.company ? ` · came with ${d.answers.company}` : ""}</p> : null}
                <p className="mt-1.5 text-[14px]" style={{ color: "var(--d-sub)" }}>{d.draft}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
