"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, ChefHat, MessageCircle, ReceiptText, Settings, Sun, Moon, UtensilsCrossed } from "lucide-react";
import { ToastProvider } from "@/components/dash/Toast";
import { NavFeedback } from "@/components/NavFeedback";

const KEY = "taprizz-dash-mode";

// Own shell for the food-ordering area: its own tabs, with one clear way back to the main Taprizz dashboard.
export function PosShell({ slug, clientName, chatUnread = 0, children }: { slug: string; clientName: string; chatUnread?: number; children: React.ReactNode }) {
  const path = usePathname();
  const [mode, setMode] = useState<"dark" | "light">("dark");
  useEffect(() => { try { const m = localStorage.getItem(KEY); if (m === "light" || m === "dark") setMode(m); } catch {} }, []);
  const toggle = () => { const m = mode === "dark" ? "light" : "dark"; setMode(m); try { localStorage.setItem(KEY, m); } catch {} };
  const base = `/pos/${slug}`;
  const tabs = [
    { href: base, label: "Live orders", Icon: ChefHat, exact: true },
    { href: `${base}/menu`, label: "Menu", Icon: UtensilsCrossed, badge: 0 },
    { href: `${base}/bills`, label: "Bills", Icon: ReceiptText, badge: 0 },
    { href: `${base}/chat`, label: "Chat", Icon: MessageCircle, badge: chatUnread },
    { href: `${base}/settings`, label: "Settings", Icon: Settings, badge: 0 },
  ];
  const on = (t: { href: string; exact?: boolean }) => (t.exact ? path === t.href : path.startsWith(t.href));
  const ModeIcon = mode === "dark" ? Sun : Moon;
  return (
    <div className="dash min-h-dvh" data-mode={mode}>
      <ToastProvider>
        <Suspense fallback={null}><NavFeedback /></Suspense>
        <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--d-line)", background: "color-mix(in srgb, var(--d-bg) 82%, transparent)" }}>
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
            <Link href={`/dashboard/${slug}`} className="flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}>
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Taprizz dashboard</span><span className="sm:hidden">Back</span>
            </Link>
            <span className="min-w-0 truncate text-[15px] font-semibold">{clientName}<span className="ml-2 text-xs font-medium" style={{ color: "var(--d-muted)" }}>Food orders</span></span>
            <nav aria-label="Food orders" className="d-seg mx-auto hidden md:flex">
              {tabs.map((t) => (
                <Link key={t.href} href={t.href} aria-current={on(t) ? "page" : undefined}>
                  {t.label}{!!t.badge && <span className="d-chip" style={{ ["--c" as string]: "var(--d-red)" }}>{t.badge}</span>}
                </Link>
              ))}
            </nav>
            <button onClick={toggle} aria-label="Switch light or dark" className="ml-auto grid h-11 w-11 place-items-center rounded-xl md:ml-0" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}><ModeIcon size={17} /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 [overflow-x:clip] md:pb-12">{children}</main>
        <nav aria-label="Food orders" className="fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" style={{ borderColor: "var(--d-line)", background: "color-mix(in srgb, var(--d-bg) 90%, transparent)" }}>
          <div className="grid grid-cols-5">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} aria-current={on(t) ? "page" : undefined} className="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium" style={{ color: on(t) ? "var(--d-text)" : "var(--d-muted)" }}>
                <t.Icon size={21} strokeWidth={on(t) ? 2.2 : 1.8} />{t.label.replace("Live orders", "Orders")}
                {!!t.badge && <span className="absolute top-2 left-1/2 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--d-red)" }}>{t.badge}</span>}
              </Link>
            ))}
          </div>
        </nav>
      </ToastProvider>
    </div>
  );
}
