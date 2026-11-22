"use client";

import { useEffect } from "react";

// Opens the print dialog once the slip is on screen. The Print again button is for a second copy.
export function AutoPrint() {
  useEffect(() => {
    const btn = document.getElementById("print-btn");
    const go = () => window.print();
    btn?.addEventListener("click", go);
    const t = setTimeout(go, 400);
    return () => { clearTimeout(t); btn?.removeEventListener("click", go); };
  }, []);
  return null;
}
