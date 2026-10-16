"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, CalendarClock, ChevronRight, ClipboardList, Hourglass, Plus, Search, Send, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, isPast, money } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, Chip, EmptyState, KpiCard, PageHeader, StatusChip } from "@/components/ui/surface";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { LinkButton } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { nextAction, stageLabel, type Lead, type Quote } from "@/components/sales/model";

type Filter = "all" | "NEW" | "CONTACTED" | "QUALIFIED" | "CUSTOMER" | "LOST" | "review" | "handoff" | "rework";

export function LeadsScreen() {
  const router = useRouter();
  const { workspace, manager } = useBrokerage();
  const leads = useMemo(() => (workspace.leads ?? []) as Lead[], [workspace.leads]);
  const quotes = useMemo(() => (workspace.quotes ?? []) as Quote[], [workspace.quotes]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => leads.map((lead) => ({ lead, action: nextAction(quotes.filter((quote) => quote.lead_id === lead.id), manager) })), [leads, quotes, manager]);
  const count = (predicate: (row: (typeof rows)[number]) => boolean) => rows.filter(predicate).length;
  const byStage = (stage: string) => count((row) => row.lead.stage === stage);
  const reviewCount = count((row) => row.action.key === "review");
  const handoffCount = count((row) => row.action.key === "handoff");
  const reworkCount = count((row) => row.action.key === "rework");
  const followUpsDue = count((row) => !["CUSTOMER", "LOST"].includes(row.lead.stage) && isPast(row.lead.next_follow_up_at));

  const tabs: TabItem<Filter>[] = [
    { value: "all", label: "All", count: rows.length },
    { value: "review", label: manager ? "Needs review" : "Awaiting approval", count: reviewCount, hidden: !reviewCount },
    { value: "handoff", label: manager ? "Ready to hand off" : "Approved", count: handoffCount, hidden: !handoffCount },
    { value: "rework", label: manager ? "Agent rework" : "Rework needed", count: reworkCount, hidden: !reworkCount },
    ...(["NEW", "CONTACTED", "QUALIFIED", "CUSTOMER", "LOST"] as const).map((stage) => ({ value: stage, label: stageLabel[stage], count: byStage(stage) })),
  ];

  const term = search.trim().toLowerCase();
  const visible = rows.filter(({ lead, action }) => {
    if (["review", "handoff", "rework"].includes(filter) ? action.key !== filter : filter !== "all" && lead.stage !== filter) return false;
    return !term || `${lead.company_name} ${lead.contact_name ?? ""} ${lead.contact_email ?? ""}`.toLowerCase().includes(term);
  });

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Sales pipeline" subtitle={manager ? "Every lead in your department" : "Your leads and customers"} actions={!manager && <LinkButton href="/app/sales/new" variant="primary" icon={<Plus size={16} />}>New lead</LinkButton>} />

    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {manager ? <>
        <KpiCard label="Department leads" value={leads.length} icon={ClipboardList} tone="brand" />
        <KpiCard label="Customers" value={byStage("CUSTOMER")} icon={UserRoundCheck} tone="success" />
        <KpiCard label="Review required" value={reviewCount} icon={Hourglass} tone="accent" hint={reviewCount ? "Quotes waiting for your decision" : "Nothing waiting"} />
        <KpiCard label="Ready for Operations" value={handoffCount} icon={Send} tone="aqua" />
      </> : <>
        <KpiCard label="Open leads" value={rows.filter((row) => !["CUSTOMER", "LOST"].includes(row.lead.stage)).length} icon={ClipboardList} tone="brand" />
        <KpiCard label="Customers" value={byStage("CUSTOMER")} icon={UsersRound} tone="success" />
        <KpiCard label="Awaiting approval" value={reviewCount} icon={Hourglass} tone="accent" />
        <KpiCard label="Follow-ups due" value={followUpsDue} icon={CalendarClock} tone={followUpsDue ? "danger" : "info"} />
      </>}
    </div>

    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={filter} onChange={setFilter} className="-mb-px border-b-0 lg:flex-1" />
        <label className="relative mb-3 block lg:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or contact" aria-label="Search leads" className={cn(controlClass, "h-10 pl-9")} />
        </label>
      </div>
      <div className="border-t border-line">
        {visible.length ? <>
          <table className="hidden w-full text-sm md:table">
            <thead><tr className="text-left text-xs text-muted">
              <th className="px-5 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Next step</th>
              <th className="px-3 py-2.5 font-medium">Follow-up</th>
              <th className="px-3 py-2.5 text-right font-medium">Forecast</th>
              <th className="w-10" />
            </tr></thead>
            <tbody>
              {visible.map(({ lead, action }) => {
                const overdue = !["CUSTOMER", "LOST"].includes(lead.stage) && isPast(lead.next_follow_up_at);
                return <tr key={lead.id} onClick={() => router.push(`/app/sales/leads/${lead.id}`)} className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-[#FAF8F4]">
                  <td className="px-5 py-3.5"><Link href={`/app/sales/leads/${lead.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-brand-deep">{lead.company_name}</Link><p className="mt-0.5 text-xs text-muted">{lead.contact_name || "No contact"}{lead.contact_email ? ` · ${lead.contact_email}` : ""}</p></td>
                  <td className="px-3 py-3.5"><span className="flex flex-wrap gap-1.5"><StatusChip status={lead.stage} />{lead.archived_at && <Chip>Archived</Chip>}</span></td>
                  <td className="px-3 py-3.5">{action.key === "none" ? <span className="text-xs text-muted">—</span> : <Chip tone={action.tone}>{action.label}</Chip>}</td>
                  <td className={cn("px-3 py-3.5 text-[13px]", overdue ? "font-medium text-[#C4254B]" : "text-ink/75")}>{overdue && <AlertCircle size={13} className="mr-1 inline -translate-y-px" />}{dateLabel(lead.next_follow_up_at)}</td>
                  <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">{money(lead.estimated_monthly_value)}</td>
                  <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
                </tr>;
              })}
            </tbody>
          </table>
          <ul className="divide-y divide-line-soft md:hidden">
            {visible.map(({ lead, action }) => <li key={lead.id}><Link href={`/app/sales/leads/${lead.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-[#FAF8F4]">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{lead.company_name}</p>
                <p className="truncate text-xs text-muted">{lead.contact_name || "No contact"} · Follow-up {dateLabel(lead.next_follow_up_at)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><StatusChip status={lead.stage} />{action.key !== "none" && <Chip tone={action.tone}>{action.label}</Chip>}</div>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Link></li>)}
          </ul>
        </> : <EmptyState icon={term ? Search : BadgeCheck} title={term ? "No leads match your search" : leads.length ? "Nothing in this view" : "No leads yet"} body={!leads.length && !manager ? "Create your first lead to start the pipeline." : undefined} action={!leads.length && !manager ? <LinkButton href="/app/sales/new" variant="primary" icon={<Plus size={16} />}>New lead</LinkButton> : undefined} />}
      </div>
    </Card>
  </div>;
}
