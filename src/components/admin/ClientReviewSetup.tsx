"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LANGS, cleanQuestions, defaultQuestions, type Lang, type Question } from "@/lib/review/questions";
import { useToast } from "@/components/dash/Toast";
import { Pill } from "./ui";
import { QuestionsEditor, TranslateBar } from "./QuestionsEditor";

type Setup = { questions?: unknown; max_questions?: number; languages?: Lang[]; low_star_mode?: string; collect_contact?: boolean; owner_edit_until?: string | null };
type Cat = { id: string; label: string; questions: unknown };

// Per-business review setup: category, how many questions, which questions and chips, languages,
// how low ratings are handled, and a time-limited window that lets the owner edit the questions themselves.
export function ClientReviewSetup({ clientId, clientName, category, setup, categories }: { clientId: string; clientName: string; category: string | null; setup: Setup; categories: Cat[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [cat, setCat] = useState(category ?? "");
  const catQs = () => {
    const c = categories.find((x) => x.id === cat);
    const own = cleanQuestions(c?.questions);
    return own.length ? own : defaultQuestions(cat);
  };
  const [custom, setCustom] = useState<boolean>(cleanQuestions(setup.questions).length > 0);
  const [qs, setQs] = useState<Question[]>(cleanQuestions(setup.questions).length ? cleanQuestions(setup.questions) : []);
  const [max, setMax] = useState(String(setup.max_questions ?? 6));
  const [langs, setLangs] = useState<Lang[]>(setup.languages?.length ? setup.languages : ["hinglish", "en", "hi"]);
  const [low, setLow] = useState(setup.low_star_mode ?? "private_first");
  const [collect, setCollect] = useState(setup.collect_contact === true);
  const [until, setUntil] = useState<string | null>(setup.owner_edit_until ?? null);
  const [busy, setBusy] = useState(false);
  const open = !!until && new Date(until) > new Date();
  const maxN = Math.max(1, Math.min(10, parseInt(max) || 6));

  async function save(patch?: Partial<Setup>, done = "Review setup saved") {
    const clean = custom ? cleanQuestions(qs) : [];
    if (custom && clean.length === 0) return toast("Add at least one question with a label and chips, or switch back to the category questions.", true);
    const next: Setup = {
      questions: custom ? clean : undefined, max_questions: maxN, languages: langs.length ? langs : ["en"], low_star_mode: low, collect_contact: collect,
      owner_edit_until: until, ...patch,
    };
    for (const k of Object.keys(next) as (keyof Setup)[]) if (next[k] === undefined) delete next[k];
    setBusy(true);
    const { error } = await sb.from("clients").update({ business_type: cat || null, review_setup: next }).eq("id", clientId);
    setBusy(false);
    if (error) return toast("That did not save. Please try again.", true);
    toast(done);
    router.refresh();
  }

  const openFor = (hours: number) => {
    const t = hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
    setUntil(t);
    return save({ owner_edit_until: t }, hours > 0 ? `${clientName} can edit their questions until ${new Date(t!).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "Owner editing closed");
  };

  return (
    <section className="d-card p-5">
      <h2 className="font-semibold">AI review setup</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>What this business&apos;s guests are asked, and how their review is written.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Category</span>
          <select className="d-input mt-1.5" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Questions to ask</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>2 to 10</span>
          <input type="number" min={1} max={10} className="d-input mt-1.5" value={max} onChange={(e) => setMax(e.target.value)} /></label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Languages guests can pick</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {LANGS.map((l) => {
            const on = langs.includes(l.id);
            return <button type="button" key={l.id} aria-pressed={on} className="d-btn !min-h-10 !px-4 !text-[13px]" style={on ? { background: "var(--d-text)", color: "var(--d-bg)" } : { background: "var(--d-bg)", color: "var(--d-sub)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }} onClick={() => setLangs(on ? langs.filter((x) => x !== l.id) : [...langs, l.id])}>{l.label}</button>;
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label className="flex min-h-10 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={collect} onChange={(e) => setCollect(e.target.checked)} />
          <span><span className="font-medium" style={{ color: "var(--d-text)" }}>WhatsApp offers: ask guests for name and number</span><br /><span className="text-xs" style={{ color: "var(--d-muted)" }}>Off by default. Switch it on only for businesses that want to send offers to their customers. Then guests see a short &ldquo;Before we start&rdquo; form once, and the owner gets a page to request offers. When it is off, guests go straight in and nothing about them is stored. Collected numbers are deleted after 45 days.</span></span></label>
      </div>

      <label className="mt-4 block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>If a guest gives 1 or 2 stars</span>
        <select className="d-input mt-1.5" value={low} onChange={(e) => setLow(e.target.value)}>
          <option value="private_first">Offer the private message to management first</option>
          <option value="same">Treat it like any other rating</option>
        </select></label>
      <p className="mt-1.5 text-xs" style={{ color: "var(--d-muted)" }}>The Google review link always stays available at every rating. Hiding low ratings is against Google&apos;s rules and puts the business&apos;s reviews at risk, so that option does not exist.</p>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Questions and chips</p>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={custom} onChange={(e) => { setCustom(e.target.checked); if (e.target.checked && qs.length === 0) setQs(catQs()); }} /> Custom questions for this business</label>
        </div>
        {custom ? (
          <div className="mt-2 space-y-3"><TranslateBar value={qs} onChange={setQs} /><QuestionsEditor value={qs} onChange={setQs} /></div>
        ) : (
          <div className="mt-2 text-sm" style={{ color: "var(--d-sub)" }}>
            <p className="mb-2" style={{ color: "var(--d-muted)" }}>Using the {categories.find((c) => c.id === cat)?.label ?? "default"} questions (first {maxN}):</p>
            <ol className="list-decimal space-y-1 pl-5">{catQs().slice(0, maxN).map((q) => <li key={q.id}>{q.label} <span style={{ color: "var(--d-muted)" }}>{q.type === "text" ? "(short answer)" : `· ${q.chips.join(", ")}`}</span></li>)}</ol>
          </div>
        )}
      </div>

      <button className="d-btn d-btn-p mt-5" disabled={busy} onClick={() => save()}>{busy && <Loader2 size={16} className="animate-spin" />} Save review setup</button>

      <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--d-line)" }}>
        <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Let the owner edit the questions</p>{open ? <Pill tone="green">Open until {new Date(until!).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Pill> : <Pill tone="gray">Closed</Pill>}</div>
        <p className="mt-1 text-xs" style={{ color: "var(--d-muted)" }}>For a short time only. When it closes, they can no longer change the questions. They can never change anything else here.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="d-btn d-btn-s" disabled={busy} onClick={() => openFor(24)}>Open for 24 hours</button>
          <button className="d-btn d-btn-s" disabled={busy} onClick={() => openFor(24 * 7)}>Open for 7 days</button>
          {open && <button className="d-btn d-btn-s" disabled={busy} onClick={() => openFor(0)}>Close now</button>}
        </div>
      </div>
    </section>
  );
}
