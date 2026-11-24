"use client";

import { useEffect, useState } from "react";
import { isHex } from "@/lib/linkpage";

export const BG_SWATCHES = ["#000000", "#0b0b0c", "#1c1c1e", "#0b1020", "#0d1b2a", "#0f2a1d", "#14060b", "#2b0f1f", "#3b1c0a", "#4a2c1a", "#7a1f2b", "#b3202a", "#d9531e", "#e8a317", "#f2d98d", "#f7f3ec", "#ffffff", "#dff3e4", "#d6ecff", "#e9defa", "#fbd5e0", "#1f7a4d", "#0f766e", "#2563eb", "#6d28d9", "#be185d"];

export function ColorField({ label, hint, value, fallback, onChange, swatches }: { label: string; hint?: string; value: string | undefined; fallback: string; onChange: (v: string | undefined) => void; swatches?: string[] }) {
  const [text, setText] = useState(value ?? "");
  // Follows the value when something else changes it (a reset), while typing a half-finished code keeps what was typed.
  useEffect(() => { setText(value ?? ""); }, [value]);
  const shown = value && isHex(value) ? value : fallback;
  const commit = (v: string) => { setText(v); const t = v.trim(); if (!t) onChange(undefined); else if (isHex(t.startsWith("#") ? t : "#" + t)) onChange((t.startsWith("#") ? t : "#" + t).toLowerCase()); };
  return (
    <div className="space-y-2">
      <div className="text-sm"><span className="font-medium">{label}</span>{hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{hint}</span>}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" aria-label={`${label}: pick any colour`} value={shown} onChange={(e) => commit(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
        <input aria-label={`${label}: colour code`} className="d-input !min-h-10 !w-28 font-mono text-sm" maxLength={7} placeholder="#rrggbb" value={text} onChange={(e) => commit(e.target.value)} />
        <button type="button" className="d-btn d-btn-s" onClick={() => { setText(""); onChange(undefined); }} disabled={!value}>Use template colour</button>
      </div>
      {swatches && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label}: quick colours`}>
          {swatches.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => commit(c)} className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: value === c ? "0 0 0 2px var(--d-bg), 0 0 0 4px var(--d-text)" : "inset 0 0 0 1px var(--d-line-2)" }} />)}
        </div>
      )}
    </div>
  );
}
