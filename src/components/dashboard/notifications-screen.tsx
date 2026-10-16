"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { dateTimeLabel } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, EmptyState, IconTile, PageHeader, humanize } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import type { Quote } from "@/components/sales/model";
import { kindStyle, notificationHref, type NotificationItem as Item } from "@/components/dashboard/notification-meta";

export function NotificationsScreen() {
  const { notifications, workspace, sales } = useBrokerage();
  const { run, busy } = useBrokerageAction();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const items = notifications as Item[];
  const unread = items.filter((item) => !item.read_at);
  const visible = filter === "unread" ? unread : items;
  const quotes = (workspace.quotes ?? []) as Quote[];

  const hrefFor = (item: Item) => notificationHref(item, sales, quotes);

  return <div className="mx-auto max-w-4xl space-y-6 animate-rise">
    <PageHeader title="Notifications" subtitle={unread.length ? `${unread.length} unread` : "You're up to date"} />
    <Card>
      <div className="px-5 pt-3"><Tabs value={filter} onChange={setFilter} className="border-b-0" items={[{ value: "all", label: "All", count: items.length }, { value: "unread", label: "Unread", count: unread.length }]} /></div>
      <div className="border-t border-line">
        {visible.length ? <ul className="divide-y divide-line-soft">{visible.map((item) => {
          const { icon, tone } = kindStyle(item.kind);
          const href = hrefFor(item);
          const pending = busy(`read:${item.id}`);
          return <li key={item.id} className={cn("flex gap-4 px-5 py-4", !item.read_at && "bg-brand-tint/50")}>
            <div className="relative"><IconTile icon={icon} tone={tone} />{!item.read_at && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cn("text-sm", item.read_at ? "font-medium text-ink/75" : "font-semibold")}>{item.title}</p>
                <time className="text-xs text-muted">{dateTimeLabel(item.created_at)}</time>
              </div>
              {item.body && <p className="mt-1 text-sm leading-6 text-ink/70">{item.body}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{humanize(item.kind)}</span>
                <span className="ml-auto flex gap-1.5">
                  {href && <Link href={href} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-brand-deep hover:bg-brand-tint">Open</Link>}
                  {!item.read_at && <Button size="sm" variant="outline" icon={<CheckCheck size={13} />} pending={pending} pendingLabel="Marking…" disabled={busy() && !pending} onClick={() => void run(`read:${item.id}`, `/api/v1/brokerage/notifications/${item.id}/read`, "PATCH", undefined, "Notification marked as read.")}>Mark read</Button>}
                </span>
              </div>
            </div>
          </li>;
        })}</ul> : <EmptyState icon={Bell} title={filter === "unread" ? "No unread notifications" : "You're up to date"} body={filter === "all" ? "Assignments, approvals, comments, document reviews, exceptions and overdue invoices appear here." : undefined} />}
      </div>
    </Card>
  </div>;
}
