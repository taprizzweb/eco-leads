"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check, Copy, Download, Loader2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./Toast";

export type Moment = { id: string; group_id: string | null; media_path: string; caption: string | null; instagram_handle: string | null; status: "pending" | "approved" | "rejected"; created_at: string };
type Group = { key: string; items: Moment[]; caption: string | null; handle: string | null; status: Moment["status"]; created_at: string };

const isVideo = (p: string) => /\.(mp4|mov|webm|m4v|3gp)$/i.test(p);

// Photos and clips guests send from the Creators corner. The owner marks one as posted or dismisses it.
export function MomentsBoard({ moments, instagram }: { moments: Moment[]; instagram: string | null }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const asked = useRef<Set<string>>(new Set());
  // shown at once; the server copy catches up after router.refresh()
  const [local, setLocal] = useState<Record<string, Moment["status"]>>({});

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>();
    for (const x of moments) {
      const k = x.group_id ?? x.id;
      const g = m.get(k) ?? { key: k, items: [], caption: x.caption, handle: x.instagram_handle, status: local[k] ?? x.status, created_at: x.created_at };
      g.items.push(x);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [moments, local]);
  const shown = groups.filter((g) => g.status === tab);
  const count = (s: Moment["status"]) => groups.filter((g) => g.status === s).length;

  useEffect(() => {
    const paths = shown.flatMap((g) => g.items.map((i) => i.media_path)).filter((p) => !asked.current.has(p));
    if (!paths.length) return;
    paths.forEach((p) => asked.current.add(p));
    sb.storage.from("guest-uploads").createSignedUrls(paths, 900).then(({ data }) => {
      const add: Record<string, string> = {};
      data?.forEach((d) => { if (d.path && d.signedUrl) add[d.path] = d.signedUrl; });
      setUrls((u) => ({ ...u, ...add }));
    });
  }, [shown, sb]);

  async function setStatus(g: Group, status: Moment["status"]) {
    setBusy(g.key);
    const { error } = await sb.from("moments").update({ status }).in("id", g.items.map((i) => i.id));
    setBusy(null);
    if (error) return toast("That did not save. Please try again.", true);
    setLocal((l) => ({ ...l, [g.key]: status }));
    toast(status === "approved" ? "Marked as posted" : status === "rejected" ? "Dismissed" : "Moved back to new");
    router.refresh();
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); toast("Copied"); } catch { toast("Could not copy. Select the text instead.", true); } }

  return (
    <div className="space-y-4">
      <div className="d-seg w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Moments">
        {([["pending", "New"], ["approved", "Posted"], ["rejected", "Dismissed"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label} ({count(id)})</button>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="d-card p-8 text-center" style={{ color: "var(--d-muted)" }}>
          {tab === "pending" ? <>Nothing new yet. When a guest sends photos or clips from the Creators corner, they appear here.{!instagram && <p className="mt-2">Tip: add your Instagram link in My page so guests can follow and tag you.</p>}</> : "Nothing here."}
        </div>
      )}
      {shown.map((g) => (
        <article key={g.key} className="d-card space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {g.items.map((i) => {
              const u = urls[i.media_path];
              return (
                <div key={i.id} className="relative aspect-square overflow-hidden rounded-xl" style={{ background: "var(--d-bg)" }}>
                  {!u ? <div className="grid h-full place-items-center"><Loader2 className="animate-spin" size={18} /></div> : isVideo(i.media_path)
                    ? <video src={u} controls playsInline className="h-full w-full object-cover" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={u} alt="Sent by a guest" className="h-full w-full object-cover" />}
                  {u && <a href={u} download target="_blank" rel="noopener" aria-label="Download" className="absolute right-1.5 bottom-1.5 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"><Download size={16} /></a>}
                </div>
              );
            })}
          </div>
          {g.caption && <div><p className="text-xs" style={{ color: "var(--d-muted)" }}>Caption they would like</p><p className="whitespace-pre-wrap text-[15px]" style={{ color: "var(--d-text)" }}>{g.caption}</p></div>}
          <div className="flex flex-wrap items-center gap-2">
            {g.handle ? <span className="d-chip"><AtSign size={11} />{g.handle}</span> : <span className="text-sm" style={{ color: "var(--d-muted)" }}>No Instagram username given</span>}
            {g.caption && <button className="d-btn d-btn-s" onClick={() => copy(g.caption!)}><Copy size={14} /> Copy caption</button>}
            {g.handle && <button className="d-btn d-btn-s" onClick={() => copy(`@${g.handle}`)}><Copy size={14} /> Copy @{g.handle}</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {g.status !== "approved" && <button className="d-btn d-btn-p" disabled={busy === g.key} onClick={() => setStatus(g, "approved")}><Check size={16} /> Mark as posted</button>}
            {g.status !== "rejected" && <button className="d-btn d-btn-s" disabled={busy === g.key} onClick={() => setStatus(g, "rejected")}><X size={16} /> Dismiss</button>}
            {g.status !== "pending" && <button className="d-btn d-btn-s" disabled={busy === g.key} onClick={() => setStatus(g, "pending")}>Move back to new</button>}
          </div>
          <p className="text-xs" style={{ color: "var(--d-muted)" }}>Guests agreed that {`you`} may post these and tag them. Files stay private until you download them.</p>
        </article>
      ))}
    </div>
  );
}
