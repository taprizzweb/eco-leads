"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

/** The logo of any website a button points to: the site's own icon, picked from its web address. If it cannot load, the plain link icon shows. */
export function SiteLogo({ url }: { url: string }) {
  const [bad, setBad] = useState(false);
  let host = "";
  try { host = new URL(url).hostname; } catch { /* not a web address */ }
  if (!host || bad) return <Link2 size={21} strokeWidth={1.7} />;
  return (
    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg" style={{ background: "#fff" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
    </span>
  );
}
