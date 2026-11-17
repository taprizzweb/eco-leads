"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type T = { id: number; text: string; bad?: boolean };
const Ctx = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(Ctx);

// Every owner action gets instant feedback at the bottom of the screen.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, bad?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, text, bad }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => (
          <div key={t.id} className="d-raise pointer-events-auto flex items-center gap-2 px-4 py-3 text-sm shadow-2xl" style={{ color: "var(--d-text)" }}>
            {t.bad ? <AlertCircle size={16} style={{ color: "var(--d-red)" }} /> : <CheckCircle2 size={16} style={{ color: "var(--d-green)" }} />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
