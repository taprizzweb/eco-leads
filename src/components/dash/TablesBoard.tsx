"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./Toast";

type P = { code: string; label: string | null; menu_url: string | null };

// Owner view: one ordering link per table plate. The guest taps View menu on that table's plate and lands on that table's link.
export function TablesBoard({ plates: p0 }: { plates: P[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [plates, setPlates] = useState(p0);
  const [text, setText] = useState<Record<string, string>>(Object.fromEntries(p0.map((p) => [p.code, p.menu_url ?? ""])));
  const [busy, setBusy] = useState<string | null>(null);

  async function save(p: P) {
    const u = (text[p.code] ?? "").trim();
    if (u && !/^https:\/\/\S+$/.test(u)) return toast("The link must start with https://", true);
    setBusy(p.code);
    const { error } = await sb.rpc("set_plate_menu", { p_code: p.code, p_url: u });
    setBusy(null);
    if (error) return toast("The link did not save. Please try again.", true);
    setPlates((s) => s.map((x) => (x.code === p.code ? { ...x, menu_url: u || null } : x)));
    toast(u ? `${p.label ?? "Plate"} will open this link` : `${p.label ?? "Plate"} now opens your main menu`);
  }

  if (plates.length === 0) return <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>No table plates yet. Ask Taprizz to add a plate for each table.</div>;
  return (
    <ul className="space-y-3">
      {plates.map((p) => {
        const changed = (text[p.code] ?? "").trim() !== (p.menu_url ?? "");
        return (
          <li key={p.code} className="d-card p-4">
            <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>{p.label ?? "Plate"}</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input className="d-input min-w-0 flex-1" inputMode="url" placeholder="Paste this table's ordering link (https://)" value={text[p.code] ?? ""} onChange={(e) => setText((s) => ({ ...s, [p.code]: e.target.value }))} />
                <button type="button" className="d-btn d-btn-p" disabled={!changed || busy === p.code} onClick={() => save(p)}>
                  {busy === p.code ? <Loader2 size={15} className="animate-spin" /> : !changed && p.menu_url ? <Check size={15} /> : null} {!changed && p.menu_url ? "Saved" : "Save"}
                </button>
              </div>
            </label>
            {!p.menu_url && <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>Empty: this table opens your main menu link.</p>}
          </li>
        );
      })}
    </ul>
  );
}
