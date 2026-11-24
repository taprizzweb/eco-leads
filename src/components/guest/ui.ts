// Shared guest-page styles. Every colour comes from the client's theme variables,
// so the same pills and fields look right on dark and light themes.
export const glassInput =
  "w-full rounded-xl px-5 py-3 text-[15px] text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--text)_35%,transparent)] bg-[color-mix(in_srgb,var(--text)_8%,transparent)]";
export const glassCard =
  "rounded-3xl p-5 shadow-xl backdrop-blur-sm bg-gradient-to-r from-[color-mix(in_srgb,var(--text)_7%,transparent)] to-transparent";
export const pillPrimary =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--btn,var(--text))] px-5 py-3 font-semibold text-[color:var(--btn-text,var(--bg))] shadow-[inset_0_-2px_6px_rgba(0,0,0,0.18),0_8px_24px_-8px_rgba(0,0,0,0.5)] transition active:scale-[0.98] hover:opacity-90 disabled:opacity-60";
export const pillSoft =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition active:scale-[0.98] bg-[color-mix(in_srgb,var(--text)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--text)_16%,transparent)]";
export const chip = (on: boolean) =>
  `min-h-11 rounded-full px-4 text-sm font-medium transition active:scale-95 ${
    on
      ? "bg-[var(--btn,var(--text))] text-[color:var(--btn-text,var(--bg))] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]"
      : "text-fg bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--text)_14%,transparent)]"
  }`;
