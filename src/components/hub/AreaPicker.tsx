"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import type { HubArea } from "@/lib/hub-shared";
import { HUB_PATH } from "@/lib/hub-shared";
import { closeSheetsThen, useBackToClose } from "@/lib/sheet-back";

// "All of Jaipur" comes first, then every area. The page is rebuilt on the server for the chosen area, so the link can be shared.
export function AreaPicker({ areas, area, cat }: { areas: HubArea[]; area: string; cat: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useBackToClose(open, () => setOpen(false));
  const current = areas.find((a) => a.id === area)?.name ?? "All of Jaipur";
  const shown = useMemo(() => areas.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())), [areas, q]);
  const go = (id: string) => {
    const p = new URLSearchParams();
    if (id) p.set("area", id);
    if (cat) p.set("cat", cat);
    setOpen(false); setQ("");
    closeSheetsThen(() => router.push(`${HUB_PATH}${p.size ? `?${p}` : ""}`));
  };
  const opt = (id: string, label: string) => (
    <button key={id || "all"} type="button" role="radio" aria-checked={id === area} onClick={() => go(id)}
      className="d-raise flex min-h-12 w-full items-center justify-between px-4 text-left text-[15px] font-medium" style={{ color: "var(--d-text)", boxShadow: id === area ? "inset 0 0 0 1.5px var(--d-amber)" : undefined }}>
      {label}{id === area && <span className="text-xs" style={{ color: "var(--d-amber)" }}>Selected</span>}
    </button>
  );
  return (
    <>
      <button type="button" className="d-btn d-btn-s !min-h-11 !px-4" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <MapPin size={15} aria-hidden /> {current} <ChevronDown size={15} aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Apna area chuno" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="dash w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl" data-mode="dark" style={{ background: "var(--d-surface)", maxHeight: "86dvh", overflowY: "auto", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--d-text)" }}>Aap kahan hain?</h2>
              <button type="button" aria-label="Band karo" className="grid h-11 w-11 place-items-center" style={{ color: "var(--d-muted)" }} onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
              <input aria-label="Area dhoondho" className="d-input !pl-10" placeholder="Area dhoondho" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Area">
              {!q.trim() && opt("", "All of Jaipur")}
              {shown.map((a) => opt(a.id, a.name))}
              {q.trim() && shown.length === 0 && <p className="py-4 text-center text-sm" style={{ color: "var(--d-muted)" }}>Ye area abhi list mein nahi hai.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
