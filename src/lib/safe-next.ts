/**
 * Where to go after signing in. Only a path on this same site is accepted. Anything else
 * ("https://evil.example", "//evil.example", "javascript:...", "/\\evil.example") falls back to the dashboard.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  const v = (raw ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\u0000-\u001f]/.test(v)) return fallback;
  try {
    const u = new URL(v, "https://taprizz.invalid");
    if (u.origin !== "https://taprizz.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
