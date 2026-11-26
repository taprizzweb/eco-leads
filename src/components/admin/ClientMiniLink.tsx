"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Link2, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LINK_BASE } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";

export type ClientLinkPage = { id: string; slug: string; name: string; published: boolean; plan: string; client_id: string | null };

// On a business page: connect an existing mini link to this business, or take it off.
// AI review is switched off on every change, so a page never starts sending guests to a Google link by itself.
export function ClientMiniLink({ clientId, clientName, pages }: { clientId: string; clientName: string; pages: ClientLinkPage[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState("");
  const linked = pages.filter((p) => p.client_id === clientId);
  const free = pages.filter((p) => !p.client_id);
  const base = LINK_BASE.replace(/^https?:\/\//, "");

  async function change(page: ClientLinkPage, add: boolean) {
    setBusy(page.id);
    const q = sb.from("link_pages").update({ client_id: add ? clientId : null, ai_review: false, updated_at: new Date().toISOString() }).eq("id", page.id);
    // The extra condition stops this from moving a page that someone else linked in the meantime.
    const { data, error } = await (add ? q.is("client_id", null) : q.eq("client_id", clientId)).select("id");
    setBusy("");
    if (error || !data?.length) {
      toast("The mini link was not changed. Refresh the page and try again.", true);
    } else {
      setPick("");
      toast(add ? "Mini link added" : "Mini link removed");
    }
    router.refresh();
  }

  function add() {
    const page = free.find((p) => p.id === pick);
    if (page && confirm(`Add ${base}/${page.slug} to ${clientName}? Its owner and managers can then edit the page and read the messages sent from it. AI review stays off.`)) void change(page, true);
  }

  return (
    <section className="d-card p-5" aria-labelledby="minilink-h">
      <h2 id="minilink-h" className="flex items-center gap-2 font-semibold"><Link2 size={17} aria-hidden /> Mini link</h2>
      {linked.length > 0 ? (
        <>
          <ul className="mt-3 space-y-3 text-sm">
            {linked.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3">
                <span className="w-full min-w-0 break-words sm:w-auto sm:flex-1" style={{ color: "var(--d-muted)" }}><b style={{ color: "var(--d-text)" }}>{p.name}</b> {base}/{p.slug}{p.published ? "" : " (draft)"}</span>
                {p.published && <a className="d-btn d-btn-s" href={`${LINK_BASE}/${p.slug}`} target="_blank" rel="noopener">Open</a>}
                <Link className="d-btn d-btn-s" href={`/admin/tools/links/${p.id}`}>Edit</Link>
                <button className="d-btn d-btn-s" disabled={!!busy} onClick={() => { if (confirm(`Remove ${base}/${p.slug} from ${clientName}? The page stays online, its owner can no longer manage it, and AI review is switched off.`)) void change(p, false); }}>
                  {busy === p.id && <Loader2 size={15} className="animate-spin" />} Remove
                </button>
              </li>
            ))}
          </ul>
          {linked.length > 1 && <p className="mt-3 text-sm" style={{ color: "var(--d-muted)" }}>The owner dashboard shows only the most recently changed page. Keep one page here.</p>}
        </>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p style={{ color: "var(--d-muted)" }}>No mini link is added to this business yet.</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Choose a mini link" className="d-input !w-full min-w-0 sm:!w-auto sm:flex-1" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a mini link…</option>
              {free.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slug}){p.plan === "mini" ? ", self-serve" : ""}{p.published ? "" : ", draft"}</option>)}
            </select>
            <button className="d-btn d-btn-s" disabled={!pick || !!busy} onClick={add}>{busy && <Loader2 size={15} className="animate-spin" />} Add</button>
          </div>
          <Link className="d-btn d-btn-s" href="/admin/tools/links">Make a new mini link</Link>
        </div>
      )}
    </section>
  );
}
