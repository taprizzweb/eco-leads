"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Star, Copy, Check, Loader2, ArrowLeft, RefreshCw, HeartHandshake, Smile, Mic, Send } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { GuestPageData } from "@/lib/types";
import { LANGS, localize, resolveQuestions, type Lang } from "@/lib/review/questions";
import { isEventChip, isEventGuest } from "@/lib/review/event";
import type { Visitor } from "@/lib/visitor";
import { chip, glassInput, pillPrimary, pillSoft } from "./ui";

type Step = "stars" | "q" | "draft";
const MAX_TRIES = 3;
type SpeechLike = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

// The guest's own answers become their review. The Google button is always available, at every rating,
// and nothing is ever offered in return for a review. Low ratings are offered a private message first.
// One exception, by place and not by rating: a guest who says they were at an event stall did not visit the outlet,
// so their words go privately to the management and no Google review is written or linked for them.
export function ReviewFlow({ data, code, visitor, onPrivateFeedback, source }: { data: GuestPageData; code: string; visitor: Visitor | null; onPrivateFeedback?: () => void; source?: "mini" }) {
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
  // 1 to 3 stars: a blank box to type or speak into, sent privately to the management. The Google link stays available.
  const [fb, setFb] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbSent, setFbSent] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const [fbContact, setFbContact] = useState(false);   // only if the guest chooses to be contacted
  const [fbName, setFbName] = useState("");
  const [fbPhone, setFbPhone] = useState("");
  const [listening, setListening] = useState(false);
  const recog = useRef<{ stop: () => void } | null>(null);
  const canSpeak = typeof window !== "undefined" && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  // Remembered on this phone once the guest has opened Google with their review, so the next tap says so instead of starting again.
  const reviewedKey = `tz_reviewed_${data.client.id}`;
  const [already, setAlready] = useState(false);
  // Once Google has been opened, the guest coming back to this page is thanked instead of seeing the stars again.
  const [opened, setOpened] = useState(false);
  const [posted, setPosted] = useState(false);
  useEffect(() => { try { if (localStorage.getItem(reviewedKey)) setAlready(true); } catch { /* fine */ } }, [reviewedKey]);

  useEffect(() => {
    try { const s = localStorage.getItem("tz_lang") as Lang | null; if (s && langs.some((l) => l.id === s)) setLang(s); } catch { /* fine */ }
  }, [langs]);
  useEffect(() => {
    if (!opened) return;
    let left = document.visibilityState === "hidden";
    const onVis = () => { if (document.visibilityState === "hidden") left = true; else if (left) setPosted(true); };
    const onShow = () => { if (left) setPosted(true); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pageshow", onShow); window.removeEventListener("focus", onShow); };
  }, [opened]);
  const pickLang = (l: Lang) => { setLang(l); try { localStorage.setItem("tz_lang", l); } catch { /* fine */ } };

  const q = questions[qi];
  const lq = q ? localize(q, lang) : null;
  const lowStars = rating > 0 && rating <= 3 && lowMode === "private_first" && !!onPrivateFeedback && !continueAnyway;
  const eventGuest = isEventGuest(Object.values(answers));
  // The private box, for 1 to 3 stars or for an event stall guest (who gets it only if the business can receive messages).
  const privateBox = eventGuest ? !!onPrivateFeedback : lowStars && step !== "draft";

  // The guest tapped the stall answer by mistake: clear it and show that question again.
  function undoEvent() {
    const at = questions.findIndex((x) => (answers[x.id] ?? []).some(isEventChip));
    setAnswers((a) => Object.fromEntries(Object.entries(a).map(([id, v]) => [id, v.filter((x) => !isEventChip(x))])));
    setFbSent(false); setFbError(null); setContinueAnyway(true);
    if (at >= 0) setQi(at);
    setStep("q");
  }

  function choose(n: number) {
    setRating(n);
    try { sessionStorage.setItem(`tz_rated_${data.client.id}`, "1"); } catch { /* fine */ }   // the page behind stops offering the stars on Back
    setError(null);
    if (step === "stars") { if (questions.length) setStep("q"); else void write({}); }
  }

  // "pick one" questions move on by themselves the moment a chip is tapped. "pick several" waits for Next.
  function toggle(id: string, type: "multi" | "single" | "text", chipValue: string) {
    if (type === "single") {
      const next = { ...answers, [id]: [chipValue] };
      setAnswers(next);
      setTimeout(() => advance(next), 220);
      return;
    }
    setAnswers((a) => {
      const cur = a[id] ?? [];
      return { ...a, [id]: cur.includes(chipValue) ? cur.filter((x) => x !== chipValue) : [...cur, chipValue] };
    });
  }

  // After the last question the review is written straight away. No extra step.
  function advance(a: Record<string, string[]> = answers) {
    if (isEventGuest(Object.values(a))) return;
    if (qi + 1 < questions.length) setQi((i) => Math.min(i + 1, questions.length - 1));
    else void write(a);
  }
  function back() {
    if (qi > 0) setQi(qi - 1);
    else setStep("stars");
  }

  async function write(a: Record<string, string[]> = answers, own: string = extra) {
    if (!rating) return setError("Tap a star rating first.");
    setLoading(true);
    setError(null);
    try {
      const send = () => fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code, rating, language: lang, name: visitor?.name ?? "", extra: own, src: source,
          answers: questions.map((x) => ({ id: x.id, values: a[x.id] ?? [] })),
        }),
      });
      const t0 = Date.now();
      let res = await send();
      // A busy writer (a fast 503) is retried once on its own, so the guest rarely sees a hiccup. A slow one is not.
      if (res.status === 503 && Date.now() - t0 < 9000) { await new Promise((r) => setTimeout(r, 2500)); res = await send(); }
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

  function toggleMic() {
    if (listening) { recog.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike };
    const R = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = lang === "en" ? "en-IN" : "hi-IN";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " "; if (t) setFb((v) => (v ? v.trimEnd() + " " : "") + t.trim()); };
    r.onerror = () => { setListening(false); setFbError("The microphone did not start. Allow it in your browser, or type instead."); };
    r.onend = () => setListening(false);
    setFbError(null);
    recog.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }
  async function sendFeedback() {
    const text = fb.trim();
    if (!text) { setFbError("Write or say a few words first."); return; }
    const ph = fbPhone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    if (fbContact && ph && !/^[6-9]\d{9}$/.test(ph)) { setFbError("Please type a 10 digit mobile number, or leave it empty."); return; }
    const share = fbContact && !!ph;
    recog.current?.stop();
    setFbSending(true); setFbError(null);
    const { error: e } = await supabaseBrowser().rpc("guest_submit_feedback", { p_client: data.client.id, p_code: code, p_kind: "complaint", p_body: `${source === "mini" ? "[Mini link] " : ""}${eventGuest ? "[Event stall] " : ""}[${rating} star${rating > 1 ? "s" : ""}] ${text}`, p_media: [], p_name: share && fbName.trim() ? fbName.trim().slice(0, 60) : null, p_phone: share ? `+91${ph}` : null, p_consent: share });
    setFbSending(false);
    if (e) { setFbError("Your message did not send. Check your connection and try again. Nothing you wrote was lost."); return; }
    setFbSent(true);
  }

  async function copyAndOpen() {
    try { await navigator.clipboard.writeText(draft); setCopied(true); } catch { /* the guest can still select the text */ }
    if (draftId) fetch("/api/review-draft/copied", { method: "POST", body: JSON.stringify({ id: draftId }) }).catch(() => {});
    markReviewed();
    if (googleUrl) window.open(googleUrl, "_blank", "noopener");
  }
  function markReviewed() {
    try { localStorage.setItem(reviewedKey, String(Date.now())); } catch { /* fine */ }
    setOpened(true);
  }
  function openGoogleDirect() {
    markReviewed();
    if (googleUrl) window.open(googleUrl, "_blank", "noopener");
  }

  if (posted || already) {
    return (
      <div className="py-6 text-center" role="status">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Smile size={38} /></span>
        <p className="mt-4 text-lg font-semibold">{posted ? "Thank you for posting your review" : "Review already done"}</p>
        <p className="mt-1 text-sm text-muted">{posted ? `It means a lot to everyone at ${data.client.name}.` : `Thank you for reviewing ${data.client.name}. It means a lot to us.`}</p>
        <button type="button" className="mt-5 min-h-11 text-sm text-muted underline underline-offset-4" onClick={() => { try { localStorage.removeItem(reviewedKey); } catch { /* fine */ } setAlready(false); setPosted(false); setOpened(false); }}>Someone else on this phone? Review again</button>
      </div>
    );
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

      {/* An event stall guest, when the business cannot receive messages here: a thank you only. */}
      {eventGuest && !onPrivateFeedback && (
        <div className="space-y-2 rounded-3xl p-5 text-center bg-[color-mix(in_srgb,var(--text)_7%,transparent)]" role="status">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Smile size={32} /></span>
          <p className="text-lg font-semibold">Thank you for visiting our stall</p>
          <p className="text-sm text-muted">We hope to see you at our outlet.</p>
          <button className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4" onClick={undoEvent}>Change my answer</button>
        </div>
      )}

      {/* 1 to 3 stars: a box to type or speak into, sent privately to the management. The Google link stays available. */}
      {privateBox && (
        fbSent ? (
          <div className="space-y-2 rounded-3xl p-5 text-center bg-[color-mix(in_srgb,var(--text)_7%,transparent)]" role="status">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Smile size={32} /></span>
            <p className="text-lg font-semibold">Thank you for your feedback</p>
            <p className="text-sm text-muted">The management will read it.</p>
            {!eventGuest && <button className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4" onClick={() => { setFbSent(false); setContinueAnyway(true); }}>I would also like to write a Google review</button>}
          </div>
        ) : (
          <div className="space-y-3 rounded-3xl p-4 bg-[color-mix(in_srgb,var(--text)_7%,transparent)]">
            <label htmlFor="fb" className="flex items-center gap-2 font-semibold"><HeartHandshake size={18} /> {eventGuest ? "How was it at our stall?" : "What could we do better?"}</label>
            {eventGuest && <p className="text-sm text-muted">This goes privately to the team. Google reviews are for visits to our outlet.</p>}
            <div className="relative">
              <textarea id="fb" rows={5} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={1000} className={`${glassInput} rounded-2xl pr-14 leading-relaxed`} placeholder={listening ? "Listening..." : "Type here" + (canSpeak ? ", or tap the mic and speak" : "")} />
              {canSpeak && (
                <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak instead of typing"} className={`absolute right-2 bottom-2 grid h-11 w-11 place-items-center rounded-full ${listening ? "bg-red-500 text-white" : "bg-[color-mix(in_srgb,var(--text)_12%,transparent)]"}`}>
                  <Mic size={20} className={listening ? "animate-pulse" : ""} />
                </button>
              )}
            </div>
            {!fbContact
              ? <button type="button" className="min-h-10 w-full text-left text-sm text-muted underline underline-offset-4" onClick={() => setFbContact(true)}>Want them to get back to you? (optional)</button>
              : (
                <div className="space-y-2 rounded-2xl p-3 bg-[color-mix(in_srgb,var(--text)_6%,transparent)]">
                  <p className="text-xs text-muted">Only if you want. They will use it only to reply to this.</p>
                  <input className={glassInput} maxLength={60} value={fbName} onChange={(e) => setFbName(e.target.value)} placeholder="Your name (optional)" autoComplete="name" aria-label="Your name, optional" />
                  <input className={glassInput} inputMode="numeric" maxLength={14} value={fbPhone} onChange={(e) => setFbPhone(e.target.value)} placeholder="Mobile number (optional)" autoComplete="tel" aria-label="Your mobile number, optional" />
                </div>
              )}
            {fbError && <p role="alert" className="text-sm text-amber-400">{fbError}</p>}
            <button className={pillPrimary} onClick={() => void sendFeedback()} disabled={fbSending}>{fbSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}{fbSending ? "Sending" : "Send"}</button>
            {eventGuest
              ? <button type="button" className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4" onClick={undoEvent}>Change my answer</button>
              : <button className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4" onClick={() => setContinueAnyway(true)}>I would rather write a Google review</button>}
          </div>
        )
      )}

      {!lowStars && !eventGuest && step === "q" && q && lq && (
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
            <button className={pillPrimary} onClick={() => advance()} disabled={loading}>{loading && <Loader2 size={18} className="animate-spin" />}{loading ? "Writing your review" : (answers[q.id]?.length ?? 0) > 0 && answers[q.id][0] !== "" ? (qi + 1 === questions.length ? "Write my review" : "Next") : qi + 1 === questions.length ? "Skip and write" : "Skip"}</button>
          </div>
        </section>
      )}

      {step === "draft" && !eventGuest && (
        <section className="space-y-3">
          <label htmlFor="draft" className="block text-sm text-muted">Your review. Change anything you like.</label>
          {error && <p role="alert" className="text-sm text-amber-400">{error}</p>}
          <textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className={`${glassInput} rounded-2xl leading-relaxed`} />
          {googleUrl && !draft.trim() && (
            <button type="button" onClick={openGoogleDirect} className={pillPrimary}>Open Google and write your review</button>
          )}
          {!!draft.trim() && (
            <button onClick={copyAndOpen} disabled={!googleUrl} className={pillPrimary}>
              {copied ? <Check size={18} /> : <Copy size={18} />} Copy review and open Google
            </button>
          )}
          {tries < MAX_TRIES && (
            <div className="space-y-2">
              <input className={glassInput} maxLength={300} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Want to add something in your own words? (optional)" aria-label="Add something in your own words" />
              <button onClick={() => write()} disabled={loading} className={pillSoft}>{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {extra.trim() ? "Rewrite with this" : "Write another version"}</button>
            </div>
          )}
          {!!draft.trim() && <p className="text-center text-xs text-muted">Your review is copied. Paste it in the Google box and post.</p>}
        </section>
      )}

      {googleUrl && !eventGuest && (step !== "draft" || !!draft.trim()) && (
        <button type="button" onClick={openGoogleDirect} className="block min-h-11 w-full py-3 text-center text-sm text-muted underline underline-offset-4">Skip and write on Google directly</button>
      )}
    </div>
  );
}
