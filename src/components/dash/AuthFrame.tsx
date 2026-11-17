export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="13" fill="#d6d6d6" />
      <path d="M7.4 14.6c.7-3.6 2.9-6 6.6-6.7" fill="none" stroke="#2a2a2a" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="16.9" cy="16.6" r="1.9" fill="#2a2a2a" />
    </svg>
  );
}

export function AuthFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="dash flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 grid h-14 w-14 place-items-center rounded-xl" style={{ background: "linear-gradient(180deg,rgba(74,74,74,.86),rgba(42,42,42,.86))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)" }}>
            <Mark size={26} />
          </span>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em]">{title}</h1>
          <p className="mt-2 text-[15px]" style={{ color: "var(--d-muted)" }}>{sub}</p>
        </div>
        <div className="d-card p-5">{children}</div>
      </div>
    </div>
  );
}
