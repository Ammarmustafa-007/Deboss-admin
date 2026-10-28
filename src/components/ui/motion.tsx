"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Small motion helpers shared across the app. Things animate when their value *changes* (a status moves on, a count
 * goes up), never on first paint, so lists and pages don't flicker when they load.
 */

/** How many times `value` has changed since this component mounted (render-time "previous value" pattern). */
export function useChangeCount<T>(value: T) {
  const [state, setState] = useState({ value, count: 0 });
  if (!Object.is(state.value, value)) {
    setState({ value, count: state.count + 1 });
    return state.count + 1;
  }
  return state.count;
}

/** Statuses that read as a win get the celebratory effect; setbacks get a short shake; everything else a pop. */
const wins = new Set(["QUALIFIED", "CUSTOMER", "APPROVED", "PAID", "COMPLETED", "DELIVERED", "ONBOARDED", "RUNNING", "ACTIVE", "BOOKED", "HANDED_OFF", "SIGNED_OFF", "COLLECTED"]);
const setbacks = new Set(["REJECTED", "LOST", "RETURNED", "EXCEPTION", "OVERDUE", "NOT_QUALIFIED", "NOT_INTERESTED", "CANCELLED", "DISCARDED", "INACTIVE", "DNC", "MISSED_PICKUP"]);
export function statusMotion(status?: string | null) {
  return status && wins.has(status) ? "win" : status && setbacks.has(status) ? "setback" : "change";
}
export const motionClass = { win: "animate-status-win", setback: "animate-status-setback", change: "animate-status-pop" } as const;

/** A burst of little dots from the centre of its (relative) parent, in the current text colour. */
export function Sparkles({ count = 8 }: { count?: number }) {
  return <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
    {Array.from({ length: count }, (_, index) => <span key={index} className="absolute h-1 w-1 rounded-full bg-current animate-spark" style={{ "--spark-angle": `${(360 / count) * index}deg`, animationDelay: `${(index % 2) * 40}ms` } as CSSProperties} />)}
  </span>;
}

/** Wraps a status pill/chip: re-mounts it with the right effect whenever `status` changes. */
export function StatusMotion({ status, className, children }: { status?: string | null; className?: string; children: ReactNode }) {
  const changes = useChangeCount(status);
  const kind = statusMotion(status);
  return <span key={changes} className={cn("relative inline-flex", changes > 0 && motionClass[kind], className)}>
    {children}
    {changes > 0 && kind === "win" && <Sparkles />}
  </span>;
}

/** Gives a number or short label a quick bump whenever it changes (KPI values, tab counts, badges). */
export function Bump({ value, children, className }: { value: unknown; children?: ReactNode; className?: string }) {
  const tracked = typeof value === "number" || typeof value === "string" || value === null || value === undefined ? value : String(value);
  const changes = useChangeCount(tracked);
  return <span key={changes} className={cn("inline-block", changes > 0 && "animate-bump", className)}>{children ?? (value as ReactNode)}</span>;
}
