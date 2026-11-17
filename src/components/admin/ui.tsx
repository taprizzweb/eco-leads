import Link from "next/link";
import type { ReactNode } from "react";

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">{title}</h1>
        {sub && <p className="mt-1 text-[15px]" style={{ color: "var(--d-muted)" }}>{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone: string; sub?: string }) {
  return (
    <div className="d-card p-4">
      <p className="d-col-h text-[13px] font-medium" style={{ ["--c" as string]: tone, color: "var(--d-muted)" }}>{label}</p>
      <p className="mt-3 text-[30px] leading-none font-semibold tabular-nums tracking-[-0.04em]" style={{ color: "var(--d-text)" }}>{value}</p>
      {sub && <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>{sub}</p>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "green" | "amber" | "red" | "blue" | "gray"; children: ReactNode }) {
  const c = { green: "var(--d-green)", amber: "var(--d-amber)", red: "var(--d-red)", blue: "var(--d-blue)", gray: "var(--d-muted)" }[tone];
  return <span className="d-chip" style={{ ["--c" as string]: c }}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="d-card flex flex-col items-center px-6 py-12 text-center">
      <p className="font-medium" style={{ color: "var(--d-text)" }}>{title}</p>
      {children && <p className="mt-1 max-w-md text-sm" style={{ color: "var(--d-muted)" }}>{children}</p>}
    </div>
  );
}

export const inr = (n: number) => "Rs " + n.toLocaleString("en-IN");
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No expiry");

/** Expiry cell: how many days are left, coloured by urgency. */
export function Expiry({ iso, days }: { iso: string | null; days: number | null }) {
  if (!iso || days === null) return <span style={{ color: "var(--d-muted)" }}>No expiry</span>;
  const tone = days < 0 ? "red" : days <= 5 ? "amber" : "gray";
  return (
    <span className="whitespace-nowrap">
      {fmtDate(iso)} <Pill tone={tone}>{days < 0 ? `${-days}d ago` : days === 0 ? "today" : `${days}d`}</Pill>
    </span>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="d-card overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left text-[14px]">{children}</table></div>;
}
export const th = "px-4 py-3 text-xs font-semibold uppercase tracking-wide";
export const td = "px-4 py-3 align-middle";
export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-t" style={{ borderColor: "var(--d-line)" }}>{children}</tr>;
}
export function A({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium underline-offset-4 hover:underline" style={{ color: "var(--d-text)" }}>{children}</Link>;
}
