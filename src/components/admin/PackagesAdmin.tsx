"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FEATURE_DEFS, type FeatureMap } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";

type Pkg = { id: string; name: string; price_inr: number; features: FeatureMap };

export function PackagesAdmin({ packages: p0, counts, canEdit }: { packages: Pkg[]; counts: Record<string, number>; canEdit: boolean }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [pk, setPk] = useState(p0);
  const [saved, setSaved] = useState(JSON.stringify(p0));
  const [busy, setBusy] = useState<string | null>(null);
  const was = JSON.parse(saved) as Pkg[];
  const dirty = (p: Pkg) => JSON.stringify(p) !== JSON.stringify(was.find((x) => x.id === p.id));
  const edit = (id: string, fn: (p: Pkg) => Pkg) => setPk((s) => s.map((p) => (p.id === id ? fn(p) : p)));

  async function save(p: Pkg) {
    if (!p.name.trim() || p.price_inr < 0) return toast("Give the package a name and a price of 0 or more.", true);
    setBusy(p.id);
    const { error } = await sb.from("packages").update({ name: p.name.trim(), price_inr: p.price_inr, features: p.features, updated_at: new Date().toISOString() }).eq("id", p.id);
    setBusy(null);
    if (error) return toast("The package did not save. Only managers can edit packages.", true);
    setSaved(JSON.stringify(pk));
    toast(`${p.name} saved. Clients on it have the new switches now.`);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {pk.map((p) => (
        <section key={p.id} className="d-card p-4" aria-label={p.name}>
          <label className="block text-sm"><span style={{ color: "var(--d-muted)" }}>Name</span>
            <input className="d-input mt-1" value={p.name} disabled={!canEdit} onChange={(e) => edit(p.id, (x) => ({ ...x, name: e.target.value }))} /></label>
          <label className="mt-3 block text-sm"><span style={{ color: "var(--d-muted)" }}>Price a month (Rs)</span>
            <input type="number" min={0} className="d-input mt-1 tabular-nums" value={p.price_inr} disabled={!canEdit} onChange={(e) => edit(p.id, (x) => ({ ...x, price_inr: Math.max(0, parseInt(e.target.value) || 0) }))} /></label>
          <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>{counts[p.id] ?? 0} client{(counts[p.id] ?? 0) === 1 ? "" : "s"} on this package. Prices are proposals until you approve them.</p>
          <ul className="mt-4 divide-y" style={{ borderColor: "var(--d-line)" }}>
            {FEATURE_DEFS.map((d) => {
              const v = p.features[d.key];
              return (
                <li key={d.key} className="flex min-h-11 items-center gap-2 py-1.5 text-sm" style={{ borderColor: "var(--d-line)" }}>
                  <span className="flex-1" style={{ color: "var(--d-text)" }}>{d.label}</span>
                  {d.type === "bool" && (
                    <button role="switch" aria-checked={!!v} aria-label={`${d.label} on ${p.name}`} disabled={!canEdit} onClick={() => edit(p.id, (x) => ({ ...x, features: { ...x.features, [d.key]: !v } }))} className="relative h-6 w-11 shrink-0 rounded-full" style={{ background: v ? "var(--d-green)" : "var(--d-line-2)", opacity: canEdit ? 1 : 0.6 }}>
                      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: v ? 22 : 2 }} />
                    </button>
                  )}
                  {d.type === "number" && <input type="number" aria-label={`${d.label} on ${p.name}`} className="d-input !w-20 !min-h-9 text-center" min={d.min} max={d.max} disabled={!canEdit} value={Number(v ?? 0)} onChange={(e) => edit(p.id, (x) => ({ ...x, features: { ...x.features, [d.key]: Math.max(d.min, Math.min(d.max, parseInt(e.target.value) || 0)) } }))} />}
                  {d.type === "enum" && (
                    <select aria-label={`${d.label} on ${p.name}`} className="d-input !w-40 !min-h-9 !text-[13px]" disabled={!canEdit} value={String(v ?? "")} onChange={(e) => edit(p.id, (x) => ({ ...x, features: { ...x.features, [d.key]: e.target.value } }))}>
                      {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <button className="d-btn d-btn-p mt-4 w-full" disabled={!dirty(p) || busy === p.id} onClick={() => save(p)}>{busy === p.id && <Loader2 size={16} className="animate-spin" />} {dirty(p) ? `Save ${p.name || "package"}` : "No changes"}</button>
          )}
        </section>
      ))}
    </div>
  );
}
