"use client";

import Link from "next/link";
import { Bell, Check, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { IconTile } from "@/components/ui/surface";
import { Bump } from "@/components/ui/motion";
import { kindStyle, notificationHref, timeAgo, type NotificationItem } from "@/components/dashboard/notification-meta";
import type { Quote } from "@/components/sales/model";

const previewCount = 8;

/** Header bell with a dropdown of the latest notifications, like most apps. The full inbox stays at /app/notifications. */
export function NotificationBell() {
  const { notifications, unread, workspace, sales } = useBrokerage();
  const { run, busy } = useBrokerageAction();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const items = (notifications as NotificationItem[]).slice(0, previewCount);
  const quotes = (workspace.quotes ?? []) as Quote[];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return <div ref={root} className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      className={cn("relative grid h-10 w-10 place-items-center rounded-control border bg-white text-ink/70 transition hover:border-brand hover:text-ink", open ? "border-brand text-ink" : "border-line")}>
      <Bell size={17} />
      {unread > 0 && <Bump value={unread} className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-canvas bg-danger px-1 text-[10px] font-bold leading-none text-white">{unread > 99 ? "99+" : unread}</Bump>}
    </button>

    {open && <div role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-[68px] z-40 overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_24px_60px_-20px_rgba(17,17,17,.35)] animate-rise sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[400px]">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <p className="font-semibold">Notifications</p>
        {unread > 0 && <span className="rounded-full bg-danger/12 px-2 py-0.5 text-xs font-semibold text-[#A5183F]">{unread} unread</span>}
      </div>

      {items.length ? <ul className="max-h-[min(440px,60vh)] divide-y divide-line-soft overflow-y-auto">
        {items.map((item) => {
          const { icon, tone } = kindStyle(item.kind);
          const href = notificationHref(item, sales, quotes);
          const isUnread = !item.read_at;
          const pending = busy(`read:${item.id}`);
          const body = <>
            <div className="relative shrink-0"><IconTile icon={icon} tone={tone} size={34} />{isUnread && <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><p className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-medium text-ink/70")}>{item.title}</p><time className="shrink-0 text-[11px] text-muted">{timeAgo(item.created_at)}</time></div>
              {item.body && <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted">{item.body}</p>}
            </div>
          </>;
          return <li key={item.id} className={cn("group relative flex items-start gap-1 pr-2", isUnread && "bg-brand-tint/40")}>
            {href ? <Link href={href} onClick={close} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 hover:bg-black/[.02]">{body}</Link> : <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">{body}</div>}
            {isUnread && <button type="button" disabled={pending || (busy() && !pending)} onClick={() => void run(`read:${item.id}`, `/api/v1/brokerage/notifications/${item.id}/read`, "PATCH", undefined, "Notification marked as read.")} aria-label="Mark as read" title="Mark as read" className="mt-3 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-black/[.05] hover:text-ink disabled:opacity-50"><Check size={15} className={pending ? "animate-pulse" : ""} /></button>}
          </li>;
        })}
      </ul> : <div className="flex flex-col items-center px-6 py-10 text-center"><IconTile icon={Bell} tone="neutral" size={40} /><p className="mt-3 text-sm font-semibold">You&apos;re up to date</p><p className="mt-1 text-xs text-muted">Approvals, comments and assignments show up here.</p></div>}

      <Link href="/app/notifications" onClick={close} className="flex items-center justify-center gap-1 border-t border-line-soft px-4 py-3 text-sm font-semibold text-brand-deep hover:bg-brand-tint/50">View all notifications<ChevronRight size={15} /></Link>
    </div>}
  </div>;
}
