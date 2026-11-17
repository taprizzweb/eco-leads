"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Play, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { approvalMessage, waLink } from "@/lib/creators";
import { timeAgo } from "@/lib/dash-time";
import { useToast } from "./Toast";

type Req = { id: string; name: string; handle: string; followers_range: string | null; city: string | null; phone: string; plan: string | null; preferred_day: string | null; always_welcome: boolean; status: "pending" | "approved" | "declined"; visit_code: string | null; approved_at: string | null; redeemed_at: string | null; created_at: string };
type Post = { id: string; request_id: string | null; handle: string; post_url: string; media_path: string | null; status: "new" | "verified" | "posted" | "rejected"; created_at: string };

const dayText = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : null);
const Chip = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className="d-chip" style={{ ["--c" as string]: `var(--d-${tone})` }}>{children}</span>;

export function ContentBoard({ businessName, barter, cap, usedThisMonth, requests: r0, posts: p0 }: { businessName: string; barter: string; cap: number; usedThisMonth: number; requests: Req[]; posts: Post[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [reqs, setReqs] = useState(r0);
  const [posts, setPosts] = useState(p0);
  const [used, setUsed] = useState(usedThisMonth);
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(r: Req) {
    setBusy(r.id);
    const { data, error } = await sb.rpc("owner_approve_collab", { p_id: r.id });
    setBusy(null);
    if (error || !data) return toast(error?.message || "Could not approve. Please try again.", true);
    setReqs((s) => s.map((x) => (x.id === r.id ? { ...x, status: "approved", visit_code: data as string, approved_at: new Date().toISOString() } : x)));
    setUsed((n) => n + 1);
    toast(`Approved. Visit code ${data}. Send it to ${r.name} on WhatsApp.`);
  }
  async function updReq(r: Req, p: Partial<Req>, done: string) {
    const { error } = await sb.from("creator_requests").update(p).eq("id", r.id);
    if (error) return toast("That change did not save.", true);
    setReqs((s) => s.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
    toast(done);
  }
  async function updPost(p: Post, status: Post["status"], done: string) {
    const { error } = await sb.from("creator_posts").update({ status }).eq("id", p.id);
    if (error) return toast("That change did not save.", true);
    setPosts((s) => s.map((x) => (x.id === p.id ? { ...x, status } : x)));
    toast(done);
  }
  async function play(p: Post) {
    if (!p.media_path) return;
    const { data } = await sb.storage.from("guest-uploads").createSignedUrl(p.media_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else toast("Could not open the clip.", true);
  }

  const pending = reqs.filter((r) => r.status === "pending");
  const approved = reqs.filter((r) => r.status === "approved");
  const declined = reqs.filter((r) => r.status === "declined");
  const newPosts = posts.filter((p) => p.status === "new");
  const IG = (h: string) => `https://www.instagram.com/${h}/`;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-3 gap-3" aria-label="Summary">
        {[
          ["Requests waiting", pending.length, "var(--d-amber)"],
          [cap > 0 ? `Approved this month (limit ${cap})` : "Approved this month", used, "var(--d-green)"],
          ["Posts to check", newPosts.length, "var(--d-blue)"],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="d-card p-4"><p className="d-col-h text-[13px]" style={{ ["--c" as string]: String(c), color: "var(--d-muted)" }}>{l}</p><p className="mt-3 text-[30px] leading-none font-semibold tabular-nums" style={{ color: "var(--d-text)" }}>{v}</p></div>
        ))}
      </section>

      <section aria-labelledby="rq">
        <h2 id="rq" className="mb-3 font-semibold">Collab requests</h2>
        {reqs.length === 0 ? (
          <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>No requests yet. When a creator asks to collab from your page, they show up here for you to approve.</div>
        ) : (
          <ul className="space-y-3">
            {[...pending, ...approved].map((r) => (
              <li key={r.id} className="d-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium" style={{ color: "var(--d-text)" }}>{r.name}</span>
                  <a className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline" style={{ color: "var(--d-sub)" }} href={IG(r.handle)} target="_blank" rel="noopener">@{r.handle} <ExternalLink size={12} /></a>
                  {r.always_welcome && <Chip tone="green">Always welcome</Chip>}
                  {r.status === "approved" ? (r.redeemed_at ? <Chip tone="blue">Visited</Chip> : <Chip tone="amber">Approved, not visited</Chip>) : <Chip tone="amber">Waiting</Chip>}
                  <span className="text-xs" style={{ color: "var(--d-muted)" }}>{timeAgo(r.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm" style={{ color: "var(--d-muted)" }}>
                  {[r.followers_range && `${r.followers_range} followers`, r.city, r.plan, dayText(r.preferred_day) && `wants ${dayText(r.preferred_day)}`, `+${r.phone}`].filter(Boolean).join(" · ")}
                </p>
                {r.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="d-btn d-btn-p !min-h-10 !px-4" disabled={busy === r.id} onClick={() => approve(r)}>{busy === r.id && <Loader2 size={15} className="animate-spin" />} Approve</button>
                    <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => updReq(r, { status: "declined" }, "Declined")}>Decline</button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg px-3 py-2 font-mono text-[15px] tracking-wider" style={{ background: "var(--d-bg)", color: "var(--d-text)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>{r.visit_code}</span>
                    <a className="d-btn d-btn-p !min-h-10 !px-4" target="_blank" rel="noopener" href={waLink(r.phone, approvalMessage({ name: r.name.split(" ")[0], business: businessName, code: r.visit_code ?? "", barter, day: dayText(r.preferred_day) }))}><MessageCircle size={15} /> Send on WhatsApp</a>
                    <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => navigator.clipboard.writeText(r.visit_code ?? "").then(() => toast("Code copied"))}><Copy size={15} /> Copy code</button>
                    <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => updReq(r, { redeemed_at: r.redeemed_at ? null : new Date().toISOString() }, r.redeemed_at ? "Marked as not visited" : "Marked as redeemed")}><Check size={15} /> {r.redeemed_at ? "Undo redeemed" : "Redeemed"}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {declined.length > 0 && (
          <details className="mt-3 text-sm" style={{ color: "var(--d-muted)" }}>
            <summary className="min-h-11 cursor-pointer py-3">{declined.length} declined</summary>
            <ul className="space-y-2">{declined.map((r) => <li key={r.id} className="d-raise flex items-center gap-3 p-3"><span className="flex-1" style={{ color: "var(--d-sub)" }}>{r.name} · @{r.handle}</span><button className="d-btn d-btn-s !min-h-9 !px-3 !text-[13px]" onClick={() => updReq(r, { status: "pending" }, "Moved back to waiting")}>Reconsider</button></li>)}</ul>
          </details>
        )}
      </section>

      <section aria-labelledby="ps">
        <h2 id="ps" className="mb-1 font-semibold">Posts from creators</h2>
        <p className="mb-3 text-sm" style={{ color: "var(--d-muted)" }}>Check that each post carries a clear collab or ad label, mark it Verified, then repost the best ones.</p>
        {posts.length === 0 ? (
          <div className="d-card px-6 py-10 text-center text-sm" style={{ color: "var(--d-muted)" }}>No posts yet. After a visit, creators send their reel link from your page.</div>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="d-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium" style={{ color: "var(--d-text)" }}>@{p.handle}</span>
                  <Chip tone={p.status === "new" ? "amber" : p.status === "rejected" ? "red" : "green"}>{p.status === "new" ? "To check" : p.status === "verified" ? "Verified" : p.status === "posted" ? "Reposted" : "Rejected"}</Chip>
                  <span className="text-xs" style={{ color: "var(--d-muted)" }}>{timeAgo(p.created_at)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="d-btn d-btn-s !min-h-10 !px-4" href={p.post_url} target="_blank" rel="noopener"><ExternalLink size={15} /> Open the post</a>
                  {p.media_path && <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => play(p)}><Play size={15} /> Raw clip</button>}
                  <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => navigator.clipboard.writeText(`@${p.handle}`).then(() => toast("Handle copied. Paste it when you tag them."))}><Copy size={15} /> Copy handle</button>
                  {p.status === "new" && <button className="d-btn d-btn-p !min-h-10 !px-4" onClick={() => updPost(p, "verified", "Verified")}><Check size={15} /> Label is clear, verify</button>}
                  {(p.status === "new" || p.status === "verified") && <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => updPost(p, "posted", "Marked as reposted")}>Mark reposted</button>}
                  {p.status !== "rejected" && p.status !== "posted" && <button className="d-btn d-btn-s !min-h-10 !px-4" onClick={() => updPost(p, "rejected", "Rejected")}><X size={15} /> Reject</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
