import { useEffect, useRef } from "react";

// The phone's Back button should close an open sheet first, not leave the page.
// One history entry is shared by every open sheet. It is added when the first sheet opens and removed when the last one closes.
const stack: (() => void)[] = [];
let pushed = false;
let selfPop = false;
let listening = false;
let exitFn: (() => void) | null = null;

function onPop() {
  if (selfPop) { selfPop = false; return; }   // we went back ourselves after a normal close
  if (stack.length === 0 && exitFn) { const f = exitFn; exitFn = null; f(); return; }   // Back from the page itself: offer the stars once, never trap
  pushed = false;
  stack[stack.length - 1]?.();                // the person pressed Back: close the top sheet
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const fn = () => ref.current();
    stack.push(fn);
    if (!listening) { window.addEventListener("popstate", onPop); listening = true; }
    if (!pushed) { window.history.pushState({ tzSheet: true }, ""); pushed = true; }
    return () => {
      const i = stack.indexOf(fn);
      if (i >= 0) stack.splice(i, 1);
      // Wait a tick: when one sheet hands over to another, the entry is kept.
      setTimeout(() => {
        if (stack.length === 0 && pushed) { pushed = false; selfPop = true; window.history.back(); }
      }, 0);
    };
  }, [open]);
}

/** Close the open sheet's history entry, then run something that changes the page (like picking an area). */
export function closeSheetsThen(fn: () => void) {
  if (!pushed) { fn(); return; }
  pushed = false;
  selfPop = true;
  window.addEventListener("popstate", () => fn(), { once: true });
  window.history.back();
}

/**
 * Back from the guest page itself shows the review stars once instead of leaving. It is a nudge, not a trap:
 * the prompt closes with its X or with Back, and the next Back leaves as normal.
 */
export function useExitPrompt(enabled: boolean, onPrompt: () => void, rearm = 0) {
  const ref = useRef(onPrompt);
  useEffect(() => { ref.current = onPrompt; });
  useEffect(() => {
    if (!enabled) return;
    const fn = () => ref.current();
    if (!listening) { window.addEventListener("popstate", onPop); listening = true; }
    window.history.pushState({ tzExit: true }, "");
    exitFn = fn;
    return () => { if (exitFn === fn) exitFn = null; };
  }, [enabled, rearm]);
}
