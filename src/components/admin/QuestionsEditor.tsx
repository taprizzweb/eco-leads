"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { MAX_QUESTIONS, newQuestionId, type QType, type Question } from "@/lib/review/questions";

const TYPE_LABEL: Record<QType, string> = { multi: "Pick several", single: "Pick one", text: "Short answer" };

function ChipsInput({ chips, onChange, label }: { chips: string[]; onChange: (c: string[]) => void; label: string }) {
  const [v, setV] = useState("");
  const add = () => {
    const parts = v.split(",").map((x) => x.trim().slice(0, 30)).filter(Boolean);
    if (parts.length) onChange([...new Set([...chips, ...parts])].slice(0, 12));
    setV("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="d-raise flex items-center gap-1 py-0.5 pr-0.5 pl-2.5 text-[13px]" style={{ color: "var(--d-text)" }}>{c}
            <button type="button" aria-label={`Remove ${c}`} className="grid h-7 w-7 place-items-center" style={{ color: "var(--d-muted)" }} onClick={() => onChange(chips.filter((x) => x !== c))}><X size={13} /></button>
          </span>
        ))}
      </div>
      <input aria-label={label} className="d-input mt-2 !min-h-10" value={v} placeholder="Type a chip and press Enter (commas add several)" maxLength={80}
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} />
    </div>
  );
}

// Edits the list of questions a guest answers. Each question has a type and its chips.
export function QuestionsEditor({ value, onChange, max = MAX_QUESTIONS }: { value: Question[]; onChange: (q: Question[]) => void; max?: number }) {
  const upd = (i: number, p: Partial<Question>) => onChange(value.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= value.length) return; const a = [...value]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={q.id} className="d-raise space-y-2.5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{i + 1}</span>
            <input aria-label={`Question ${i + 1}`} className="d-input !min-h-10" value={q.label} maxLength={120} onChange={(e) => upd(i, { label: e.target.value })} placeholder="What did you have?" />
            <select aria-label={`Type of question ${i + 1}`} className="d-input !min-h-10 !w-40" value={q.type} onChange={(e) => upd(i, { type: e.target.value as QType, chips: e.target.value === "text" ? [] : q.chips })}>
              {(Object.keys(TYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move question ${i + 1} up`} disabled={i === 0} style={{ color: "var(--d-muted)" }} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move question ${i + 1} down`} disabled={i === value.length - 1} style={{ color: "var(--d-muted)" }} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Remove question ${i + 1}`} style={{ color: "var(--d-muted)" }} onClick={() => onChange(value.filter((_, k) => k !== i))}><Trash2 size={16} /></button>
          </div>
          {q.type !== "text" && <ChipsInput chips={q.chips} label={`Chips for question ${i + 1}`} onChange={(c) => upd(i, { chips: c })} />}
        </div>
      ))}
      <button type="button" className="d-btn d-btn-s" disabled={value.length >= max} onClick={() => onChange([...value, { id: newQuestionId(), label: "", type: "multi", chips: [] }])}>
        <Plus size={15} /> Add question ({value.length} of {max})
      </button>
    </div>
  );
}
