"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, Copy, Check, Loader2, ArrowLeft, RefreshCw, HeartHandshake } from "lucide-react";
import type { GuestPageData } from "@/lib/types";
import { LANGS, localize, resolveQuestions, type Lang } from "@/lib/review/questions";
import type { Visitor } from "@/lib/visitor";
import { chip, glassInput, pillPrimary, pillSoft } from "./ui";

type Step = "stars" | "q" | "extra" | "draft";
const MAX_TRIES = 3;

// The guest's own answers become their review. The Google button is always available, at every rating,
// and nothing is ever offered in return for a review. Low ratings are offered a private message first.
export function ReviewFlow({ data, code, visitor, onPrivateFeedback }: { data: GuestPageData; code: string; visitor: Visitor | null; onPrivateFeedback?: () => void }) {
  const questions = useMemo(() => resolveQuestions(data.review, data.client.business_type), [data.review, data.client.business_type]);
  const langs = useMemo(() => LANGS.filter((l) => (data.review?.languages ?? LANGS.map((x) => x.id)).includes(l.id)), [data.review]);
  const lowMode = data.review?.low_star_mode ?? "private_first";
  const googleUrl = data.client.google_review_url;

  const [lang, setLang] = useState<Lang>(langs[0]?.id ?? "en");
  const [rating, setRating] = useState(0);
  const [step, setStep] = useState<Step>("stars");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [extra, setExtra] = useState("");
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continueAnyway, setContinueAnyway] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem("tz_lang") as Lang | null; if (s && langs.some((l) => l.id === s)) setLang(s); } catch { /* fine */ }
  }, [langs]);
  const pickLang = (l: Lang) => { setLang(l); try { localStorage.setItem("tz_lang", l); } catch { /* fine */ } };

  const q = questions[qi];
  const lq = q ? localize(q, lang) : null;
  const lowStars = rating > 0 && rating <= 2 && lowMode === "private_first" && !!onPrivateFeedback && !continueAnyway;

  function choose(n: number) {
    setRating(n);
    setError(null);
    if (step === "stars") setStep(questions.length ? "q" : "extra");
  }

  function toggle(id: string, type: "multi" | "single" | "text", chipValue: string) {
    setAnswers((a) => {
      const cur = a[id] ?? [];
      if (type === "single") return { ...a, [id]: cur[0] === chipValue ? [] : [chipValue] };
      return { ...a, [id]: cur.includes(chipValue) ? cur.filter((x) => x !== chipValue) : [...cur, chipValue] };
    });
  }

  function next() {
    if (qi + 1 < questions.length) setQi(qi + 1);
    else setStep("extra");
  }
  function back() {
    if (step === "extra") { setQi(Math.max(0, questions.length - 1)); setStep(questions.length ? "q" : "stars"); }
    else if (qi > 0) setQi(qi - 1);
    else setStep("stars");
  }

  async function write() {
    if (!rating) return setError("Tap a star rating first.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code, rating, language: lang, name: visitor?.name ?? "", extra,
          answers: questions.map((x) => ({ id: x.id, values: answers[x.id] ?? [] })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "We could not write the review right now.");
      setDraft(j.draft);
      setDraftId(j.id ?? null);
      setTries((t) => t + 1);
      setCopied(false);
      setStep("draft");
    } catch (e) {
      setError((e as Error).message + " You can also write your own below.");
      if (step !== "draft") { setDraft(""); setStep("draft"); }
    } finally {
      setLoading(false);
    }
  }

  async function copyAndOpen() {
    try { await navigator.clipboard.writeText(draft); setCopied(true); } catch { /* the guest can still select the text */ }
    if (draftId) fetch("/api/review-draft/copied", { method: "POST", body: JSON.stringify({ id: draftId }) }).catch(() => {});
    if (googleUrl) window.open(googleUrl, "_blank", "noopener");
  }

  return (
    <div className="space-y-5">
      {langs.length > 1 && (
        <div role="group" aria-label="Review language" className="flex items-center gap-2">
          <span className="text-xs text-muted">Write in</span>
          {langs.map((l) => <button key={l.id} aria-pressed={lang === l.id} onClick={() => pickLang(l.id)} className={chip(lang === l.id)}>{l.label}</button>)}
        </div>
      )}

      <div>
        <p className="mb-3 text-sm text-muted">{visitor?.name ? `${visitor.name}, how was your visit?` : "How was your visit?"}</p>
        <div className="flex justify-between" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => choose(n)} className="grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--text)_7%,transparent)] transition active:scale-90">
              <Star size={30} className={`transition-transform duration-200 ${n <= rating ? "scale-110 fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)]" : "text-muted"}`} />
            </button>
          ))}
        </div>
      </div>

      {/* 1 and 2 stars: a private message comes first. The Google link below stays available. */}
      {lowStars && step !== "draft" && (
        <div className="space-y-3 rounded-3xl p-4 bg-[color-mix(in_srgb,var(--text)_7%,transparent)]">
          <p className="flex items-center gap-2 font-semibold"><HeartHandshake size={18} /> We are sorry it was not great</p>
          <p className="text-sm text-muted">Tell the management directly. They read every message and want to put it right.</p>
          <button className={pillPrimary} onClick={onPrivateFeedback}>Tell the management privately</button>
          <button className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4" onClick={() => setContinueAnyway(true)}>I still want to write a review</button>
        </div>
      )}

      {!lowStars && step === "q" && q && lq && (
        <section aria-labelledby="q-label" className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]"><div className="h-full rounded-full bg-fg transition-all" style={{ width: `${((qi + 1) / (questions.length + 1)) * 100}%` }} /></div>
            <span className="text-xs tabular-nums text-muted">{qi + 1} of {questions.length}</span>
          </div>
          <h3 id="q-label" className="text-lg font-semibold">{lq.label}</h3>
          {q.type === "text" ? (
            <input aria-labelledby="q-label" className={glassInput} maxLength={200} value={answers[q.id]?.[0] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: [e.target.value] }))} />
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="q-label">
              {lq.chips.map((c) => <button key={c.value} aria-pressed={(answers[q.id] ?? []).includes(c.value)} onClick={() => toggle(q.id, q.type, c.value)} className={chip((answers[q.id] ?? []).includes(c.value))}>{c.text}</button>)}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button className={`${pillSoft} !w-auto px-5`} onClick={back} aria-label="Back"><ArrowLeft size={18} /></button>
            <button className={pillPrimary} onClick={next}>{(answers[q.id]?.length ?? 0) > 0 && answers[q.id][0] !== "" ? (qi + 1 === questions.length ? "Next" : "Next question") : "Skip"}</button>
          </div>
        </section>
      )}

      {!lowStars && step === "extra" && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Anything you would like to add?</h3>
          <p className="-mt-1 text-sm text-muted">Optional. A few of your own words make the review truly yours.</p>
          <textarea className={`${glassInput} min-h-24 rounded-2xl`} rows={3} maxLength={300} value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Anything you would like to add" />
          {error && <p role="alert" className="text-sm text-amber-400">{error}</p>}
          <div className="flex gap-2">
            <button className={`${pillSoft} !w-auto px-5`} onClick={back} aria-label="Back"><ArrowLeft size={18} /></button>
            <button className={pillPrimary} onClick={write} disabled={loading}>{loading && <Loader2 size={18} className="animate-spin" />}{loading ? "Writing your review" : "Write my review"}</button>
          </div>
        </section>
      )}

      {step === "draft" && (
        <section className="space-y-3">
          <label htmlFor="draft" className="block text-sm text-muted">Your review. Change anything you like.</label>
          {error && <p role="alert" className="text-sm text-amber-400">{error}</p>}
          <textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className={`${glassInput} rounded-2xl leading-relaxed`} />
          <button onClick={copyAndOpen} disabled={!googleUrl || !draft.trim()} className={pillPrimary}>
            {copied ? <Check size={18} /> : <Copy size={18} />} Copy review and open Google
          </button>
          {tries < MAX_TRIES && (
            <button onClick={write} disabled={loading} className={pillSoft}>{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Write another version</button>
          )}
          <p className="text-center text-xs text-muted">Your review is copied. Paste it in the Google box and post.</p>
        </section>
      )}

      {step !== "draft" && googleUrl && (
        <a href={googleUrl} target="_blank" rel="noopener" className="block min-h-11 py-3 text-center text-sm text-muted underline underline-offset-4">Skip and write on Google directly</a>
      )}
    </div>
  );
}
