"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

function useOverlay(open: boolean, onClose: () => void, dismissible: boolean) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && dismissible) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose, dismissible]);
  return panel;
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Set false while a save is running so the overlay cannot be closed mid-request. */
  dismissible?: boolean;
  className?: string;
};

export function Modal({ open, onClose, title, subtitle, children, footer, dismissible = true, className }: OverlayProps) {
  const panel = useOverlay(open, onClose, dismissible);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-[2px] animate-fade" onMouseDown={(event) => { if (event.target === event.currentTarget && dismissible) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" className={cn("w-full max-w-lg rounded-[18px] bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,.5)] animate-rise", className)}>
      <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} dismissible={dismissible} />
      <div className="px-6 pb-6">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-6 py-4">{footer}</div>}
    </div>
  </div>, document.body);
}

export function Drawer({ open, onClose, title, subtitle, children, footer, dismissible = true, className }: OverlayProps) {
  const panel = useOverlay(open, onClose, dismissible);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] animate-fade" onMouseDown={(event) => { if (event.target === event.currentTarget && dismissible) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" className={cn("flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-slide-from-right", className)}>
      <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} dismissible={dismissible} bordered />
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-6 py-4">{footer}</div>}
    </div>
  </div>, document.body);
}

function OverlayHeader({ title, subtitle, onClose, dismissible, bordered = false }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; dismissible: boolean; bordered?: boolean }) {
  return <div className={cn("flex items-start justify-between gap-4 px-6 pb-4 pt-5", bordered && "border-b border-line-soft")}>
    <div className="min-w-0"><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div>
    <button type="button" onClick={onClose} disabled={!dismissible} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-muted hover:bg-black/[.05] hover:text-ink disabled:opacity-40"><X size={18} /></button>
  </div>;
}
