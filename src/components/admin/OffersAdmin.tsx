"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Loader2, Send, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { Pill, Empty } from "./ui";
import { downloadCsv } from "./WhatsappAdmin";

export type Req = {
  id: string; client_id: string; business: string; slug: string; message: string; image_url: string | null;
  audience_kind: "recent" | "not_returned" | "all"; audience_days: number; status: "pending" | "approved" | "rejected" | "sent";
  admin_note: string | null; recipient_count: number | null; created_at: string; sender?: "taprizz" | "own";
};
type Tab = Req["status"];
const KIND: Record<Req["audience_kind"], string> = { recent: "Customers seen in the last", not_returned: "Customers who never came back after", all: "All customers" };
const TONE: Record<Tab, "amber" | "green" | "red" | "blue"> = { pending: "amber", approved: "green", rejected: "red", sent: "blue" };

function Card({ r, onChange }: { r: Req; onChange: (r: Req) => void }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [count, setCount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const open = r.status === "pending";

  useEffect(() => {
    setCount(null);
    sb.rpc("wa_audience_count", { p_client: r.client_id, p_kind: r.audience_kind, p_days: r.audience_days }).then(({ data }) => setCount(typeof data === "number" ? data : null));
  }, [sb, r.client_id, r.audience_kind, r.audience_days]);

  async function audience(kind: Req["audience_kind"], days: number) {
    const { error } = await sb.from("wa_requests").update({ audience_kind: kind, audience_days: days }).eq("id", r.id);
    if (error) return toast("That did not save.", true);
    onChange({ ...r, audience_kind: kind, audience_days: days });
  }
  async function review(status: "approved" | "rejected" | "sent") {
    setBusy(true);
    const { error } = await sb.rpc("wa_review", { p_id: r.id, p_status: status, p_note: note || null });
    setBusy(false);
    if (error) return toast(error.message || "That did not save.", true);
    onChange({ ...r, status, admin_note: note || r.admin_note, recipient_count: status === "rejected" ? null : count });
    toast(status === "approved" ? "Approved and queued. Download the numbers if you are sending it yourself." : status === "sent" ? "Marked as sent" : "Rejected");
    router.refresh();
  }
  async function numbers() {
    const { data, error } = await sb.rpc("wa_audience", { p_client: r.client_id, p_kind: r.audience_kind, p_days: r.audience_days });
    if (error) return toast(error.message || "Could not load the numbers.", true);
    const rows = (data ?? []) as { name: string; phone: string; last_seen_at: string }[];
    downloadCsv(`${r.slug}-offer-numbers.csv`, [["Name", "Phone"], ...rows.map((x) => [x.name, x.phone])]);
  }

  return (
    <article className="d-card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{r.business}</h3><Pill tone={TONE[r.status]}>{r.status}</Pill>{r.status !== "pending" && <Pill tone="gray">{r.sender === "own" ? "own number" : "Taprizz number"}</Pill>}
        <span className="ml-auto text-xs" style={{ color: "var(--d-muted)" }}>{new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
      </div>
      {r.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image_url} alt="Poster sent with the offer" className="max-h-72 rounded-xl object-contain" />
      )}
      <p className="whitespace-pre-wrap text-[15px]" style={{ color: "var(--d-text)" }}>{r.message}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--d-muted)" }}>
        {open ? (
          <>
            <select aria-label="Audience" className="d-input !min-h-10 !w-auto" value={r.audience_kind} onChange={(e) => audience(e.target.value as Req["audience_kind"], r.audience_days)}>
              {(Object.keys(KIND) as Req["audience_kind"][]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
            </select>
            {r.audience_kind !== "all" && (
              <select aria-label="Days" className="d-input !min-h-10 !w-auto" value={r.audience_days} onChange={(e) => audience(r.audience_kind, Number(e.target.value))}>
                {[7, 14, 30, 45, 60].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            )}
          </>
        ) : <span>{KIND[r.audience_kind]}{r.audience_kind !== "all" ? ` ${r.audience_days} days` : ""}</span>}
        <Pill tone="blue">{open ? (count === null ? "counting" : `${count} would receive it`) : `${r.recipient_count ?? 0} recipients`}</Pill>
      </div>
      <p className="text-xs" style={{ color: "var(--d-muted)" }}>Only customers who ticked WhatsApp offers and have not opted out are counted.</p>
      {r.admin_note && <p className="text-sm" style={{ color: "var(--d-sub)" }}>Note: {r.admin_note}</p>}
      {open && (
        <div className="space-y-2">
          <input className="d-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the owner (optional, shown if you reject)" aria-label="Note" />
          <div className="flex flex-wrap gap-2">
            <button className="d-btn d-btn-p" disabled={busy || count === 0} onClick={() => review("approved")}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve</button>
            <button className="d-btn d-btn-s" disabled={busy} onClick={() => review("rejected")}><X size={16} /> Reject</button>
          </div>
          {count === 0 && <p className="text-xs" style={{ color: "var(--d-amber)" }}>Nobody matches this audience yet, so there is nothing to approve.</p>}
        </div>
      )}
      {r.status === "approved" && (
        <div className="flex flex-wrap gap-2">
          <button className="d-btn d-btn-s" onClick={numbers}><Download size={15} /> Download numbers (CSV)</button>
          <button className="d-btn d-btn-p" disabled={busy} onClick={() => review("sent")}><Send size={15} /> Mark as sent</button>
        </div>
      )}
    </article>
  );
}

export function OffersAdmin({ initial }: { initial: Req[] }) {
  const [reqs, setReqs] = useState(initial);
  const [tab, setTab] = useState<Tab>("pending");
  const shown = reqs.filter((r) => r.status === tab);
  const n = (s: Tab) => reqs.filter((r) => r.status === s).length;
  return (
    <div className="space-y-4">
      <div className="d-seg w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Offer requests">
        {(["pending", "approved", "sent", "rejected"] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} ({n(t)})</button>)}
      </div>
      {shown.length === 0 ? <Empty title="Nothing here">{tab === "pending" ? "When an owner sends an offer request, it appears here." : "No requests in this list."}</Empty> : shown.map((r) => <Card key={r.id} r={r} onChange={(x) => setReqs((s) => s.map((y) => (y.id === x.id ? x : y)))} />)}
    </div>
  );
}
