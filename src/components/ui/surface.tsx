import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("min-w-0 rounded-card border border-line bg-white", className)} />;
}

export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4", className)}>
    <div className="min-w-0"><h2 className="text-[15px] font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export type Crumb = { label: string; href?: string };

export function PageHeader({ title, subtitle, crumbs, actions, className }: { title: ReactNode; subtitle?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; className?: string }) {
  return <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
    <div className="min-w-0">
      {crumbs && crumbs.length > 0 && <nav aria-label="Breadcrumb"><ol className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">{crumbs.map((crumb, index) => <li key={index} className="flex items-center gap-1.5">{index > 0 && <ChevronRight size={12} className="text-brand" />}{crumb.href ? <Link href={crumb.href} className="hover:text-ink">{crumb.label}</Link> : <span className="font-medium text-ink">{crumb.label}</span>}</li>)}</ol></nav>}
      <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}

export type Tone = "brand" | "aqua" | "accent" | "info" | "danger" | "success" | "neutral";

const toneChip: Record<Tone, string> = {
  brand: "bg-brand/15 text-[#8A4A00]",
  aqua: "bg-aqua/15 text-[#06675E]",
  accent: "bg-accent/15 text-[#4B33B5]",
  info: "bg-info/15 text-[#145FB0]",
  danger: "bg-danger/15 text-[#A5183F]",
  success: "bg-success/15 text-[#14693A]",
  neutral: "bg-black/[.06] text-ink/70",
};

const toneSolid: Record<Tone, string> = {
  brand: "text-brand bg-brand/12",
  aqua: "text-aqua bg-aqua/12",
  accent: "text-accent bg-accent/12",
  info: "text-info bg-info/12",
  danger: "text-danger bg-danger/12",
  success: "text-success bg-success/12",
  neutral: "text-ink/60 bg-black/[.05]",
};

const toneBorder: Record<Tone, string> = {
  brand: "border-t-brand", aqua: "border-t-aqua", accent: "border-t-accent", info: "border-t-info", danger: "border-t-danger", success: "border-t-success", neutral: "border-t-ink/30",
};

/** Maps the backend's status vocabulary to one consistent colour language. */
const statusTone: Record<string, Tone> = {
  NEW: "info", CONTACTED: "accent", QUALIFIED: "brand", CUSTOMER: "success", LOST: "danger",
  DRAFT: "neutral", SUBMITTED: "brand", APPROVED: "success", REJECTED: "danger", HANDED_OFF: "info",
  QUOTED: "accent", BOOKED: "brand", DELIVERED: "info", PAID: "success",
  CARRIER_ASSIGNED: "accent", PICKED_UP: "aqua", IN_TRANSIT: "brand", COMPLETED: "success", EXCEPTION: "danger",
  SENT: "info", PENDING: "brand", OVERDUE: "danger", CANCELLED: "neutral",
  ACTIVE: "success", INACTIVE: "danger", ARCHIVED: "neutral",
};

export function toneFor(status?: string | null): Tone {
  return (status && statusTone[status]) || "neutral";
}

export function humanize(value?: string | null) {
  if (!value) return "";
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", toneChip[tone], className)}>{children}</span>;
}

export function StatusChip({ status, label, className }: { status?: string | null; label?: string; className?: string }) {
  return <Chip tone={toneFor(status)} className={className}>{label ?? humanize(status)}</Chip>;
}

export function KpiCard({ label, value, hint, icon: Icon, tone = "brand", className }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone; className?: string }) {
  return <div className={cn("min-w-0 rounded-card border border-line border-t-[3px] bg-white p-5", toneBorder[tone], className)}>
    {Icon && <span className={cn("mb-3 grid h-9 w-9 place-items-center rounded-control", toneSolid[tone])}><Icon size={18} /></span>}
    <p className="text-[13px] text-muted">{label}</p>
    <p className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
  </div>;
}

export function IconTile({ icon: Icon, tone = "brand", size = 36 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  return <span style={{ width: size, height: size }} className={cn("grid shrink-0 place-items-center rounded-control", toneSolid[tone])}><Icon size={Math.round(size / 2)} /></span>;
}

export function EmptyState({ icon: Icon, title, body, action, className }: { icon?: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
    {Icon && <IconTile icon={Icon} size={44} />}
    <h3 className="mt-4 font-semibold">{title}</h3>
    {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-black/[.06]", className)} />;
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const initials = (name ?? "?").split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return <span aria-hidden className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/20 text-xs font-bold text-[#8A4A00]", className)}>{initials || "?"}</span>;
}
