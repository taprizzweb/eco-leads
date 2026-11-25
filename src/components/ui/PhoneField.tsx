"use client";

import { indianNational } from "@/lib/linkpage";

// An Indian mobile number box: +91 is already there, the person types the 10 digits. Numbers that came in with another country code stay as they are.
export function PhoneField({ label, value, onChange, placeholder = "98765 43210" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const v = value.trim();
  const foreign = v.startsWith("+") && !v.startsWith("+91");
  // The stored value is "+91" and the 10 digits. What is shown is only those digits, exactly as the person typed them.
  const digits = v.replace(/\D/g, "");
  const nat = v.startsWith("+91") ? digits.slice(2, 12) : (indianNational(v) ?? digits.replace(/^(91|0)(?=\d{10}$)/, "")).slice(0, 10);
  if (foreign) return <input aria-label={label} className="d-input !min-h-10" inputMode="tel" maxLength={20} value={value} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className="flex">
      <span className="grid shrink-0 place-items-center rounded-l-xl px-3 text-sm font-medium" style={{ background: "var(--d-bg)", color: "var(--d-sub)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>+91</span>
      <input aria-label={label} className="d-input !min-h-10 !rounded-l-none" inputMode="numeric" autoComplete="off" value={nat} placeholder={placeholder}
        onChange={(e) => { let d = e.target.value.replace(/\D/g, ""); if (d.length > 10) d = d.replace(/^(91|0)/, ""); d = d.slice(0, 10); onChange(d ? `+91${d}` : ""); }} />
    </div>
  );
}
