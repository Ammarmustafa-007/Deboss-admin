"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, CalendarClock, ChevronRight, ClipboardList, Download, Hourglass, Maximize2, Plus, Search, Send, Upload, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, isPast, money } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, Chip, EmptyState, KpiCard, PageHeader, StatusChip } from "@/components/ui/surface";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { closedStages, nextAction, pipelineStages, stageLabel, type Lead, type Quote } from "@/components/sales/model";
import { useTeamDirectory } from "@/components/sales/directory";
import { BulkBar, exportLeadsExcel } from "@/components/sales/lead-bulk";
import { LeadImport } from "@/components/sales/lead-import";
import { LeadsSheet } from "@/components/sales/lead-details";
import { useSession } from "@/components/app/session";

type Filter = "all" | "LEAD" | "QUALIFIED" | "QUOTING" | "CUSTOMER" | "NOT_QUALIFIED" | "NOT_INTERESTED" | "review" | "handoff" | "rework" | "ops_rejected";

export function LeadsScreen() {
  const router = useRouter();
  const { workspace, manager, supervisor, teamLead } = useBrokerage();
  // Full Team Leads review like a manager (labels, queues); Team Leads see who owns each lead. Bulk reassignment stays manager-only.
  const reviewer = supervisor;
  const showOwner = manager || teamLead;
  // Managers and Full Team Leads can bulk-assign, move stage and archive (Team Leads within their team).
  const canBulk = manager || Boolean(workspace.capabilities?.canAssignLeads);
  const leads = useMemo(() => (workspace.leads ?? []) as Lead[], [workspace.leads]);
  const quotes = useMemo(() => (workspace.quotes ?? []) as Quote[], [workspace.quotes]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { profile } = useSession();
  // Same editing rights as the lead page: the owner and Team Leads edit; managers review (read-only), as there.
  const canEditLead = (lead: Lead) => !manager && (lead.owner_id === profile.id || teamLead);
  const stageLocked = (lead: Lead) => ["QUOTING", "CUSTOMER"].includes(lead.stage) || quotes.some((quote) => quote.lead_id === lead.id);
  const directory = useTeamDirectory(showOwner);
  const agents = (directory.data?.users ?? []).filter((user) => user.role === "AGENT");
  const ownerName = (id?: string | null) => directory.data?.users.find((user) => user.id === id)?.full_name;

  const rows = useMemo(() => leads.map((lead) => ({ lead, action: nextAction(quotes.filter((quote) => quote.lead_id === lead.id), reviewer) })), [leads, quotes, reviewer]);
  const count = (predicate: (row: (typeof rows)[number]) => boolean) => rows.filter(predicate).length;
  const byStage = (stage: string) => count((row) => row.lead.stage === stage);
  const reviewCount = count((row) => row.action.key === "review");
  const handoffCount = count((row) => row.action.key === "handoff");
  const reworkCount = count((row) => row.action.key === "rework");
  const opsRejectedCount = count((row) => row.action.key === "ops_rejected");
  const followUpsDue = count((row) => !closedStages.includes(row.lead.stage) && isPast(row.lead.next_follow_up_at));

  const tabs: TabItem<Filter>[] = [
    { value: "all", label: "All", count: rows.length },
    { value: "review", label: reviewer ? "Needs review" : "Awaiting approval", count: reviewCount, hidden: !reviewCount },
    { value: "handoff", label: reviewer ? "Ready to hand off" : "Approved", count: handoffCount, hidden: !handoffCount },
    { value: "rework", label: reviewer ? "Agent rework" : "Rework needed", count: reworkCount, hidden: !reworkCount },
    { value: "ops_rejected", label: "Rejected by Operations", count: opsRejectedCount, hidden: !opsRejectedCount },
    ...pipelineStages.map((stage) => ({ value: stage, label: stageLabel[stage], count: byStage(stage), hidden: stage.startsWith("NOT_") && !byStage(stage) })),
  ];

  const term = search.trim().toLowerCase();
  const visible = rows.filter(({ lead, action }) => {
    if (["review", "handoff", "rework", "ops_rejected"].includes(filter) ? action.key !== filter : filter !== "all" && lead.stage !== filter) return false;
    if (owner && lead.owner_id !== owner) return false;
    return !term || `${lead.company_name} ${lead.contact_name ?? ""} ${lead.contact_email ?? ""}`.toLowerCase().includes(term);
  });

  const visibleIds = visible.map(({ lead }) => lead.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelected(allSelected ? selected.filter((id) => !visibleIds.includes(id)) : [...new Set([...selected, ...visibleIds])]);
  const selectedLeads = leads.filter((lead) => selected.includes(lead.id));

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Sales pipeline" subtitle={manager ? "Every lead in your department" : teamLead ? "Your team's leads and customers" : "Your leads and customers"} actions={<>
      <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportLeadsExcel(visible.map(({ lead }) => lead), ownerName)} disabled={!visible.length}>Export</Button>
      <Button variant="outline" icon={<Upload size={15} />} onClick={() => setImporting(true)}>Import</Button>
      <Button variant="outline" icon={<Maximize2 size={15} />} onClick={() => setSheetOpen(true)}>Open sheet</Button>
      {!manager && <LinkButton href="/app/sales/new" variant="primary" icon={<Plus size={16} />}>New lead</LinkButton>}
    </>} />

    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {supervisor ? <>
        <KpiCard label={manager ? "Department leads" : "Team pipeline"} value={leads.length} icon={ClipboardList} tone="brand" />
        <KpiCard label="Customers" value={byStage("CUSTOMER")} icon={UserRoundCheck} tone="success" />
        <KpiCard label="Review required" value={reviewCount} icon={Hourglass} tone="accent" hint={reviewCount ? "Quotes waiting for your decision" : "Nothing waiting"} />
        <KpiCard label="Ready for Operations" value={handoffCount} icon={Send} tone="aqua" />
      </> : <>
        <KpiCard label="Open leads" value={rows.filter((row) => !closedStages.includes(row.lead.stage)).length} icon={ClipboardList} tone="brand" />
        <KpiCard label="Customers" value={byStage("CUSTOMER")} icon={UsersRound} tone="success" />
        <KpiCard label="Awaiting approval" value={reviewCount} icon={Hourglass} tone="accent" />
        <KpiCard label="Follow-ups due" value={followUpsDue} icon={CalendarClock} tone={followUpsDue ? "danger" : "info"} />
      </>}
    </div>

    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={filter} onChange={setFilter} className="-mb-px border-b-0 lg:flex-1" />
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        {showOwner && <select value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Filter by agent" className={cn(controlClass, "h-10 sm:w-48")}><option value="">All agents</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select>}
        <label className="relative block lg:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or contact" aria-label="Search leads" className={cn(controlClass, "h-10 pl-9")} />
        </label>
        </div>
      </div>
      {canBulk && selected.length > 0 && <BulkBar leads={selectedLeads} agents={agents} onClear={() => setSelected([])} ownerName={ownerName} />}
      <div className="border-t border-line">
        {visible.length ? <>
          <table className="hidden w-full text-sm md:table">
            <thead><tr className="text-left text-xs text-muted">
              {canBulk && <th className="w-10 pl-5"><input type="checkbox" aria-label="Select all leads in view" checked={allSelected} onChange={toggleAll} className="h-4 w-4" /></th>}
              <th className={cn("py-2.5 font-medium", canBulk ? "px-3" : "px-5")}>Company</th>
              {showOwner && <th className="px-3 py-2.5 font-medium">Owner</th>}
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Next step</th>
              <th className="px-3 py-2.5 font-medium">Follow-up</th>
              <th className="px-3 py-2.5 text-right font-medium">Forecast</th>
              <th className="w-10" />
            </tr></thead>
            <tbody>
              {visible.map(({ lead, action }) => {
                const overdue = !closedStages.includes(lead.stage) && isPast(lead.next_follow_up_at);
                return <tr key={lead.id} onClick={() => router.push(`/app/sales/leads/${lead.id}`)} className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-[#FAF8F4]">
                  {canBulk && <td className="pl-5" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${lead.company_name}`} checked={selected.includes(lead.id)} onChange={() => toggle(lead.id)} className="h-4 w-4" /></td>}
                  <td className={cn("py-3.5", canBulk ? "px-3" : "px-5")}><Link href={`/app/sales/leads/${lead.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-brand-deep">{lead.company_name}</Link><p className="mt-0.5 text-xs text-muted">{lead.contact_name || "No contact"}{lead.contact_email ? ` · ${lead.contact_email}` : ""}</p></td>
                  {showOwner && <td className="px-3 py-3.5 text-[13px] text-ink/75">{ownerName(lead.owner_id) ?? "—"}</td>}
                  <td className="px-3 py-3.5"><span className="flex flex-wrap gap-1.5"><StatusChip status={lead.stage} label={stageLabel[lead.stage]} />{lead.archived_at && <Chip>Archived</Chip>}</span></td>
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
                <p className="truncate text-xs text-muted">{lead.contact_name || "No contact"}{showOwner ? ` · ${ownerName(lead.owner_id) ?? "No owner"}` : ""} · Follow-up {dateLabel(lead.next_follow_up_at)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><StatusChip status={lead.stage} label={stageLabel[lead.stage]} />{action.key !== "none" && <Chip tone={action.tone}>{action.label}</Chip>}</div>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Link></li>)}
          </ul>
        </> : <EmptyState icon={term ? Search : BadgeCheck} title={term ? "No leads match your search" : leads.length ? "Nothing in this view" : "No leads yet"} body={!leads.length && !manager ? "Create your first lead to start the pipeline." : undefined} action={!leads.length && !manager ? <LinkButton href="/app/sales/new" variant="primary" icon={<Plus size={16} />}>New lead</LinkButton> : undefined} />}
      </div>
    </Card>
    {importing && <LeadImport onClose={() => setImporting(false)} />}
    {sheetOpen && <LeadsSheet leads={visible.map(({ lead }) => lead)} total={leads.length} ownerName={showOwner ? ownerName : undefined} canEdit={canEditLead} stageLocked={stageLocked} canCreate={!manager} onClose={() => setSheetOpen(false)} />}
  </div>;
}
