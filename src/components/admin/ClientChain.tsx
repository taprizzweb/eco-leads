"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugify } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";

type G = { id: string; name: string; slug: string };

// On a business page: put this business into a chain, or start a new chain from it (when a client later opens more branches).
export function ClientChain({ clientId, clientName, current, groups }: { clientId: string; clientName: string; current: G | null; groups: G[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState("");

  async function join(id: string | null) {
    setBusy("join");
    const { error } = await sb.from("clients").update({ group_id: id }).eq("id", clientId);
    setBusy("");
    if (error) return toast("Could not change the chain. Please try again.", true);
    toast(id ? "Added to the chain" : "Removed from the chain");
    router.refresh();
  }

  async function startNew() {
    setBusy("new");
    const base = slugify(`${clientName} group`) || "chain";
    let id: string | null = null;
    for (let i = 0; i < 4 && !id; i++) {
      const slug = (i ? `${base.slice(0, 34)}-${Math.floor(Math.random() * 900 + 100)}` : base).slice(0, 40);
      const { data, error } = await sb.from("groups").insert({ name: `${clientName} Group`, slug }).select("id").single();
      if (data) id = data.id;
      else if (!/duplicate|unique/i.test(error?.message ?? "")) break;
    }
    if (!id) { setBusy(""); return toast("The chain was not created. Please try again.", true); }
    const { error } = await sb.from("clients").update({ group_id: id }).eq("id", clientId);
    setBusy("");
    if (error) return toast("The chain was made but this business was not added. Open Tools, Chains to finish.", true);
    router.push(`/admin/tools/chains/${id}`);
  }

  return (
    <section className="d-card p-5" aria-labelledby="chain-h">
      <h2 id="chain-h" className="flex items-center gap-2 font-semibold"><Building2 size={17} aria-hidden /> Chain</h2>
      {current ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span style={{ color: "var(--d-muted)" }}>Part of <b style={{ color: "var(--d-text)" }}>{current.name}</b>. Its head sees this branch.</span>
          <Link className="d-btn d-btn-s" href={`/admin/tools/chains/${current.id}`}>Open the chain</Link>
          <button className="d-btn d-btn-s" disabled={!!busy} onClick={() => { if (confirm(`Remove ${clientName} from ${current.name}? The chain head loses access to this branch.`)) void join(null); }}>
            {busy === "join" && <Loader2 size={15} className="animate-spin" />} Remove from chain
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p style={{ color: "var(--d-muted)" }}>This business opened more branches? Group them so one person sees everything in one dashboard.</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Add to an existing chain" className="d-input !w-auto min-w-0 flex-1" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Add to an existing chain…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="d-btn d-btn-s" disabled={!pick || !!busy} onClick={() => join(pick)}>{busy === "join" && <Loader2 size={15} className="animate-spin" />} Add</button>
          </div>
          <button className="d-btn d-btn-p" disabled={!!busy} onClick={startNew}>{busy === "new" && <Loader2 size={15} className="animate-spin" />} Start a new chain with this business</button>
        </div>
      )}
    </section>
  );
}
