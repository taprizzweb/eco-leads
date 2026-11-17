"use client";

import { useState } from "react";
import { Star, Copy, Check, Loader2 } from "lucide-react";
import type { GuestPageData } from "@/lib/types";
import { chip, glassInput, pillPrimary } from "./ui";

const COMPANY = [
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
  { id: "partner", label: "Partner" },
  { id: "solo", label: "Solo" },
  { id: "work", label: "Work" },
] as const;

const RECOMMEND = [
  { id: "yes", label: "Yes" },
  { id: "maybe", label: "Maybe" },
  { id: "no", label: "No" },
] as const;

type Step = "stars" | "chips" | "draft";

// Google rules: the Google button is visible at every rating, nothing is rewarded,
// and the private line for low ratings never replaces it.
export function ReviewFlow({
  data,
  code,
  onPrivateFeedback,
}: {
  data: GuestPageData;
  code: string;
  onPrivateFeedback?: () => void;
}) {
  const [step, setStep] = useState<Step>("stars");
  const [rating, setRating] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [company, setCompany] = useState<string>();
  const [recommend, setRecommend] = useState<string>();
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleUrl = data.client.google_review_url;

  const toggle = (c: string) => setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  async function makeDraft() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, rating, chips, company, recommend }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setDraft(j.draft);
      setDraftId(j.id ?? null);
      setStep("draft");
    } catch {
      setError("We could not write the draft right now. You can still write your own below.");
      setDraft("");
      setStep("draft");
    } finally {
      setLoading(false);
    }
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the guest can still select the text manually.
    }
    if (draftId) {
      fetch("/api/review-draft/copied", { method: "POST", body: JSON.stringify({ id: draftId }) }).catch(() => {});
    }
    if (googleUrl) window.open(googleUrl, "_blank", "noopener");
  }

  const pill = chip;

  return (
    <div className="space-y-5">
      {/* Step 1: stars */}
      <div>
        <p className="mb-3 text-sm text-muted">How was your visit?</p>
        <div className="flex justify-between" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => {
                setRating(n);
                if (step === "stars") setStep("chips");
              }}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--text)_7%,transparent)] transition active:scale-90"
            >
              <Star size={30} className={`transition-transform duration-200 ${n <= rating ? "scale-110 fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)]" : "text-muted"}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: chips */}
      {step !== "stars" && (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm text-muted">What stood out?</legend>
            <div className="flex flex-wrap gap-2">
              {data.client.review_chips.map((c) => (
                <button key={c} onClick={() => toggle(c)} aria-pressed={chips.includes(c)} className={pill(chips.includes(c))}>
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Who did you come with?</legend>
            <div className="flex flex-wrap gap-2">
              {COMPANY.map((c) => (
                <button key={c.id} onClick={() => setCompany(company === c.id ? undefined : c.id)} aria-pressed={company === c.id} className={pill(company === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Would you recommend us?</legend>
            <div className="flex flex-wrap gap-2">
              {RECOMMEND.map((c) => (
                <button key={c.id} onClick={() => setRecommend(recommend === c.id ? undefined : c.id)} aria-pressed={recommend === c.id} className={pill(recommend === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          {step === "chips" && (
            <button
              onClick={makeDraft}
              disabled={loading}
              className={pillPrimary}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Writing your draft" : "Write my review"}
            </button>
          )}
        </div>
      )}

      {/* Step 3: editable draft */}
      {step === "draft" && (
        <div className="space-y-3">
          <label htmlFor="draft" className="block text-sm text-muted">
            Your review. Change anything you like.
          </label>
          {error && <p className="text-sm text-amber-400">{error}</p>}
          <textarea
            id="draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className={`${glassInput} rounded-2xl leading-relaxed`}
          />
          <button
            onClick={copyAndOpen}
            disabled={!googleUrl}
            className={pillPrimary}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            Copy review and open Google
          </button>
          <p className="text-center text-xs text-muted">Your review is copied. Paste it in the Google box and post.</p>
        </div>
      )}

      {/* Low ratings: a quiet private option that never blocks the Google button. */}
      {rating > 0 && rating <= 3 && onPrivateFeedback && (
        <button onClick={onPrivateFeedback} className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4">
          Tell the management privately
        </button>
      )}

      {step !== "draft" && googleUrl && (
        <a href={googleUrl} target="_blank" rel="noopener" className="block min-h-11 py-3 text-center text-sm text-muted underline underline-offset-4">
          Skip and write on Google directly
        </a>
      )}
    </div>
  );
}
