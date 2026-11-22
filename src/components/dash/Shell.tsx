"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Home, Inbox, PanelsTopLeft, Gem, Sun, Moon, LogOut, ExternalLink, Star, Clapperboard, Megaphone, QrCode, MapPin, BellRing, UtensilsCrossed, Menu, X, ShieldCheck } from "lucide-react";
import { ToastProvider } from "./Toast";
import { Mark } from "./AuthFrame";
import { BackButton, ExitGuard, RememberPage } from "@/components/AppNav";
import { NavFeedback } from "@/components/NavFeedback";
import { Suspense } from "react";
import { closeSheetsThen, useBackToClose } from "@/lib/sheet-back";

const KEY = "taprizz-dash-mode";

export function Shell({
  slug,
  clientName,
  logoUrl,
  openCount,
  contentCount = 0,
  isTeam = false,
  waOn = false,
  tablesOn = false,
  jaipurOn = false,
  upHref,
  callsOn = false,
  callsOpen = 0,
  posOn = false,
  children,
}: {
  slug: string;
  clientName: string;
  logoUrl: string | null;
  openCount: number;
  contentCount?: number;
  isTeam?: boolean;
  waOn?: boolean;
  tablesOn?: boolean;
  jaipurOn?: boolean;
  upHref?: string;
  callsOn?: boolean;
  callsOpen?: number;
  posOn?: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [more, setMore] = useState(false);
  const closeMore = useCallback(() => setMore(false), []);
  useBackToClose(more, closeMore);

  useEffect(() => {
    try {
      const m = localStorage.getItem(KEY);
      if (m === "light" || m === "dark") setMode(m);
    } catch {}
  }, []);
  const toggle = () => {
    const m = mode === "dark" ? "light" : "dark";
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch {}
  };

  const base = `/dashboard/${slug}`;
  type Tab = { href: string; label: string; Icon: typeof Home; exact?: boolean; badge?: number };
  const tabs: Tab[] = [
    { href: base, label: "Home", Icon: Home, exact: true },
    { href: `${base}/inbox`, label: "Inbox", Icon: Inbox, badge: openCount },
    { href: `${base}/reviews`, label: "Reviews", Icon: Star },
    { href: `${base}/content`, label: "Moments", Icon: Clapperboard, badge: contentCount },
    { href: `${base}/my-page`, label: "My Page", Icon: PanelsTopLeft },
    ...(waOn ? [{ href: `${base}/offers`, label: "Offers", Icon: Megaphone } as Tab] : []),
    ...(jaipurOn ? [{ href: `${base}/jaipur`, label: "Gulabi", Icon: MapPin } as Tab] : []),
    ...(callsOn ? [{ href: `${base}/calls`, label: "Calls", Icon: BellRing, badge: callsOpen } as Tab] : []),
    ...(tablesOn ? [{ href: `${base}/tables`, label: "Tables", Icon: QrCode } as Tab] : []),
    ...(posOn ? [{ href: `/pos/${slug}`, label: "Food orders", Icon: UtensilsCrossed } as Tab] : []),
    { href: `${base}/plan`, label: "Plan", Icon: Gem },
  ];
  // Phone bottom bar: four main tabs and "More" for the rest, so nothing is squeezed.
  const mainLabels = ["Home", "Inbox", "Reviews", posOn ? "Food orders" : "My Page"];
  const bottomTabs = mainLabels.map((l) => tabs.find((t) => t.label === l)).filter(Boolean) as Tab[];
  const moreTabs = tabs.filter((t) => !mainLabels.includes(t.label));
  const moreBadge = moreTabs.reduce((a, t) => a + (t.badge ?? 0), 0);
  const active = (t: Tab) => (t.exact ? path === t.href : path.startsWith(t.href));

  const ModeIcon = mode === "dark" ? Sun : Moon;
  const modeLabel = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="dash min-h-dvh" data-mode={mode}>
      <ToastProvider>
        <Suspense fallback={null}><NavFeedback /></Suspense>
        <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--d-line)", background: "color-mix(in srgb, var(--d-bg) 82%, transparent)" }}>
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <BackButton rootBack={upHref} style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }} />
            <span className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1.5 pr-3 pl-1.5 md:flex-none" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)" }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: "#060606" }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Mark size={16} />
                )}
              </span>
              <span className="truncate text-[15px] font-medium" style={{ color: "var(--d-text)" }}>{clientName}</span>
            </span>

            <nav aria-label="Dashboard" className="d-seg mx-auto hidden md:flex">
              {tabs.map((t) => (
                <Link key={t.href} href={t.href} aria-current={active(t) ? "page" : undefined}>
                  {t.label}
                  {!!t.badge && <span className="d-chip" style={{ ["--c" as string]: "var(--d-red)" }}>{t.badge}</span>}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2 md:ml-0">
              {isTeam && (
                <Link href="/admin" aria-label="Admin" className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}>
                  <ShieldCheck size={16} className="md:hidden" /><span className="hidden md:inline">Admin</span>
                </Link>
              )}
              <a href={`/e/${slug}`} target="_blank" rel="noopener" title="Open guest page" aria-label="Open guest page" className="hidden h-11 w-11 place-items-center rounded-xl md:grid" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}>
                <ExternalLink size={17} />
              </a>
              <button onClick={toggle} title={modeLabel} aria-label={modeLabel} className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}>
                <ModeIcon size={17} />
              </button>
              <form action="/auth/signout" method="post" className="hidden md:block">
                <button title="Sign out" aria-label="Sign out" className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}>
                  <LogOut size={17} />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 [overflow-x:clip] md:pb-12">{children}</main>
        <Suspense fallback={null}><RememberPage /></Suspense>
        <ExitGuard />

        {/* Phone: bottom bar */}
        <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" style={{ borderColor: "var(--d-line)", background: "color-mix(in srgb, var(--d-bg) 90%, transparent)" }}>
          <div className="grid grid-cols-5">
            {bottomTabs.map((t) => {
              const { href, label, Icon, badge } = t;
              const on = active(t);
              return (
                <Link key={href} href={href} aria-current={on ? "page" : undefined} className="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium" style={{ color: on ? "var(--d-text)" : "var(--d-muted)" }}>
                  <Icon size={21} strokeWidth={on ? 2.2 : 1.8} />
                  <span className="max-w-full truncate px-0.5">{label}</span>
                  {!!badge && <span className="absolute top-2 left-1/2 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--d-red)" }}>{badge}</span>}
                </Link>
              );
            })}
            <button type="button" onClick={() => setMore(true)} aria-label="More" aria-expanded={more} className="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium" style={{ color: more || moreTabs.some(active) ? "var(--d-text)" : "var(--d-muted)" }}>
              <Menu size={21} strokeWidth={1.8} />More
              {moreBadge > 0 && <span className="absolute top-2 left-1/2 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--d-red)" }}>{moreBadge}</span>}
            </button>
          </div>
        </nav>
        {more && (
          <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="More">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={closeMore} />
            <div className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ background: "var(--d-bg)", boxShadow: "inset 0 1px 0 var(--d-line-2)" }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">More</h2>
                <button type="button" onClick={closeMore} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)" }}><X size={18} /></button>
              </div>
              <ul className="grid grid-cols-3 gap-2.5">
                {moreTabs.map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} onClick={(e) => { e.preventDefault(); closeSheetsThen(() => { setMore(false); router.push(t.href); }); }} className="d-card relative flex min-h-[84px] flex-col items-center justify-center gap-2 p-2 text-[13px] font-medium" aria-current={active(t) ? "page" : undefined}>
                      <t.Icon size={22} />{t.label}
                      {!!t.badge && <span className="absolute top-2 right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--d-red)" }}>{t.badge}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <a href={`/e/${slug}`} target="_blank" rel="noopener" className="d-btn d-btn-s justify-center"><ExternalLink size={16} /> Guest page</a>
                <form action="/auth/signout" method="post"><button className="d-btn d-btn-s w-full justify-center"><LogOut size={16} /> Sign out</button></form>
              </div>
            </div>
          </div>
        )}
      </ToastProvider>
    </div>
  );
}
