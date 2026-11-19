import { BackButton } from "@/components/AppNav";
// Sign-in look shared by every account type: business owners and their staff,
// the Taprizz admin, and Taprizz employees. Styled after the HextaUI
// "Modern Stunning Sign In" card (src/components/ui/modern-stunning-sign-in.tsx).

// The Taprizz logo on a light circle, so its dark bars stay visible on dark screens.
export function Mark({ size = 26 }: { size?: number }) {
  const h = Math.round(size * 0.6);
  return (
    <span aria-hidden="true" className="inline-grid shrink-0 place-items-center rounded-full bg-white" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/taprizz-logo.png" alt="" height={h} width={Math.round(h * 0.727)} style={{ height: h, width: "auto" }} draggable={false} />
    </span>
  );
}

// Shared classes so login, 2-step and the business picker look identical.
export const authInput =
  "w-full rounded-xl bg-white/10 px-5 py-3 text-[15px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400";
export const authBtn =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white shadow transition hover:bg-white/20 disabled:opacity-60";
export const authBtnStrong =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#3a3b3d] to-[#2d2e30] px-5 py-3 text-sm font-medium text-white shadow transition hover:brightness-110 disabled:opacity-60";
export const authLabel = "mb-1.5 block text-sm text-gray-300";

const PLACES = [
  { src: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=96&h=96&fit=crop&fm=webp&q=70", label: "Cafes" },
  { src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=96&h=96&fit=crop&fm=webp&q=70", label: "Salons" },
  { src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=96&h=96&fit=crop&fm=webp&q=70", label: "Gyms" },
  { src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=96&h=96&fit=crop&fm=webp&q=70", label: "Stays" },
];

export function AuthFrame({ title, sub, children, foot }: { title: string; sub: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#121212] px-4 py-10 text-gray-300">
      <div className="absolute top-3 left-3 z-20"><BackButton className="grid h-11 w-11 place-items-center rounded-xl text-gray-300" style={{ background: "#ffffff10" }} /></div>
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-6 rounded-full shadow-lg">
          <Mark size={56} />
        </div>
        <h1 className="text-center text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 mb-6 text-center text-sm text-gray-400">{sub}</p>
        <div className="w-full">{children}</div>
      </div>

      <div className="relative z-10 mt-12 flex flex-col items-center text-center">
        {foot ?? (
          <p className="mb-3 text-sm text-gray-400">
            Made for <span className="font-medium text-white">cafes, salons, gyms and stays</span>.
          </p>
        )}
        <div className="flex">
          {PLACES.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.label} src={p.src} alt={p.label} width={32} height={32} className="-ml-1 h-8 w-8 rounded-full border-2 border-[#181824] object-cover first:ml-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
