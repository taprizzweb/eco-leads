"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { slugify } from "@/lib/features";
import { Pill } from "./ui";

export type GroupRow = { id: string; slug: string; name: string; logo_url: string | null; branches: number };

export function ChainsAdmin({ groups }: { groups: GroupRow[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(groups.length === 0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = useMemo(() => groups.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase())), [groups, q]);

  async function create() {
    setErr("");
    if (!name.trim()) return setErr("Add the name of the chain, like Kana Group.");
    const s = slugify(slug || name);
    if (!/^[a-z0-9-]{3,40}$/.test(s)) return setErr("The link name needs 3 to 40 letters, numbers or dashes.");
    setBusy(true);
    const { data, error } = await sb.from("groups").insert({ name: name.trim(), slug: s }).select("id").single();
    setBusy(false);
    if (error || !data) return setErr(/duplicate|unique/i.test(error?.message ?? "") ? "That link name is taken. Try another." : "The chain was not created. Please try again.");
    toast("Chain created");
    router.push(`/admin/tools/chains/${data.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
          <input type="search" aria-label="Search chains" className="d-input !pl-10" placeholder="Search a chain" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="d-btn d-btn-p" onClick={() => setOpen((v) => !v)}><Plus size={16} /> New chain</button>
      </div>

      {open && (
        <section className="d-card space-y-4 p-5">
          <h2 className="font-semibold">Make a chain</h2>
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Name of the company</span><input className="d-input mt-1.5" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kana Group" /></label>
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Link name</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>/group/{slugify(slug || name) || "name"}</span>
            <input className="d-input mt-1.5" maxLength={40} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="leave empty to use the name" /></label>
          {err && <p role="alert" className="text-sm" style={{ color: "var(--d-red)" }}>{err}</p>}
          <button className="d-btn d-btn-p" disabled={busy} onClick={create}>{busy && <Loader2 size={16} className="animate-spin" />} Create and add branches</button>
        </section>
      )}

      {list.length === 0 ? (
        <p className="d-card p-8 text-center text-sm" style={{ color: "var(--d-muted)" }}>{groups.length === 0 ? "No chains yet. Make the first one." : `No chain matches "${q}".`}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g) => (
            <article key={g.id} className="d-card flex items-center gap-3 p-4">
              {g.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={g.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{g.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <Link href={`/admin/tools/chains/${g.id}`} className="block truncate py-1 font-semibold hover:underline">{g.name}</Link>
                <p className="truncate text-xs" style={{ color: "var(--d-muted)" }}>/group/{g.slug}</p>
                <div className="mt-1"><Pill tone={g.branches ? "blue" : "gray"}>{g.branches} {g.branches === 1 ? "branch" : "branches"}</Pill></div>
              </div>
              <Link className="d-btn d-btn-s !px-3 shrink-0" aria-label={`Open the ${g.name} dashboard`} href={`/group/${g.slug}`}><ExternalLink size={15} /></Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
