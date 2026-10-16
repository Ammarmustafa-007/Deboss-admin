"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };
type Notify = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<Notify | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const notify = useCallback<Notify>((message, tone = "success") => {
    const id = ++nextId.current;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 3600);
  }, [dismiss]);
  const value = useMemo(() => notify, [notify]);
  return <ToastContext.Provider value={value}>
    {children}
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      {items.map((item) => <div key={item.id} role="status" className={cn("pointer-events-auto flex items-start gap-3 rounded-[12px] border bg-white p-3.5 pr-2 text-sm shadow-[0_18px_40px_-18px_rgba(0,0,0,.45)] animate-rise", item.tone === "success" ? "border-success/30" : "border-danger/35")}>
        {item.tone === "success" ? <CheckCircle2 size={18} className="mt-px shrink-0 text-success" /> : <AlertTriangle size={18} className="mt-px shrink-0 text-danger" />}
        <p className="flex-1 font-medium leading-5">{item.message}</p>
        <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-black/5 hover:text-ink"><X size={14} /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used inside ToastProvider.");
  return notify;
}
