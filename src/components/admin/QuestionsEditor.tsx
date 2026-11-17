"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Languages, Loader2, Plus, Trash2, X } from "lucide-react";
import { LANGS, MAX_QUESTIONS, newQuestionId, type Lang, type QType, type Question } from "@/lib/review/questions";
import { useToast } from "@/components/dash/Toast";

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
            <input aria-label={`Question ${i + 1}`} className="d-input !min-h-10" value={q.label} maxLength={120} onChange={(e) => upd(i, { label: e.target.value, tr: undefined })} placeholder="What did you have?" />
            <select aria-label={`Type of question ${i + 1}`} className="d-input !min-h-10 !w-40" value={q.type} onChange={(e) => upd(i, { type: e.target.value as QType, chips: e.target.value === "text" ? [] : q.chips })}>
              {(Object.keys(TYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move question ${i + 1} up`} disabled={i === 0} style={{ color: "var(--d-muted)" }} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Move question ${i + 1} down`} disabled={i === value.length - 1} style={{ color: "var(--d-muted)" }} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Remove question ${i + 1}`} style={{ color: "var(--d-muted)" }} onClick={() => onChange(value.filter((_, k) => k !== i))}><Trash2 size={16} /></button>
          </div>
          {q.tr && <p className="text-xs" style={{ color: "var(--d-muted)" }}>Also shown in: {LANGS.filter((l) => q.tr?.[l.id]).map((l) => l.label).join(", ")}</p>}
          {q.type === "text" && <p className="text-xs" style={{ color: "var(--d-muted)" }}>The guest types a few words of their own. No chips needed.</p>}
          {q.type !== "text" && <ChipsInput chips={q.chips} label={`Chips for question ${i + 1}`} onChange={(c) => upd(i, { chips: c, tr: undefined })} />}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="d-btn d-btn-s" disabled={value.length >= max} onClick={() => onChange([...value, { id: newQuestionId(), label: "", type: "multi", chips: [] }])}>
          <Plus size={15} /> Add chips question ({value.length} of {max})
        </button>
        <button type="button" className="d-btn d-btn-s" disabled={value.length >= max} onClick={() => onChange([...value, { id: newQuestionId(), label: "", type: "text", chips: [] }])}>
          <Plus size={15} /> Add short-answer question
        </button>
      </div>
    </div>
  );
}

// Write the questions in one language, press the button, and the other languages are filled in.
export function TranslateBar({ value, onChange }: { value: Question[]; onChange: (q: Question[]) => void }) {
  const toast = useToast();
  const [from, setFrom] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const done = value.length > 0 && value.every((q) => LANGS.every((l) => q.tr?.[l.id]));
  async function run() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/translate-questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, questions: value }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Translation failed.");
      onChange(j.questions);
      toast(j.missing ? `Translated, but ${j.missing} question(s) need another try or a manual fix.` : "Done. Guests now see these questions in all three languages.", !!j.missing);
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }
  return (
    <div className="d-raise flex flex-wrap items-center gap-2 p-3">
      <Languages size={16} style={{ color: "var(--d-muted)" }} aria-hidden />
      <span className="text-sm" style={{ color: "var(--d-text)" }}>I wrote these in</span>
      <select aria-label="Language the questions are written in" className="d-input !min-h-10 !w-36" value={from} onChange={(e) => setFrom(e.target.value as Lang)}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
      <button type="button" className="d-btn d-btn-s" disabled={busy || value.length === 0} onClick={run}>{busy && <Loader2 size={15} className="animate-spin" />} {done ? "Translate again" : "Fill the other two languages"}</button>
      <p className="w-full text-xs" style={{ color: "var(--d-muted)" }}>Editing a question or chip afterwards clears its translations, so press this again before saving.</p>
    </div>
  );
}
