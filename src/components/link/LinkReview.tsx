"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useBackToClose } from "@/lib/sheet-back";
import { getTheme } from "@/lib/themes";
import type { GuestPageData } from "@/lib/types";
import { ReviewFlow } from "@/components/guest/ReviewFlow";

/**
 * "AI Review by Tap" on a mini link: the guest picks stars, answers a few taps, gets an editable review and opens Google.
 * Nothing about the guest is asked or stored. Every rating gets the same flow; 1 to 3 stars see the private feedback box first,
 * and the Google review link stays available to everyone.
 */
export function LinkReviewSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const [g, setG] = useState<GuestPageData | null>(null);
  const [failed, setFailed] = useState(false);
  useBackToClose(true, onClose);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    let live = true;
    supabaseBrowser().rpc("guest_page", { p_code: code }).then(({ data, error }) => {
      const d = data as GuestPageData | null;
      if (!live) return;
      if (error || !d || !d.live || !d.features?.review || !d.client?.google_review_url) setFailed(true); else setG(d);
    });
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { live = false; document.body.style.overflow = ""; window.removeEventListener("keydown", key); };
  }, [code, onClose]);
  const theme = useMemo(() => (g ? getTheme(g.client.theme, g.client.colors) : null), [g]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Review us">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="guest-root relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] px-5 pb-10 text-fg" data-theme={theme?.dark === false ? "light" : "dark"}
        style={{ ...((theme?.vars ?? {}) as React.CSSProperties), background: "var(--bg, #0f0f10)", color: "var(--text, #f2f2f2)", boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.6)" }}>
        <div className="sticky top-0 z-10 -mx-5 flex items-center gap-2 px-5 py-4" style={{ background: "var(--bg, #0f0f10)" }}>
          <h2 className="flex-1 text-[17px] font-semibold tracking-[-0.01em]">Review {g?.client.name ?? "us"}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--text, #fff) 10%, transparent)" }}><X size={20} /></button>
        </div>
        {!g && !failed && <div className="grid place-items-center py-16"><Loader2 className="animate-spin" /></div>}
        {failed && <p className="py-10 text-center text-sm opacity-80">Reviews are not available on this page right now.</p>}
        {g && <ReviewFlow data={g} code={code} visitor={null} source="mini" onPrivateFeedback={g.features.complaints ? () => {} : undefined} />}
      </div>
    </div>
  );
}
