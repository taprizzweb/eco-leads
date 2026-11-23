import type { Metadata } from "next";
import { InstallScreen } from "@/components/InstallScreen";

export const metadata: Metadata = { title: "Get the Taprizz app", robots: { index: false } };

export default function InstallPage() {
  const base = (process.env.NEXT_PUBLIC_PLATE_BASE_URL || "https://app.taprizz.in").replace(/\/$/, "");
  return <InstallScreen link={`${base}/install`} />;
}
