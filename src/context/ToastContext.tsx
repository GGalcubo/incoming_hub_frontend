import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Toast } from "../components/ui/Toast";

type ToastKind = "default" | "success";

interface ToastContextValue {
  flash: (msg: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<ToastKind>("default");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      flash: (m: string, k: ToastKind = "default") => {
        setMsg(m);
        setKind(k);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setMsg(""), 2400);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast msg={msg} kind={kind} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
