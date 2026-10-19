"use client";

import { Eye, EyeOff, Upload } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const controlClass = "h-11 w-full rounded-control border border-[#D8D4CB] bg-white px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/35 hover:border-[#BFB7A6] focus:border-brand focus:shadow-[0_0_0_4px_rgba(247,148,29,.18)] focus-visible:outline-none disabled:bg-line-soft disabled:text-ink/45";

function FieldShell({ label, hint, optional, error, htmlFor, className, children }: { label: ReactNode; hint?: ReactNode; optional?: boolean; error?: ReactNode; htmlFor: string; className?: string; children: ReactNode }) {
  return <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink/80">
      <span>{label}</span>{optional && <span className="text-[11px] font-normal text-muted">Optional</span>}
    </label>
    {children}
    {error ? <p className="text-xs text-[#C4254B]">{error}</p> : hint && <p className="text-xs text-muted">{hint}</p>}
  </div>;
}

type Common = { label: ReactNode; hint?: ReactNode; error?: ReactNode; wrapperClassName?: string };

export function TextField({ label, hint, error, wrapperClassName, className, id, required, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const fallback = useId();
  const inputId = id ?? fallback;
  return <FieldShell label={label} hint={hint} error={error} optional={!required} htmlFor={inputId} className={wrapperClassName}>
    <input id={inputId} required={required} {...props} className={cn(controlClass, error && "border-danger", className)} />
  </FieldShell>;
}

export function PasswordInput({ label, hint, error, wrapperClassName, className, id, required, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const fallback = useId();
  const inputId = id ?? fallback;
  const [visible, setVisible] = useState(false);
  return <FieldShell label={label} hint={hint} error={error} optional={!required} htmlFor={inputId} className={wrapperClassName}>
    <span className="relative block">
      <input id={inputId} required={required} {...props} type={visible ? "text" : "password"} className={cn(controlClass, "pr-11", className)} />
      <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink">{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </span>
  </FieldShell>;
}

export type Option = string | { value: string; label: string };

export function SelectField({ label, hint, error, wrapperClassName, className, id, required, options, placeholder, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  const fallback = useId();
  const selectId = id ?? fallback;
  return <FieldShell label={label} hint={hint} error={error} optional={!required} htmlFor={selectId} className={wrapperClassName}>
    <select id={selectId} required={required} {...props} className={cn(controlClass, "pr-8", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((item) => { const option = typeof item === "string" ? { value: item, label: item } : item; return <option key={option.value} value={option.value}>{option.label}</option>; })}
    </select>
  </FieldShell>;
}

export function TextAreaField({ label, hint, error, wrapperClassName, className, id, required, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fallback = useId();
  const areaId = id ?? fallback;
  return <FieldShell label={label} hint={hint} error={error} optional={!required} htmlFor={areaId} className={wrapperClassName}>
    <textarea id={areaId} required={required} {...props} className={cn(controlClass, "h-auto min-h-24 resize-y py-2.5", className)} />
  </FieldShell>;
}

/** Keyboard-accessible file picker: the native input stays focusable, styled as a drop zone. */
export function FilePicker({ label, file, onFile, accept, disabled, hint, error, placeholder = "Choose a file" }: { label: ReactNode; file: File | null; onFile: (file: File | null) => void; accept?: string; disabled?: boolean; hint?: ReactNode; error?: ReactNode; placeholder?: string }) {
  const id = useId();
  return <div className="flex flex-col gap-1.5">
    <span className="text-[13px] font-medium text-ink/80">{label}</span>
    <label htmlFor={id} className={cn("flex min-h-11 items-center gap-3 rounded-control border border-dashed bg-white px-3 py-2 text-sm transition focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(247,148,29,.18)] hover:border-brand", error ? "border-[#C4254B]" : "border-[#CFC8BA]", disabled && "opacity-50")}>
      <Upload size={16} className="shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate">{file ? file.name : placeholder}</span>
      <input id={id} type="file" accept={accept} disabled={disabled} onChange={(event) => { onFile(event.target.files?.[0] ?? null); event.target.value = ""; }} className="sr-only" />
    </label>
    {error ? <p className="text-xs text-[#C4254B]">{error}</p> : hint && <p className="text-xs text-muted">{hint}</p>}
  </div>;
}
