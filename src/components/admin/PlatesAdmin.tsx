"use client";

import { useState } from "react";
import { Copy, QrCode, ExternalLink, Plus, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PLATE_BASE, newPlateCode } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";
import { Pill, Row, TableWrap, td, th } from "./ui";
import { downloadQr } from "./qr";

type Plate = { code: string; label: string | null; active: boolean; client_id: string | null };
type Client = { id: string; name: string };

export function PlatesAdmin({ plates: p0, clients, canManage }: { plates: Plate[]; clients: Client[]; canManage: boolean }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [plates, setPlates] = useState(p0);
  const [filter, setFilter] = useState("all");
  const [nc, setNc] = useState({ client: clients[0]?.id ?? "", label: "" });
  const [busy, setBusy] = useState(false);
  const name = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Unassigned";
  const link = (code: string) => `${PLATE_BASE}/e/${code}`;
  const shown = plates.filter((p) => filter === "all" || (filter === "none" ? !p.client_id : p.client_id === filter));

  async function update(code: string, patch: Partial<Plate>, done: string) {
    const { error } = await sb.from("plates").update(patch).eq("code", code);
    if (error) return toast("That change did not save. Only managers can edit plates.", true);
    setPlates((s) => s.map((p) => (p.code === code ? { ...p, ...patch } : p)));
    toast(done);
  }

  async function create() {
    setBusy(true);
    for (let t = 0; t < 5; t++) {
      const code = newPlateCode();
      const row = { code, client_id: nc.client || null, label: nc.label.trim() || null };
      const { error } = await sb.from("plates").insert(row);
      if (!error) { setPlates((s) => [{ ...row, active: true }, ...s]); setNc({ ...nc, label: "" }); toast(`Plate created: ${link(code)}`); setBusy(false); return; }
      if (!/duplicate|unique/i.test(error.message)) break;
    }
    setBusy(false);
    toast("The plate was not created.", true);
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <form className="d-card flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <label className="block min-w-48 flex-1 text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>New plate for</span>
            <select className="d-input mt-1.5" value={nc.client} onChange={(e) => setNc({ ...nc, client: e.target.value })}>
              <option value="">Unassigned</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="block min-w-40 flex-1 text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Label</span>
            <input className="d-input mt-1.5" value={nc.label} onChange={(e) => setNc({ ...nc, label: e.target.value })} placeholder="Table 5, Counter, Room 3" maxLength={30} /></label>
          <button className="d-btn d-btn-p" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create plate</button>
        </form>
      ) : (
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>Only managers can create or reassign plate links. You can view and download QR codes.</p>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="pf" className="text-sm" style={{ color: "var(--d-muted)" }}>Show</label>
        <select id="pf" className="d-input !w-64 !min-h-10" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All plates ({plates.length})</option><option value="none">Unassigned</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>No plates here yet.</div>
      ) : (
        <TableWrap>
          <thead><tr style={{ color: "var(--d-muted)" }}><th className={th}>Link</th><th className={th}>Client</th><th className={th}>Label</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <Row key={p.code}>
                <td className={td}><span className="font-mono text-[13px]" style={{ color: "var(--d-text)" }}>/e/{p.code}</span></td>
                <td className={td}>
                  {canManage ? (
                    <select aria-label={`Client for ${p.code}`} className="d-input !min-h-10 !w-52" value={p.client_id ?? ""} onChange={(e) => update(p.code, { client_id: e.target.value || null }, "Plate reassigned")}>
                      <option value="">Unassigned</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : name(p.client_id)}
                </td>
                <td className={td}>
                  {canManage ? <input aria-label={`Label for ${p.code}`} className="d-input !min-h-10 !w-40" defaultValue={p.label ?? ""} maxLength={30} onBlur={(e) => e.target.value !== (p.label ?? "") && update(p.code, { label: e.target.value || null }, "Label saved")} /> : (p.label ?? "")}
                </td>
                <td className={td}>{p.active ? <Pill tone="green">Live</Pill> : <Pill tone="gray">Off</Pill>}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <button className="d-btn d-btn-s mr-1.5 !min-h-10 !px-3" aria-label={`Copy link ${p.code}`} onClick={() => navigator.clipboard.writeText(link(p.code)).then(() => toast("Link copied")).catch(() => toast("Could not copy.", true))}><Copy size={15} /></button>
                  <button className="d-btn d-btn-s mr-1.5 !min-h-10 !px-3" aria-label={`Download QR ${p.code}`} onClick={() => downloadQr(p.code, `${name(p.client_id)}-${p.label ?? p.code}`).then(() => toast("QR downloaded"))}><QrCode size={15} /></button>
                  <a className="d-btn d-btn-s mr-1.5 !min-h-10 !px-3" aria-label="Open guest page" href={`/e/${p.code}`} target="_blank" rel="noopener"><ExternalLink size={15} /></a>
                  {canManage && <button className="d-btn d-btn-s !min-h-10 !px-3 !text-[13px]" onClick={() => update(p.code, { active: !p.active }, p.active ? "Plate switched off" : "Plate switched on")}>{p.active ? "Switch off" : "Switch on"}</button>}
                </td>
              </Row>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
