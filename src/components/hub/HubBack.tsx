"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HUB_PATH } from "@/lib/hub-shared";

const KEY = "hub_in_app";

/** Placed on the hub list: remembers that the person is browsing inside the app, so Back on a place page can truly go back. */
export function HubMark() {
  useEffect(() => { try { sessionStorage.setItem(KEY, "1"); } catch {} }, []);
  return null;
}

export function HubBack() {
  const router = useRouter();
  const back = () => {
    let inApp = false;
    try { inApp = sessionStorage.getItem(KEY) === "1"; } catch {}
    if (inApp && window.history.length > 1) router.back();
    else router.push(HUB_PATH);
  };
  return (
    <button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--d-text)" }}>
      <ArrowLeft size={16} aria-hidden /> Wapas
    </button>
  );
}
