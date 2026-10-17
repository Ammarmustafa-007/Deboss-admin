"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { currentPeriod, periodLabel, shiftPeriod } from "@/components/finance/finance-data";

/** Month stepper. Future months are not selectable. */
export function MonthPicker({ value, onChange, className }: { value: string; onChange: (period: string) => void; className?: string }) {
  const atCurrent = value >= currentPeriod();
  return <div className={cn("inline-flex h-10 items-center rounded-control border border-line bg-white", className)}>
    <button type="button" onClick={() => onChange(shiftPeriod(value, -1))} aria-label="Previous month" className="grid h-full w-9 place-items-center rounded-l-control text-muted hover:bg-black/[.04] hover:text-ink"><ChevronLeft size={16} /></button>
    <span className="min-w-36 px-2 text-center text-sm font-semibold">{periodLabel(value)}</span>
    <button type="button" onClick={() => onChange(shiftPeriod(value, 1))} disabled={atCurrent} aria-label="Next month" className="grid h-full w-9 place-items-center rounded-r-control text-muted hover:bg-black/[.04] hover:text-ink disabled:opacity-30"><ChevronRight size={16} /></button>
  </div>;
}
