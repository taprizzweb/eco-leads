"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, Users, QrCode, BellRing, Wallet, Layers, Plug, Sparkles, ScrollText, UserCog, Sun, Moon, LogOut } from "lucide-react";
import { ToastProvider } from "@/components/dash/Toast";
import { Mark } from "@/components/dash/AuthFrame";

const KEY = "taprizz-dash-mode";
type Item = { href: string; label: string; Icon: typeof Users; exact?: boolean; min?: "manager"; badge?: number };

export function AdminShell({ role, email, alerts, children }: { role: "owner" | "manager" | "rep"; email: string; alerts: number; children: React.ReactNode }) {
  const path = usePathname();
  const [mode, setMode] = useState<"dark" | "light">("dark");
  useEffect(() => {
    try { const m = localStorage.getItem(KEY); if (m === "light" || m === "dark") setMode(m); } catch {}
  }, []);
  const toggle = () => {
    const m = mode === "dark" ? "light" : "dark";
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch {}
  };

  const items: Item[] = [
    { href: "/admin", label: "Overview", Icon: LayoutGrid, exact: true },
    { href: "/admin/clients", label: "Clients", Icon: Users },
    { href: "/admin/plates", label: "Plates and QR", Icon: QrCode },
    { href: "/admin/alerts", label: "Alerts", Icon: BellRing, badge: alerts },
    { href: "/admin/billing", label: "Billing", Icon: Wallet },
    { href: "/admin/packages", label: "Packages", Icon: Layers },
    { href: "/admin/ai-studio", label: "AI Review Studio", Icon: Sparkles, min: "manager" },
    { href: "/admin/integrations", label: "Integrations", Icon: Plug, min: "manager" },
    { href: "/admin/audit", label: "Audit log", Icon: ScrollText, min: "manager" },
    { href: "/admin/team", label: "Team", Icon: UserCog, min: "manager" },
  ].filter((i) => !i.min || role !== "rep") as Item[];
  const on = (i: Item) => (i.exact ? path === i.href : path.startsWith(i.href));
  const ModeIcon = mode === "dark" ? Sun : Moon;
  const iconBtn = "grid h-11 w-11 place-items-center rounded-xl";
  const iconStyle = { background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" };

  return (
    <div className="dash min-h-dvh" data-mode={mode}>
      <ToastProvider>
        <div className="mx-auto flex max-w-[1400px]">
          {/* Sidebar: laptop */}
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 lg:flex" style={{ borderColor: "var(--d-line)" }}>
            <div className="mb-6 flex items-center gap-2.5 px-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "#060606" }}><Mark size={20} /></span>
              <div className="leading-tight">
                <p className="text-[15px] font-semibold" style={{ color: "var(--d-text)" }}>Taprizz</p>
                <p className="text-xs" style={{ color: "var(--d-muted)" }}>Admin · {role}</p>
              </div>
            </div>
            <nav aria-label="Admin" className="flex flex-1 flex-col gap-1">
              {items.map((i) => (
                <Link key={i.href} href={i.href} aria-current={on(i) ? "page" : undefined} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium" style={on(i) ? { background: "var(--d-surface)", color: "var(--d-text)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" } : { color: "var(--d-muted)" }}>
                  <i.Icon size={17} />
                  <span className="flex-1">{i.label}</span>
                  {!!i.badge && <span className="d-chip" style={{ ["--c" as string]: "var(--d-red)" }}>{i.badge}</span>}
                </Link>
              ))}
            </nav>
            <div className="space-y-2 border-t pt-4" style={{ borderColor: "var(--d-line)" }}>
              <p className="truncate px-2 text-xs" style={{ color: "var(--d-muted)" }}>{email}</p>
              <div className="flex gap-2">
                <button onClick={toggle} title={mode === "dark" ? "Light mode" : "Dark mode"} aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={iconBtn} style={iconStyle}><ModeIcon size={17} /></button>
                <form action="/auth/signout" method="post"><button title="Sign out" aria-label="Sign out" className={iconBtn} style={iconStyle}><LogOut size={17} /></button></form>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Top bar: phone and tablet */}
            <header className="sticky top-0 z-30 border-b backdrop-blur-xl lg:hidden" style={{ borderColor: "var(--d-line)", background: "color-mix(in srgb, var(--d-bg) 85%, transparent)" }}>
              <div className="flex h-14 items-center gap-2 px-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "#060606" }}><Mark size={18} /></span>
                <span className="flex-1 font-semibold" style={{ color: "var(--d-text)" }}>Taprizz Admin</span>
                <button onClick={toggle} aria-label="Toggle light or dark" className={iconBtn} style={iconStyle}><ModeIcon size={17} /></button>
                <form action="/auth/signout" method="post"><button aria-label="Sign out" className={iconBtn} style={iconStyle}><LogOut size={17} /></button></form>
              </div>
              <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
                {items.map((i) => (
                  <Link key={i.href} href={i.href} aria-current={on(i) ? "page" : undefined} className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium" style={on(i) ? { background: "var(--d-surface)", color: "var(--d-text)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" } : { color: "var(--d-muted)" }}>
                    {i.label}{!!i.badge && <span className="d-chip" style={{ ["--c" as string]: "var(--d-red)" }}>{i.badge}</span>}
                  </Link>
                ))}
              </nav>
            </header>
            <main className="px-4 pt-6 pb-16 lg:px-8"><div className="[overflow-x:clip]">{children}</div></main>
          </div>
        </div>
      </ToastProvider>
    </div>
  );
}
