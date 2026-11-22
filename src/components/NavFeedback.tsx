"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Makes every internal link feel pressed at once, before the next page has arrived:
 * the tapped link dims and shows a spinner, and a thin bar runs along the top until the new page is in.
 * It listens to taps on the whole document, so no link needs to be changed.
 */
export function NavFeedback() {
  const path = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const pending = useRef<HTMLAnchorElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    setBusy(false);
    if (timer.current) clearTimeout(timer.current);
    pending.current?.removeAttribute("data-pending");
    pending.current = null;
  };

  // the new page is in: stop
  useEffect(() => { finish(); }, [path, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin) return;
      if (u.pathname === window.location.pathname && u.search === window.location.search) return;
      finish();
      pending.current = a;
      a.setAttribute("data-pending", "");
      setBusy(true);
      timer.current = setTimeout(finish, 20000); // never leave the bar running if something goes wrong
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return <div aria-hidden className={`nav-bar ${busy ? "nav-bar-on" : ""}`} />;
}
