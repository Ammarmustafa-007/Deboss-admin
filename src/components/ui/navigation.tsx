"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem<T extends string> = { value: T; label: ReactNode; count?: number; hidden?: boolean };

/** Underlined tabs with optional count badges (prototype `.tabs`). */
export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (value: T) => void; className?: string }) {
  return <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
    {items.filter((item) => !item.hidden).map((item) => {
      const active = item.value === value;
      return <button key={item.value} role="tab" type="button" aria-selected={active} onClick={() => onChange(item.value)} className={cn("-mb-px flex items-center gap-1.5 border-b-[3px] px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors", active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink")}>
        {item.label}
        {item.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-brand text-ink" : "bg-[#EEEBE4] text-ink/70")}>{item.count}</span>}
      </button>;
    })}
  </div>;
}

/** Pill-style segmented control (prototype `.seg`). */
export function Segmented<T extends string>({ items, value, onChange, className }: { items: { value: T; label: ReactNode }[]; value: T; onChange: (value: T) => void; className?: string }) {
  return <div className={cn("inline-flex rounded-control border border-line bg-white p-[3px]", className)}>
    {items.map((item) => <button key={item.value} type="button" aria-pressed={item.value === value} onClick={() => onChange(item.value)} className={cn("min-h-8 rounded-lg px-3.5 text-[13px] transition-colors", item.value === value ? "bg-ink font-medium text-white" : "text-muted hover:text-ink")}>{item.label}</button>)}
  </div>;
}

export type Step = { label: ReactNode; hint?: ReactNode };

/**
 * Horizontal progress stepper (prototype `.stp`).
 * `current` is the index of the active step; steps before it render as done.
 * Pass `current = steps.length` to show every step completed. `tone="danger"` marks the current step as blocked.
 */
export function Stepper({ steps, current, tone = "brand", className }: { steps: Step[]; current: number; tone?: "brand" | "danger"; className?: string }) {
  return <ol className={cn("flex w-full", className)}>
    {steps.map((step, index) => {
      const done = index < current;
      const active = index === current;
      return <li key={index} className={cn("relative flex flex-1 flex-col items-center gap-1.5 px-1 text-center text-xs", active ? "font-medium text-ink" : "text-muted")}>
        {index > 0 && <span aria-hidden className={cn("absolute right-1/2 top-[13px] h-0.5 w-full", done || active ? "bg-success" : "bg-line")} />}
        <span className={cn("relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 bg-white text-xs font-semibold", done && "border-success bg-success text-white", active && (tone === "danger" ? "border-danger text-danger" : "border-brand text-brand shadow-[0_0_0_4px_rgba(247,148,29,.15)]"), !done && !active && "border-line")}>
          {done ? <Check size={14} strokeWidth={3} /> : index + 1}
        </span>
        <span className="leading-tight">{step.label}</span>
        {step.hint && <span className="text-[11px] leading-tight text-muted">{step.hint}</span>}
      </li>;
    })}
  </ol>;
}
