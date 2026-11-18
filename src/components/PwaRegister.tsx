"use client";

import { useEffect } from "react";

// Registers the service worker that makes the installed app open reliably. Only on the real site.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* the site still works without it */ });
  }, []);
  return null;
}
