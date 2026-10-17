"use client";

import { CalendarClock, CheckCircle2, Circle, Send, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { dateTimeLabel, isPast } from "@/lib/format";
import { Avatar, Chip, humanize } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import type { FeedItem } from "@/components/sales/model";

type Busy = (key?: string) => boolean;

export function ActivityFeed({ rows, empty, onToggle, onDelete, busy }: { rows: FeedItem[]; empty: string; onToggle?: (row: FeedItem) => void; onDelete?: (row: FeedItem) => void; busy?: Busy }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
    {rows.map((row) => {
      const completed = Boolean(row.completed_at);
      const pending = busy?.(`activity:${row.id}`) || busy?.(`delete-activity:${row.id}`);
      const overdue = !completed && isPast(row.due_at);
      const isActivity = Boolean(row.activity_type);
      return <li key={row.id} className={cn("relative flex gap-3", pending && "opacity-60")}>
        <span className={cn("relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 bg-white", completed ? "border-success text-success" : isActivity ? "border-brand text-brand" : "border-line text-muted")}>
          {completed ? <CheckCircle2 size={15} /> : isActivity ? <Circle size={11} fill="currentColor" /> : <CalendarClock size={14} />}
        </span>
        <div className="min-w-0 flex-1 rounded-[12px] border border-line-soft bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{humanize(row.activity_type ?? row.event_type ?? "EVENT")}</p>
            {isActivity && <Chip tone={completed ? "success" : overdue ? "danger" : "brand"}>{completed ? "Done" : overdue ? "Overdue" : "Open"}</Chip>}
            <span className="ml-auto text-xs text-muted">{dateTimeLabel(row.created_at)}{row.author_name ? ` · ${row.author_name}` : ""}</span>
          </div>
          {row.body && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-ink/80">{row.body}</p>}
          {(row.due_at || (isActivity && onToggle) || (row.can_delete && onDelete)) && <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {row.due_at && <span className={cn("inline-flex items-center gap-1 font-medium", overdue ? "text-[#C4254B]" : "text-brand-deep")}><CalendarClock size={13} />Due {dateTimeLabel(row.due_at)}</span>}
            <span className="ml-auto flex items-center gap-1">
              {isActivity && onToggle && <Button size="sm" variant="ghost" disabled={pending} onClick={() => onToggle(row)}>{completed ? "Reopen" : "Mark done"}</Button>}
              {row.can_delete && onDelete && <Button size="sm" variant="ghost" disabled={pending} onClick={() => onDelete(row)} className="text-[#C4254B] hover:text-[#C4254B]" aria-label="Delete activity"><Trash2 size={13} /></Button>}
            </span>
          </div>}
        </div>
      </li>;
    })}
  </ol>;
}

export function CommentFeed({ rows, empty, onDelete, busy }: { rows: FeedItem[]; empty: string; onDelete?: (row: FeedItem) => void; busy?: Busy }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return <ul className="space-y-4">
    {rows.map((row) => {
      const pending = busy?.(`delete-comment:${row.id}`);
      return <li key={row.id} className={cn("flex gap-3", pending && "opacity-60")}>
        <Avatar name={row.author_name ?? "?"} className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-semibold">{row.author_name ?? "Unknown user"}</p>
            <p className="text-xs text-muted">{dateTimeLabel(row.created_at)}</p>
            {row.can_delete && onDelete && <button type="button" disabled={pending} onClick={() => onDelete(row)} className="ml-auto text-xs font-medium text-muted hover:text-[#C4254B] disabled:opacity-50">Delete</button>}
          </div>
          <p className="mt-1 whitespace-pre-wrap rounded-[12px] rounded-tl-sm bg-canvas px-3.5 py-2.5 text-sm leading-6 text-ink/85">{row.body}</p>
        </div>
      </li>;
    })}
  </ul>;
}

/** Single-line composer; clears itself only when `onSubmit` resolves true. */
export function Composer({ placeholder, onSubmit, pending, disabled }: { placeholder: string; onSubmit: (body: string) => Promise<boolean>; pending?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    if (await onSubmit(value)) setValue("");
  };
  return <form onSubmit={submit} className="flex gap-2">
    <input value={value} disabled={disabled || pending} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={3000} className={cn(controlClass, "flex-1")} />
    <Button type="submit" variant="ink" pending={pending} disabled={disabled || !value.trim()} icon={<Send size={15} />} className="h-11">Post</Button>
  </form>;
}
