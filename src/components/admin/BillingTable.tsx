"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { Expiry, Pill, Row, TableWrap, inr, td, th, fmtDate } from "./ui";

type Row_ = { id: string; slug: string; name: string; plan: string; price: number; status: "active" | "paused"; expires_at: string | null; days: number | null };

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function BillingTable({ rows: r0 }: { rows: Row_[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(r0);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(r: Row_, patch: { expires_at?: string; status?: "active" | "paused" }, done: string) {
    setBusy(r.id);
    const { error } = await sb.from("clients").update(patch).eq("id", r.id);
    setBusy(null);
    if (error) return toast("That change did not save. Please try again.", true);
    setRows((s) => s.map((x) => {
      if (x.id !== r.id) return x;
      const exp = patch.expires_at ?? x.expires_at;
      return { ...x, ...patch, expires_at: exp, days: exp ? Math.ceil((new Date(exp + "T23:59:59+05:30").getTime() - Date.now()) / 864e5) : null };
    }));
    toast(done);
    router.refresh();
  }

  // "Paid": push the end date out 30 days from the later of today and the current end date, and make sure the page is live.
  const paid = (r: Row_) => {
    const base = r.expires_at && r.expires_at > todayIso() ? r.expires_at : todayIso();
    const next = addDays(base, 30);
    return save(r, { expires_at: next, status: "active" }, `${r.name} renewed to ${fmtDate(next)}`);
  };

  const unpaid = rows.filter((r) => r.days !== null && r.days < 0 && r.status === "active");
  const owed = unpaid.reduce((a, r) => a + r.price, 0);

  return (
    <div className="space-y-4">
      {unpaid.length > 0 && (
        <div className="d-card flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--d-red) 45%, transparent)" }}>
          <Pill tone="red">Unpaid</Pill>
          <p className="flex-1" style={{ color: "var(--d-text)" }}>{unpaid.length} client{unpaid.length === 1 ? " is" : "s are"} past their end date: {inr(owed)} outstanding. Their pages already show only the Google link.</p>
        </div>
      )}
      <TableWrap>
        <thead><tr style={{ color: "var(--d-muted)" }}><th className={th}>Client</th><th className={th}>Plan</th><th className={th}>Monthly</th><th className={th}>Ends</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id}>
              <td className={td} style={{ color: "var(--d-text)" }}>{r.name}</td>
              <td className={td}>{r.plan}</td>
              <td className={`${td} tabular-nums`}>{inr(r.price)}</td>
              <td className={td}><Expiry iso={r.expires_at} days={r.days} /></td>
              <td className={td}>{r.status === "active" ? <Pill tone="green">Active</Pill> : <Pill tone="red">Paused</Pill>}</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <button className="d-btn d-btn-p mr-2 !min-h-10 !px-4 !text-[13px]" disabled={busy === r.id} onClick={() => paid(r)}>{busy === r.id && <Loader2 size={14} className="animate-spin" />} Mark paid, +30 days</button>
                {r.status === "active" ? (
                  <button className="d-btn d-btn-s !min-h-10 !px-4 !text-[13px]" disabled={busy === r.id} onClick={() => save(r, { status: "paused" }, `${r.name} paused. Plates show the Google link.`)}>Pause</button>
                ) : (
                  <button className="d-btn d-btn-s !min-h-10 !px-4 !text-[13px]" disabled={busy === r.id} onClick={() => save(r, { status: "active" }, `${r.name} is live again`)}>Resume</button>
                )}
              </td>
            </Row>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
