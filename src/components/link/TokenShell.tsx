"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { ToastProvider } from "@/components/dash/Toast";

const KEY = "taprizz-dash-mode";

// The control link has no login, so it brings its own light and dark switch and a plain header.
export function TokenShell({ name, children }: { name: string; children: React.ReactNode }) {
  const [mode, setMode] = useState<"dark" | "light">("light");
  useEffect(() => { try { const m = localStorage.getItem(KEY); if (m === "light" || m === "dark") setMode(m); } catch {} }, []);
  const toggle = () => { const m = mode === "dark" ? "light" : "dark"; setMode(m); try { localStorage.setItem(KEY, m); } catch {} };
  const Icon = mode === "dark" ? Sun : Moon;
  return (
    <div className="dash min-h-dvh" data-mode={mode}>
      <ToastProvider>
        <header className="border-b" style={{ borderColor: "var(--d-line)" }}>
          <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}<span className="ml-2 text-xs font-medium" style={{ color: "var(--d-muted)" }}>Mini link control</span></span>
            <button onClick={toggle} aria-label="Switch light or dark" className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}><Icon size={17} /></button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 pt-5 pb-16">{children}</main>
      </ToastProvider>
    </div>
  );
}
