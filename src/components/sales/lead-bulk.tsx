"use client";

import { Archive, ArchiveRestore, Download, UserRoundCog, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { editableStages, stageLabel, type Lead } from "@/components/sales/model";
import type { DirectoryPerson } from "@/components/sales/directory";

const csvCell = (value: unknown) => JSON.stringify(value == null ? "" : String(value));

/** Downloads the given leads as CSV (no internal IDs). */
export function exportLeadsCsv(leads: Lead[], ownerName: (id?: string | null) => string | undefined) {
  const header = ["Company", "Contact", "Email", "Phone", "Stage", "Owner", "Source", "Monthly forecast", "Next follow-up", "Archived"];
  const rows = leads.map((lead) => [lead.company_name, lead.contact_name, lead.contact_email, lead.contact_phone, stageLabel[lead.stage] ?? lead.stage, ownerName(lead.owner_id) ?? "", lead.source, lead.estimated_monthly_value, lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : "", lead.archived_at ? "Yes" : ""]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
    <Button size="sm" variant="outline" icon={<Download size={13} />} disabled={anyBusy} onClick={() => exportLeadsCsv(leads, ownerName)}>Export</Button>

    <button type="button" onClick={onClear} disabled={anyBusy} aria-label="Clear selection" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-black/5 hover:text-ink"><X size={16} /></button>
    {stage && stageable.length < leads.length && <p className="basis-full text-xs text-muted">Customers keep their stage; {stageable.length} of {leads.length} will move.</p>}
  </div>;
}
