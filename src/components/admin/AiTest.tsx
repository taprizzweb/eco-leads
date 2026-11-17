"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Pill } from "./ui";

type Result = { ok: boolean; provider: string; ms: number; text?: string; error?: string; hint?: string };

export function AiTest() {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);
  async function run() {
    setBusy(true); setR(null);
    try {
      const res = await fetch("/api/admin/ai-test", { method: "POST" });
      const j = await res.json();
      setR(res.ok ? j : { ok: false, provider: "-", ms: 0, error: j.error || "The test could not run." });
    } catch { setR({ ok: false, provider: "-", ms: 0, error: "The test could not reach the server." }); }
    setBusy(false);
  }
  return (
    <div>
      <button className="d-btn d-btn-p" onClick={run} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Send a test review</button>
      <div aria-live="polite" className="mt-3">
        {r && (
          <div className="d-raise p-4">
            <p className="flex items-center gap-2 font-medium" style={{ color: "var(--d-text)" }}>
              {r.ok ? <CheckCircle2 size={18} style={{ color: "var(--d-green)" }} /> : <XCircle size={18} style={{ color: "var(--d-red)" }} />}
              {r.ok ? "It answered" : "It did not answer"} <Pill tone={r.ok ? "green" : "red"}>{r.provider}</Pill> <span className="text-xs font-normal" style={{ color: "var(--d-muted)" }}>{r.ms} ms</span>
            </p>
            {r.text && <p className="mt-2 text-[15px] whitespace-pre-wrap" style={{ color: "var(--d-sub)" }}>{r.text}</p>}
            {r.error && <p className="mt-2 text-sm" style={{ color: "var(--d-red)" }}>{r.error}</p>}
            {r.hint && <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>{r.hint}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
