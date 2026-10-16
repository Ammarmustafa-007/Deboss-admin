"use client";

import { Bell } from "lucide-react";
import { PendingButton, useSingleFlight } from "@/components/action-state";
import { responseData } from "@/lib/api";
import { Empty, message } from "@/components/brokerage/shared";

export function NotificationsWorkspace({ data, api, refresh, report }: { data: any[]; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const actions = useSingleFlight();
  const read = (item: any) => void actions.run("read:" + item.id, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/notifications/" + item.id + "/read", { method: "PATCH" }));
      void refresh();
      report("Notification marked as read.");
    } catch (error) {
      report(message(error), "error");
    }
  });

  return <div>
    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-deep">Brokerage alerts</p>
    <h2 className="mt-2 text-3xl font-semibold">Notification inbox</h2>
    <div className="mt-7 divide-y overflow-hidden rounded-lg border border-black/8 bg-white">
      {data.map((item) => <article key={item.id} className={"flex gap-4 p-5 " + (item.read_at ? "opacity-65" : "bg-[#fffaf1]")}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-black/[.05] text-brand-deep"><Bell size={16}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-black/55">{item.body}</p></div>
            {!item.read_at && <PendingButton type="button" pending={actions.isBusy("read:" + item.id)} pendingLabel="Marking..." disabled={actions.isBusy() && !actions.isBusy("read:" + item.id)} onClick={() => read(item)} className="h-8 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Mark read</PendingButton>}
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{item.kind.replaceAll("_", " · ")} · {new Date(item.created_at).toLocaleString()}</p>
        </div>
      </article>)}
      {!data.length && <Empty title="You are up to date" copy="Assignments, approvals, comments, document reviews, exceptions, and overdue invoices will appear here."/>}
    </div>
  </div>;
}
