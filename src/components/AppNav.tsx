"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Pages where there is nothing "behind" them inside the app.
const ROOT = /^\/(admin|app|login|dashboard(\/[^/]+)?|group(\/[^/]+)?)\/?$/;
export const isRootPath = (p: string) => ROOT.test(p) || p === "/";

const parentOf = (p: string) => {
  const parts = p.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
};

/** A back arrow for the installed app, which has no browser bar. Goes to the page before; if there is none, to the page above. */
export function BackButton({ className = "", style, rootBack }: { className?: string; style?: React.CSSProperties; rootBack?: string }) {
  const path = usePathname();
  const router = useRouter();
  // A root page normally has no back arrow. `rootBack` lets a page that has an owner above it (an admin looking at a chain) still go up.
  if (isRootPath(path) && !rootBack) return null;
  const back = () => {
    if (isRootPath(path) && rootBack) { router.push(rootBack); return; }
    const sameSiteBefore = typeof document !== "undefined" && document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (window.history.length > 1 && sameSiteBefore) router.back();
    else router.push(parentOf(path));
  };
  return (
    <button type="button" onClick={back} aria-label="Back" title="Back" className={className || "grid h-11 w-11 shrink-0 place-items-center rounded-xl"} style={style}>
      <ArrowLeft size={18} aria-hidden />
    </button>
  );
}

/**
 * In the installed app, Back on the first screen would close the whole app. Here the first Back only shows a hint,
 * and a second Back within two seconds really leaves. Everywhere else Back works normally.
 */
export function ExitGuard() {
  const path = usePathname();
  const [hint, setHint] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone || !isRootPath(path)) return;
    window.history.pushState({ tzGuard: true }, "");
    const onPop = () => {
      const now = Date.now();
      if (now - last.current < 2000) { window.history.go(-1); return; }
      last.current = now;
      window.history.pushState({ tzGuard: true }, "");
      setHint(true);
      setTimeout(() => setHint(false), 2000);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [path]);
  if (!hint) return null;
  return <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center"><span className="rounded-full bg-black/85 px-4 py-2 text-sm text-white shadow-lg">Press back again to exit</span></div>;
}

/** Remembers the last screen, so the app opens where it was left (see /app). */
export function RememberPage() {
  const path = usePathname();
  const q = useSearchParams();
  useEffect(() => {
    if (!/^\/(admin|dashboard|group)(\/|$)/.test(path)) return;
    const full = path + (q.toString() ? `?${q.toString()}` : "");
    try { document.cookie = `tz_last=${encodeURIComponent(full.slice(0, 300))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`; } catch { /* nothing to remember */ }
  }, [path, q]);
  return null;
}
