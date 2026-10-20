"use client";

import { Archive, ArchiveRestore, Download, UserRoundCog, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { downloadExcel } from "@/lib/excel";
import { editableStages, stageLabel, type Lead } from "@/components/sales/model";
import type { DirectoryPerson } from "@/components/sales/directory";

/** Downloads the given leads as a styled Excel sheet (no internal IDs). */
export function exportLeadsExcel(leads: Lead[], ownerName: (id?: string | null) => string | undefined) {
  return downloadExcel(`Leads ${new Date().toISOString().slice(0, 10)}`, [{
    name: "Leads", title: "Leads", note: `${leads.length} lead${leads.length === 1 ? "" : "s"}`,
    columns: [{ header: "Company", key: "company" }, { header: "Contact", key: "contact" }, { header: "Email", key: "email" }, { header: "Phone", key: "phone" }, { header: "Stage", key: "stage", type: "status" }, { header: "Owner", key: "owner" }, { header: "Source", key: "source" }, { header: "Monthly forecast", key: "forecast", type: "money" }, { header: "Next follow-up", key: "follow_up", type: "datetime" }, { header: "Archived", key: "archived" }],
    rows: leads.map((lead) => ({ company: lead.company_name, contact: lead.contact_name, email: lead.contact_email, phone: lead.contact_phone, stage: stageLabel[lead.stage] ?? lead.stage, owner: ownerName(lead.owner_id) ?? "", source: lead.source, forecast: lead.estimated_monthly_value, follow_up: lead.next_follow_up_at, archived: lead.archived_at ? "Yes" : "" })),
    totals: { company: "Total", forecast: leads.reduce((sum, lead) => sum + Number(lead.estimated_monthly_value ?? 0), 0) },
  }]);
}

/** Manager bulk actions on selected leads. Each lead is updated with the existing single-lead endpoint. */
export function BulkBar({ leads, agents, onClear, ownerName }: { leads: Lead[]; agents: DirectoryPerson[]; onClear: () => void; ownerName: (id?: string | null) => string | undefined }) {
  const { api, report } = useBrokerage();
  const { busy, wrap, refresh } = useBrokerageAction();
  const [owner, setOwner] = useState("");
  const [stage, setStage] = useState("");

  const apply = (key: string, targets: Lead[], patch: (lead: Lead) => Record<string, unknown>, done: string) => void wrap(key, async () => {
    let failed = 0;
    let lastError = "";
    for (const lead of targets) {
      try { await responseData(await api(`/api/v1/brokerage/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify(patch(lead)) })); }
      catch (error) { failed += 1; lastError = error instanceof Error ? error.message : ""; }
    }
    void refresh();
    const succeeded = targets.length - failed;
    if (failed) report(`${succeeded} of ${targets.length} updated. ${lastError}`, "error");
    else report(`${done} (${succeeded}).`);
    if (!failed) onClear();
  });

  const archived = leads.filter((lead) => lead.archived_at);
  const stageable = leads.filter((lead) => lead.stage !== "CUSTOMER");
  const anyBusy = busy();

  return <div className="flex flex-wrap items-center gap-2 border-t border-brand/30 bg-brand-tint/60 px-5 py-3 animate-fade">
    <span className="mr-1 text-sm font-semibold">{leads.length} selected</span>

    <span className="flex items-center gap-1.5">
      <select value={owner} onChange={(event) => setOwner(event.target.value)} disabled={anyBusy} aria-label="New owner" className={cn(controlClass, "h-9 w-44 text-[13px]")}><option value="">Reassign to…</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select>
      <Button size="sm" variant="ink" icon={<UserRoundCog size={13} />} disabled={!owner || anyBusy} pending={busy("bulk-owner")} onClick={() => apply("bulk-owner", leads, () => ({ owner_id: owner }), `Reassigned to ${ownerName(owner) ?? "agent"}`)}>Apply</Button>
    </span>

    <span className="flex items-center gap-1.5">
      <select value={stage} onChange={(event) => setStage(event.target.value)} disabled={anyBusy || !stageable.length} aria-label="New stage" className={cn(controlClass, "h-9 w-40 text-[13px]")}><option value="">Move stage to…</option>{editableStages.map((item) => <option key={item} value={item}>{stageLabel[item]}</option>)}</select>
      <Button size="sm" variant="ink" disabled={!stage || anyBusy || !stageable.length} pending={busy("bulk-stage")} onClick={() => apply("bulk-stage", stageable, () => ({ stage }), `Moved to ${stageLabel[stage]}`)}>Apply</Button>
    </span>

    <Button size="sm" variant="outline" icon={archived.length === leads.length ? <ArchiveRestore size={13} /> : <Archive size={13} />} disabled={anyBusy} pending={busy("bulk-archive")}
      onClick={() => archived.length === leads.length
        ? apply("bulk-archive", leads, () => ({ archived_at: null }), "Restored")
        : apply("bulk-archive", leads.filter((lead) => !lead.archived_at), () => ({ archived_at: new Date().toISOString() }), "Archived")}>
      {archived.length === leads.length ? "Restore" : "Archive"}
    </Button>
    <Button size="sm" variant="outline" icon={<Download size={13} />} disabled={anyBusy} onClick={() => void exportLeadsExcel(leads, ownerName)}>Export</Button>

    <button type="button" onClick={onClear} disabled={anyBusy} aria-label="Clear selection" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-black/5 hover:text-ink"><X size={16} /></button>
    {stage && stageable.length < leads.length && <p className="basis-full text-xs text-muted">Customers keep their stage; {stageable.length} of {leads.length} will move.</p>}
  </div>;
}
