"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "ink" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-br from-brand to-brand-soft text-ink shadow-[0_10px_24px_-14px_rgba(247,148,29,.9)] hover:shadow-[0_14px_28px_-12px_rgba(247,148,29,.9)]",
  ink: "bg-ink text-white hover:bg-black",
  outline: "border border-[#D8D4CB] bg-white text-ink hover:border-brand hover:bg-brand-tint",
  ghost: "text-muted hover:bg-black/[.04] hover:text-ink",
  danger: "border border-danger/50 bg-white text-[#C4254B] hover:bg-danger/5",
  success: "bg-success text-white hover:brightness-105",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-control px-4 text-sm",
  lg: "h-12 gap-2 rounded-control px-5 text-sm",
};

export function buttonClass(variant: ButtonVariant = "outline", size: ButtonSize = "md", className?: string) {
  return cn("inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,box-shadow,color,transform] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45", variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  pendingLabel?: string;
  icon?: ReactNode;
};

export function Button({ variant = "outline", size = "md", pending = false, pendingLabel, icon, disabled, className, children, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || pending} aria-busy={pending || undefined} className={buttonClass(variant, size, className)}>
    {pending ? <LoaderCircle size={size === "sm" ? 13 : 16} className="animate-spin" /> : icon}
    {pending && pendingLabel ? pendingLabel : children}
  </button>;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function LinkButton({ variant = "outline", size = "md", icon, className, children, ...props }: LinkButtonProps) {
  return <Link {...props} className={buttonClass(variant, size, className)}>{icon}{children}</Link>;
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} {...props} className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-control border border-line bg-white text-ink/70 transition hover:border-brand hover:text-ink disabled:opacity-45", className)}>{children}</button>;
}
