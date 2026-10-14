"use client";

import { LoaderCircle } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode, useCallback, useRef, useState } from "react";

export function useSingleFlight() {
  const activeRef = useRef<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const run = useCallback(async <T,>(key: string, work: () => Promise<T>) => {
    if (activeRef.current) return undefined;
    activeRef.current = key;
    setActive(key);
    try {
      return await work();
    } finally {
      activeRef.current = null;
      setActive(null);
    }
  }, []);

  return {
    active,
    isBusy: (key?: string) => key ? active === key : Boolean(active),
    run,
  };
}

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
};

export function PendingButton({ children, pending = false, pendingLabel = "Saving...", disabled, className, ...props }: PendingButtonProps) {
  return <button {...props} disabled={disabled || pending} aria-busy={pending || undefined} className={`inline-flex items-center justify-center gap-2 ${className ?? ""}`}>
    {pending ? <><LoaderCircle size={15} className="animate-spin" /><span>{pendingLabel}</span></> : children}
  </button>;
}
