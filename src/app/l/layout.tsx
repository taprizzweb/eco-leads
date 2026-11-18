import { Bebas_Neue } from "next/font/google";

// The condensed display face used for names and buttons on mini link pages.
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-bebas" });

export default function LinkLayout({ children }: { children: React.ReactNode }) {
  return <div className={bebas.variable}>{children}</div>;
}
