"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Boxes, CheckCircle2, ChevronDown, Download, Lock, Maximize2, Minimize2, Plus, Search, Sheet as SheetIcon, Target, Trash2, UserRoundCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, money } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { downloadExcel, periodLabel } from "@/lib/excel";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { MyEarnings } from "@/components/finance/my-earnings";
import { Card, CardHeader, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField, controlClass } from "@/components/ui/field";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { Sheet, type SheetColumn } from "@/components/fronter/sheet";
import { StatusMotion } from "@/components/ui/motion";

export type Prospect = {
  id: string; company_name: string; operator_name: string | null; operator_number: string | null; shipping_contact: string | null; phone: string | null; email: string | null;
  truck_type: string | null; load_type: string | null; shipping_volume: string | null; commodity: string | null; lanes: string | null;
  physical_address: string | null; other_locations: string | null; billing_address: string | null; billing_contact: string | null; billing_phone: string | null; billing_email: string | null;
  payment_terms: string | null; w9_received: boolean; ein: string | null; source: string | null; website: string | null; notes: string | null;
  status: string; assigned_to: string | null; assigned_name: string | null; created_by: string; created_by_name: string | null; lead_id: string | null; lead_stage: string | null;
  qualified_at: string | null; created_at: string; editable: boolean;
};
type Commodity = { id: string; commodity: string; trucks_used: string | null; best_states: string | null; notes: string | null; created_by_name: string | null; editable: boolean };

export const prospectStatusLabel: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", NOT_QUALIFIED: "Not qualified", NOT_INTERESTED: "Not interested", QUALIFIED: "Qualified" };
const statusTone: Record<string, string> = { QUALIFIED: "bg-success/[.06]", NOT_QUALIFIED: "bg-danger/[.03]", NOT_INTERESTED: "bg-danger/[.03]" };
const keys = { prospects: ["brokerage", "fronter", "prospects"] as const, commodities: ["brokerage", "fronter", "commodities"] as const, agents: ["brokerage", "fronter", "agents"] as const };

/** Column set from the client's notes, plus website, source, commodity and billing phone/email. */
const fieldColumns: { key: keyof Prospect & string; label: string; width?: number; type?: "boolean" | "select"; options?: { value: string; label: string }[] }[] = [
  { key: "operator_name", label: "Operator" }, { key: "operator_number", label: "Operator #", width: 100 },
  { key: "shipping_contact", label: "Shipping contact", width: 130 }, { key: "phone", label: "Phone", width: 115 }, { key: "email", label: "Email", width: 165 },
  { key: "truck_type", label: "Truck type", width: 100 }, { key: "load_type", label: "FTL / LTL", width: 82, type: "select", options: [{ value: "FTL", label: "FTL" }, { value: "LTL", label: "LTL" }, { value: "BOTH", label: "Both" }] },
  { key: "shipping_volume", label: "Volume", width: 95 }, { key: "commodity", label: "Commodity", width: 115 }, { key: "lanes", label: "Lanes", width: 150 },
  { key: "physical_address", label: "Physical address", width: 170 }, { key: "other_locations", label: "Other locations", width: 145 },
  { key: "billing_address", label: "Billing address", width: 170 }, { key: "billing_contact", label: "Billing contact", width: 130 },
  { key: "billing_phone", label: "Billing phone", width: 115 }, { key: "billing_email", label: "Billing email", width: 165 },
  { key: "payment_terms", label: "Terms", width: 95 }, { key: "w9_received", label: "W-9", width: 56, type: "boolean" }, { key: "ein", label: "EIN #", width: 100 },
  { key: "website", label: "Website", width: 145 }, { key: "source", label: "Source", width: 105 }, { key: "notes", label: "Notes", width: 200 },
];
function useProspects() {
  const { api } = useBrokerage();
  return useQuery({ queryKey: keys.prospects, queryFn: async () => (await responseData<{ prospects: Prospect[] }>(await api("/api/v1/fronter/prospects"))).prospects, staleTime: 10_000 });
}
function useSalesAgents() {
  const { api } = useBrokerage();
  return useQuery({ queryKey: keys.agents, queryFn: async () => (await responseData<{ agents: { id: string; full_name: string; department: string }[] }>(await api("/api/v1/fronter/sales-agents"))).agents, staleTime: 60_000 });
}

/** Plain CSV download (UTF-8 with BOM so Excel opens accents and emoji correctly). */
function downloadCsv(fileName: string, header: string[], rows: unknown[][]) {
  const cell = (value: unknown) => { const text = value === null || value === undefined ? "" : String(value); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const blob = new Blob(["\uFEFF" + [header, ...rows].map((line) => line.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${fileName}.csv` });
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ---- Lead mining ------------------------------------------------------------------------------------------------
type Filter = "all" | "NEW" | "CONTACTED" | "QUALIFIED" | "closed";
type Agent = { id: string; full_name: string; department: string };

const statusPill: Record<string, string> = {
  NEW: "border-[#D9E0EA] bg-[#EEF2F7] text-[#3B4A63]",
  CONTACTED: "border-[#BFE4E7] bg-[#E6F4F5] text-[#0F6670]",
  NOT_QUALIFIED: "border-[#F6CDD7] bg-[#FDECEF] text-[#A5183F]",
  NOT_INTERESTED: "border-[#E5DED3] bg-[#F4F1EC] text-[#6B6257]",
  QUALIFIED: "border-[#C8EBD4] bg-[#E7F6EC] text-[#1C7A43]",
};
const pillSelect = "h-7 w-full cursor-pointer appearance-none rounded-full border pl-3 pr-7 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60";

/** Status as a coloured pill; picking Qualified asks for the Sales agent first. A qualified row shows its pill (and Customer once converted). */
function StatusPill({ row, disabled, compact, onChange }: { row: Prospect; disabled?: boolean; compact?: boolean; onChange: (status: string) => void }) {
  // Same wrapper in both branches, so the change from a dropdown to the Qualified badge animates (with sparkles).
  if (row.status === "QUALIFIED") return <StatusMotion status={row.status} className="items-center gap-1.5">
    <span className={cn("inline-flex items-center gap-1 rounded-full border font-semibold", compact ? "h-6 px-2.5 text-[11px]" : "h-7 px-3 text-xs", statusPill.QUALIFIED)}><CheckCircle2 size={12} />Qualified</span>
    {row.lead_stage === "CUSTOMER" && <StatusChip status="CUSTOMER" label="Customer" />}
  </StatusMotion>;
  return <StatusMotion status={row.status} className="w-full">
    <span className="relative block w-full">
      <select aria-label={`Status for ${row.company_name}`} value={row.status} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={cn(pillSelect, compact && "h-6 pl-2.5 text-[11px]", "transition-[background-color,border-color,color] duration-300", statusPill[row.status])}>
        {Object.entries(prospectStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 opacity-70" />
    </span>
  </StatusMotion>;
}

function AssignSelect({ row, agents, disabled, compact, onChange }: { row: Prospect; agents: Agent[]; disabled?: boolean; compact?: boolean; onChange: (agentId: string | null) => void }) {
  if (row.status === "QUALIFIED") return <span className={cn("font-medium", compact ? "text-[12px]" : "text-[13px]")}>{row.assigned_name ?? "—"}</span>;
  return <span className="relative block">
    <select aria-label={`Assign ${row.company_name}`} value={row.assigned_to ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)} className={cn(pillSelect, compact && "h-6 pl-2.5 text-[11px]", "border-line bg-white font-medium", row.assigned_to ? "text-ink" : "text-muted")}>
      <option value="">{compact ? "Choose agent" : "Choose Sales agent"}</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}
    </select>
    <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
  </span>;
}

export function MiningScreen() {
  const { api, report, manager } = useBrokerage();
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const prospects = useProspects();
  const agents = useSalesAgents();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [qualifying, setQualifying] = useState<Prospect | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const list = useMemo(() => prospects.data ?? [], [prospects.data]);
  const agentList = agents.data ?? [];
  const opened = list.find((row) => row.id === openId) ?? null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.prospects });
  const setBusy = (id: string, value: boolean) => setBusyIds((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });

  const patch = async (row: Prospect, body: Record<string, unknown>, success?: string) => {
    setBusy(row.id, true);
    // Show the edit straight away; the server reply (or a refresh on error) settles it.
    const assignee = "assigned_to" in body ? { assigned_name: agentList.find((agent) => agent.id === body.assigned_to)?.full_name ?? null } : {};
    queryClient.setQueryData<Prospect[]>(keys.prospects, (current) => current?.map((item) => item.id === row.id ? { ...item, ...body, ...assignee } as Prospect : item));
    try { await responseData(await api(`/api/v1/fronter/prospects/${row.id}`, { method: "PATCH", body: JSON.stringify(body) })); if (success) report(success); return true; }
    catch (error) { report(errorMessage(error), "error"); return false; }
    finally { setBusy(row.id, false); void refresh(); }
  };
  const setStatus = (row: Prospect, status: string) => status === "QUALIFIED" ? setQualifying(row) : void patch(row, { status });
  const assign = (row: Prospect, agentId: string | null) => void patch(row, { assigned_to: agentId }, agentId ? "Sales agent chosen. Mark the row Qualified to send it." : undefined);
  const addRows = async (rows: Record<string, unknown>[], success: (added: number, skipped: number) => string) => {
    try {
      const result = await responseData<{ added: number; skipped: { row: number; error: string }[] }>(await api("/api/v1/fronter/prospects", { method: "POST", body: JSON.stringify({ rows }) }));
      report(success(result.added, result.skipped.length), result.skipped.length && !result.added ? "error" : "success");
      void refresh();
      return true;
    } catch (error) { report(errorMessage(error), "error"); return false; }
  };
  const quickAdd = async (event: FormEvent) => { event.preventDefault(); if (!newName.trim()) return; if (await addRows([{ company_name: newName.trim() }], () => "Row added. Open it to fill in the details.")) setNewName(""); };
  const remove = async (row: Prospect) => {
    if (!window.confirm(`Delete ${row.company_name}?`)) return false;
    setBusy(row.id, true);
    try { await responseData(await api(`/api/v1/fronter/prospects/${row.id}`, { method: "DELETE" })); report("Row deleted."); return true; } catch (error) { report(errorMessage(error), "error"); return false; }
    finally { setBusy(row.id, false); void refresh(); }
  };


  const count = (predicate: (row: Prospect) => boolean) => list.filter(predicate).length;
  const tabs: TabItem<Filter>[] = [
    { value: "all", label: "All", count: list.length },
    { value: "NEW", label: "New", count: count((row) => row.status === "NEW") },
    { value: "CONTACTED", label: "Contacted", count: count((row) => row.status === "CONTACTED") },
    { value: "QUALIFIED", label: "Qualified", count: count((row) => row.status === "QUALIFIED") },
    { value: "closed", label: "Not qualified / not interested", count: count((row) => ["NOT_QUALIFIED", "NOT_INTERESTED"].includes(row.status)) },
  ];
  const term = search.trim().toLowerCase();
  const visible = list.filter((row) => (filter === "all" || (filter === "closed" ? ["NOT_QUALIFIED", "NOT_INTERESTED"].includes(row.status) : row.status === filter))
    && (!term || [row.company_name, row.operator_name, row.shipping_contact, row.phone, row.email, row.commodity, row.lanes, row.assigned_name].some((value) => value?.toLowerCase().includes(term))));
  const exportColumns = [{ header: "Company name", key: "company_name" }, ...fieldColumns.map((column) => ({ header: fullLabels[column.key] ?? column.label, key: column.key })), { header: "Status", key: "status_label", type: "status" as const }, { header: "Assigned to", key: "assigned_name" }, { header: "Mined by", key: "created_by_name" }, { header: "Added", key: "created_at", type: "date" as const }];
  const exportRows = () => visible.map((row) => ({ ...row, status_label: prospectStatusLabel[row.status], w9_received: row.w9_received ? "Yes" : "No", load_type: row.load_type === "BOTH" ? "Both" : row.load_type }));
  const exportName = `Lead mining ${new Date().toISOString().slice(0, 10)}`;
  const exportSheet = () => void downloadExcel(exportName, [{ name: "Lead mining", title: "Lead mining", columns: exportColumns, rows: exportRows() }], { exportedBy: profile.full_name });
  const exportCsv = () => downloadCsv(exportName, exportColumns.map((column) => column.header), exportRows().map((row) => exportColumns.map((column) => column.key === "created_at" ? dateLabel(row.created_at) : (row as Record<string, unknown>)[column.key])));

  const tools = <>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <Tabs items={tabs} value={filter} onChange={setFilter} className="min-w-0 flex-1" />
      <div className="relative lg:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies, contacts, lanes" aria-label="Search lead mining" className={cn(controlClass, "h-10 pl-9")} /></div>
    </div>
    <form onSubmit={quickAdd} className="flex flex-col gap-2 sm:flex-row">
      <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={180} placeholder="New company: type a name and press Enter" aria-label="New company name" className={cn(controlClass, "h-10 sm:flex-1")} />
      <Button type="submit" variant="ink" icon={<Plus size={15} />} disabled={!newName.trim()}>Add company</Button>
    </form>
  </>;
  const sheetColumns: SheetColumn<Prospect>[] = [
    { key: "company_name", label: "Company", width: 165, required: true, sticky: true },
    { key: "status", label: "Status", width: 138, render: (row) => <StatusPill compact row={row} disabled={!row.editable || busyIds.has(row.id)} onChange={(status) => setStatus(row, status)} /> },
    { key: "assigned_to", label: "Assign to", width: 150, render: (row) => <AssignSelect compact row={row} agents={agentList} disabled={!row.editable || busyIds.has(row.id)} onChange={(agentId) => assign(row, agentId)} /> },
    ...fieldColumns.map((column) => ({ ...column, placeholder: "" })),
    ...(manager ? [{ key: "created_by_name" as const, label: "Mined by", width: 115, render: (row: Prospect) => <span className="text-ink/70">{row.created_by_name}</span> }] : []),
  ];

  return <div className="space-y-5 animate-rise">
    <PageHeader title="Lead mining" subtitle="Click a company to see and edit everything about it. Open the sheet to work on every column at once."
      actions={<div className="flex flex-wrap gap-2">
        <Button variant="outline" icon={<Download size={15} />} disabled={!visible.length} onClick={exportCsv}>Export CSV</Button>
        <Button variant="outline" icon={<Download size={15} />} disabled={!visible.length} onClick={exportSheet}>Export Excel</Button>
        <Button variant="primary" icon={<Maximize2 size={15} />} onClick={() => setSheetOpen(true)}>Open sheet</Button>
      </div>} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Prospects" value={list.length} icon={SheetIcon} tone="brand" />
      <KpiCard label="Contacted" value={count((row) => row.status === "CONTACTED")} tone="aqua" />
      <KpiCard label="Qualified" value={count((row) => row.status === "QUALIFIED")} icon={CheckCircle2} tone="success" />
      <KpiCard label="Became customers" value={count((row) => row.lead_stage === "CUSTOMER")} icon={UserRoundCheck} tone="accent" />
    </div>
    <Card className="overflow-hidden">
      <div className="space-y-3 p-4">{tools}</div>
      {prospects.isLoading ? <div className="p-4"><Skeleton className="h-64" /></div>
        : prospects.isError ? <EmptyState icon={AlertTriangle} title="Lead mining unavailable" body={errorMessage(prospects.error)} />
        : visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-y border-line-soft bg-[#FAF8F4] text-left text-xs text-muted">
              <th className="min-w-[220px] px-5 py-2.5 font-medium">Company</th><th className="px-3 py-2.5 font-medium">Contact</th><th className="px-3 py-2.5 font-medium">Commodity</th>
              <th className="w-44 px-3 py-2.5 font-medium">Status</th><th className="w-48 px-3 py-2.5 font-medium">Assigned to</th>{manager && <th className="px-3 py-2.5 font-medium">Mined by</th>}<th className="px-5 py-2.5 text-right font-medium">Added</th>
            </tr></thead>
            <tbody>{visible.map((row) => <tr key={row.id} className={cn("border-b border-line-soft last:border-0 hover:bg-[#FCFBF8]", busyIds.has(row.id) && "opacity-60")}>
              <td className="px-5 py-3"><button type="button" onClick={() => setOpenId(row.id)} className="group text-left"><span className="block font-semibold text-ink group-hover:text-brand-deep group-hover:underline">{row.company_name}</span><span className="block text-xs text-muted">{[row.load_type === "BOTH" ? "FTL & LTL" : row.load_type, row.truck_type].filter(Boolean).join(" · ") || "Open to add details"}</span></button></td>
              <td className="px-3 py-3"><span className="block">{row.shipping_contact || row.operator_name || "—"}</span><span className="block text-xs text-muted">{row.phone || row.email || ""}</span></td>
              <td className="px-3 py-3 text-ink/80">{row.commodity || "—"}</td>
              <td className="px-3 py-3"><StatusPill row={row} disabled={!row.editable || busyIds.has(row.id)} onChange={(status) => setStatus(row, status)} /></td>
              <td className="px-3 py-3"><AssignSelect row={row} agents={agentList} disabled={!row.editable || busyIds.has(row.id)} onChange={(agentId) => assign(row, agentId)} /></td>
              {manager && <td className="px-3 py-3 text-ink/70">{row.created_by_name}</td>}
              <td className="px-5 py-3 text-right text-xs text-muted">{dateLabel(row.created_at)}</td>
            </tr>)}</tbody>
          </table></div>
        : <EmptyState icon={SheetIcon} title={list.length ? "Nothing matches this view" : "No companies yet"} body={list.length ? "Try another tab or search." : "Add a company above, or open the sheet and paste rows from Excel."} />}
    </Card>

    {sheetOpen && <FullSheet count={visible.length} total={list.length} onClose={() => setSheetOpen(false)} tools={tools}>
      {prospects.isLoading ? <Skeleton className="h-64" /> : <Sheet columns={sheetColumns} rows={visible} locked={(row) => !row.editable} rowTone={(row) => statusTone[row.status]} busy={(row) => busyIds.has(row.id)} maxHeight="calc(100dvh - 232px)"
        onChange={(row, key, value) => void patch(row, { [key]: value })}
        onPasteRows={(rows) => void addRows(rows.map((row) => ({ company_name: row.company_name || "", ...row })), (added, skipped) => `${added} pasted row${added === 1 ? "" : "s"} added${skipped ? `, ${skipped} skipped (each row needs a company name)` : ""}.`)}
        onDelete={(row) => void remove(row)}
        empty={list.length ? "Nothing matches this view." : "Add a company above, or click a cell and paste rows copied from Excel."} />}
    </FullSheet>}
    {opened && <ProspectCard key={opened.id} prospect={opened} agents={agentList} busy={busyIds.has(opened.id)} onClose={() => setOpenId(null)}
      onSave={(body) => patch(opened, body, "Details saved.")} onStatus={(status) => setStatus(opened, status)} onAssign={(agentId) => assign(opened, agentId)}
      onDelete={async () => { if (await remove(opened)) setOpenId(null); }} />}
    {qualifying && <QualifyModal prospect={qualifying} agents={agentList} onClose={() => setQualifying(null)} onConfirm={(agentId) => { const row = qualifying; setQualifying(null); void patch(row, { status: "QUALIFIED", assigned_to: agentId }, `${row.company_name} sent to Sales as a qualified lead.`); }} />}
  </div>;
}

/** The sheet over the whole window (sidebar included), so every column has room. */
function FullSheet({ count, total, tools, onClose, children }: { count: number; total: number; tools: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape" && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) && !document.querySelector('[role="dialog"]')) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(<div role="region" aria-label="Lead mining sheet" className="fixed inset-0 z-40 flex flex-col bg-canvas animate-fade">
    <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand-tint text-brand-deep"><SheetIcon size={17} /></span>
      <div className="min-w-0 flex-1"><h2 className="text-base font-bold">Lead mining sheet</h2><p className="text-xs text-muted">{count === total ? `${total} compan${total === 1 ? "y" : "ies"}` : `${count} of ${total} companies`} · click a cell to edit, paste rows from Excel</p></div>
      <Button variant="ink" icon={<Minimize2 size={15} />} onClick={onClose}>Close sheet</Button>
    </header>
    <div className="space-y-3 px-4 pt-3 sm:px-6">{tools}</div>
    <div className="min-h-0 flex-1 px-4 py-3 sm:px-6">{children}</div>
  </div>, document.body);
}

const cardSections: { title: string; fields: (keyof Prospect & string)[] }[] = [
  { title: "Company", fields: ["company_name", "website", "source"] },
  { title: "Contact", fields: ["operator_name", "operator_number", "shipping_contact", "phone", "email"] },
  { title: "Shipping", fields: ["truck_type", "load_type", "shipping_volume", "commodity", "lanes"] },
  { title: "Locations", fields: ["physical_address", "other_locations"] },
  { title: "Billing", fields: ["billing_address", "billing_contact", "billing_phone", "billing_email", "payment_terms", "ein", "w9_received"] },
];
const fullLabels: Record<string, string> = { operator_name: "Operator name", operator_number: "Operator number", shipping_volume: "Shipping volume", lanes: "Lanes they run", billing_contact: "Accounts / billing contact", payment_terms: "Payment terms", w9_received: "W-9 received" };
const fieldLabel = (key: string) => key === "company_name" ? "Company name" : fullLabels[key] ?? fieldColumns.find((column) => column.key === key)?.label ?? key;
const wide = new Set(["lanes", "physical_address", "other_locations", "billing_address", "website"]);

/** Every detail of one company, editable in place (read-only once qualified or if it isn't yours). */
function ProspectCard({ prospect, agents, busy, onClose, onSave, onStatus, onAssign, onDelete }: {
  prospect: Prospect; agents: Agent[]; busy: boolean; onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<boolean>; onStatus: (status: string) => void; onAssign: (agentId: string | null) => void; onDelete: () => void;
}) {
  const editable = prospect.editable && prospect.status !== "QUALIFIED";
  const initial = useMemo(() => Object.fromEntries([...cardSections.flatMap((section) => section.fields), "notes"].map((key) => [key, key === "w9_received" ? Boolean(prospect.w9_received) : (prospect[key as keyof Prospect] as string | null) ?? ""])) as Record<string, string | boolean>, [prospect]);
  const [form, setForm] = useState(initial);
  const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== initial[key]).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]));
  const dirty = Object.keys(changes).length > 0;
  const save = async (event: FormEvent) => { event.preventDefault(); if (!dirty || !String(form.company_name).trim()) return; await onSave(changes); };
  const field = (key: string) => {
    const label = fieldLabel(key);
    if (key === "w9_received") return <label key={key} className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-medium"><input type="checkbox" checked={Boolean(form[key])} disabled={!editable} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="h-4 w-4" />W-9 received</label>;
    if (key === "load_type") return <SelectField key={key} label={label} value={String(form[key])} disabled={!editable} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder="—" options={[{ value: "FTL", label: "FTL" }, { value: "LTL", label: "LTL" }, { value: "BOTH", label: "Both" }]} />;
    return <TextField key={key} label={label} required={key === "company_name"} type={key.includes("email") ? "email" : "text"} value={String(form[key])} readOnly={!editable} onChange={(event) => setForm({ ...form, [key]: event.target.value })} wrapperClassName={cn(wide.has(key) && "sm:col-span-2")} />;
  };
  return <Drawer open onClose={onClose} title={prospect.company_name} subtitle={`Added ${dateLabel(prospect.created_at)}${prospect.created_by_name ? ` by ${prospect.created_by_name}` : ""}`}
    footer={editable ? <>
      <Button variant="ghost" className="mr-auto text-[#A5183F]" icon={<Trash2 size={14} />} onClick={onDelete} disabled={busy}>Delete</Button>
      {dirty && <Button variant="ghost" onClick={() => setForm(initial)} disabled={busy}>Discard</Button>}
      <Button type="submit" form="prospect-form" variant="ink" pending={busy} pendingLabel="Saving…" disabled={!dirty}>Save changes</Button>
    </> : <Button variant="ghost" onClick={onClose}>Close</Button>}>
    <div className="mb-5 grid gap-3 rounded-[14px] border border-line-soft bg-[#FAF8F4] p-4 sm:grid-cols-2">
      <div><p className="mb-1.5 text-xs font-medium text-muted">Status</p><StatusPill row={prospect} disabled={!prospect.editable || busy} onChange={onStatus} /></div>
      <div><p className="mb-1.5 text-xs font-medium text-muted">Assigned to</p><AssignSelect row={prospect} agents={agents} disabled={!prospect.editable || busy} onChange={onAssign} /></div>
      {prospect.status === "QUALIFIED" && <p className="flex items-center gap-1.5 text-xs text-muted sm:col-span-2"><Lock size={12} />Sent to Sales{prospect.qualified_at ? ` on ${dateLabel(prospect.qualified_at)}` : ""}. The details are locked; Sales takes it from here.</p>}
    </div>
    <form id="prospect-form" onSubmit={save} className="space-y-6">
      {cardSections.map((section) => <fieldset key={section.title} disabled={busy}>
        <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{section.title}</legend>
        <div className="grid gap-3.5 sm:grid-cols-2">{section.fields.map(field)}</div>
      </fieldset>)}
      <TextAreaField label="Notes" rows={4} value={String(form.notes)} readOnly={!editable} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
    </form>
  </Drawer>;
}

function QualifyModal({ prospect, agents, onClose, onConfirm }: { prospect: Prospect; agents: Agent[]; onClose: () => void; onConfirm: (agentId: string) => void }) {
  const [agent, setAgent] = useState(prospect.assigned_to ?? "");
  return <Modal open onClose={onClose} title={`Qualify ${prospect.company_name}`} subtitle="It becomes a qualified lead for this Sales agent and locks in your sheet."
    footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="success" icon={<CheckCircle2 size={15} />} disabled={!agent} onClick={() => onConfirm(agent)}>Qualify & send to Sales</Button></>}>
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink/80">Assign to
      <select value={agent} onChange={(event) => setAgent(event.target.value)} className={cn(controlClass, "h-11")}><option value="">Choose a Sales agent</option>{agents.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.department}</option>)}</select>
    </label>
    {!agents.length && <p className="mt-3 text-sm text-[#A5183F]">There are no active Brokerage Sales agents to assign to.</p>}
  </Modal>;
}

// ---- Commodities sheet ------------------------------------------------------------------------------------------
export function CommoditiesScreen() {
  const { api, report } = useBrokerage();
  const queryClient = useQueryClient();
  const commodities = useQuery({ queryKey: keys.commodities, queryFn: async () => (await responseData<{ commodities: Commodity[] }>(await api("/api/v1/fronter/commodities"))).commodities, staleTime: 15_000 });
  const [name, setName] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.commodities });
  const call = async (path: string, method: string, body?: unknown, success?: string) => {
    try { await responseData(await api(path, { method, body: body ? JSON.stringify(body) : undefined })); if (success) report(success); } catch (error) { report(errorMessage(error), "error"); } finally { void refresh(); }
  };
  const columns: SheetColumn<Commodity>[] = [
    { key: "commodity", label: "Commodity", width: 170, required: true, sticky: true },
    { key: "trucks_used", label: "Trucks used", width: 180 }, { key: "best_states", label: "Best states", width: 190 }, { key: "notes", label: "Notes", width: 240 },
    { key: "created_by_name", label: "Added by", width: 120, render: (row) => <span className="text-ink/70">{row.created_by_name}</span> },
  ];
  return <div className="space-y-5 animate-rise">
    <PageHeader title="Commodities" subtitle="What you are hunting: the commodity, the trucks it moves on and the best states" />
    <Card className="p-4">
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) void call("/api/v1/fronter/commodities", "POST", { commodity: name.trim() }, "Commodity added.").then(() => setName("")); }} className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder="New commodity, e.g. Frozen food" aria-label="New commodity" className={cn(controlClass, "h-10 sm:flex-1")} />
        <Button type="submit" variant="ink" icon={<Plus size={15} />} disabled={!name.trim()}>Add</Button>
      </form>
      {commodities.isLoading ? <Skeleton className="h-48" /> : <Sheet columns={columns} rows={commodities.data ?? []} locked={(row) => !row.editable}
        onChange={(row, key, value) => void call(`/api/v1/fronter/commodities/${row.id}`, "PATCH", { [key]: value })}
        onPasteRows={(rows) => void Promise.all(rows.filter((row) => row.commodity).map((row) => call("/api/v1/fronter/commodities", "POST", row))).then(() => report(`${rows.length} rows added.`))}
        onDelete={(row) => { if (window.confirm(`Delete ${row.commodity}?`)) void call(`/api/v1/fronter/commodities/${row.id}`, "DELETE", undefined, "Commodity deleted."); }}
        empty={<span className="inline-flex items-center gap-2"><Boxes size={16} />Add the commodities your team is hunting.</span>} />}
    </Card>
  </div>;
}

// ---- Dashboard and reports ---------------------------------------------------------------------------------------
type FronterReport = { team_view: boolean; totals: Record<string, number>; people: { id: string; name: string; prospects: number; new: number; contacted: number; not_qualified: number; not_interested: number; qualified: number; customers: number; conversion: number; gross: number }[]; agents: { id: string; full_name: string }[] };
const thisMonth = () => { const now = new Date(); const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now), agent_id: "" }; };
function useFronterReport(range: { from: string; to: string; agent_id: string }) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: ["brokerage", "fronter", "report", range], queryFn: async () => responseData<FronterReport>(await api(`/api/v1/fronter/reports?${new URLSearchParams(Object.entries(range).filter(([, value]) => value)).toString()}`)), staleTime: 30_000 });
}

export function FronterDashboard() {
  const { profile } = useSession();
  const report = useFronterReport(thisMonth());
  const prospects = useProspects();
  const totals = report.data?.totals ?? {};
  const waiting = (prospects.data ?? []).filter((row) => row.status === "CONTACTED" && row.editable).slice(0, 6);
  const hour = new Date().getHours();
  return <div className="space-y-6 animate-rise">
    <header><p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[28px]">{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, {profile.full_name.split(" ")[0]}</h1></header>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Prospects this month" value={totals.prospects ?? "…"} icon={SheetIcon} tone="brand" />
      <KpiCard label="Qualified" value={totals.qualified ?? "…"} icon={CheckCircle2} tone="success" />
      <KpiCard label="Became customers" value={totals.customers ?? "…"} icon={UserRoundCheck} tone="accent" />
      <KpiCard label="Customer gross" value={money(totals.gross)} icon={Target} tone="aqua" />
    </div>
    <Card><CardHeader title="Contacted, waiting to qualify" actions={<Link href="/app/fronter" className="text-xs font-semibold text-brand-deep hover:underline">Open lead mining</Link>} />
      {waiting.length ? <ul className="divide-y divide-line-soft">{waiting.map((row) => <li key={row.id} className="flex items-center gap-3 px-5 py-3"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{row.company_name}</span><span className="block truncate text-xs text-muted">{[row.shipping_contact, row.phone, row.commodity].filter(Boolean).join(" · ") || "No details yet"}</span></span><StatusChip status="CONTACTED" label="Contacted" /></li>)}</ul>
        : <EmptyState icon={SheetIcon} title="Nothing waiting" body="Mark rows Contacted as you work them; they show up here." />}
    </Card>
    <MyEarnings />
  </div>;
}

export function FronterReportsScreen() {
  const { profile } = useSession();
  const [range, setRange] = useState(thisMonth);
  useEffect(() => () => setRange(thisMonth()), []);
  const data = useFronterReport(range);
  const r = data.data;
  const exportExcel = () => r && void downloadExcel(`Fronter report ${range.from || "all-time"}`, [{
    name: "By fronter", title: "By fronter", rows: r.people, totals: { prospects: r.totals.prospects, qualified: r.totals.qualified, customers: r.totals.customers, gross: r.totals.gross },
    columns: [
      { header: "Fronter", key: "name" }, { header: "Prospects", key: "prospects", type: "number" }, { header: "New", key: "new", type: "number" }, { header: "Contacted", key: "contacted", type: "number" },
      { header: "Not qualified", key: "not_qualified", type: "number" }, { header: "Not interested", key: "not_interested", type: "number" }, { header: "Qualified", key: "qualified", type: "number" },
      { header: "Became customers", key: "customers", type: "number" }, { header: "Conversion %", key: "conversion", type: "number" }, { header: "Customer gross", key: "gross", type: "money" },
    ],
  }], { period: periodLabel(range.from, range.to), exportedBy: profile.full_name });
  return <div className="space-y-6 animate-rise">
    <PageHeader title={r?.team_view ? "Fronter performance" : "My mining results"} subtitle="Prospects mined, qualified and what became customers" actions={<Button variant="ink" icon={<Download size={15} />} disabled={!r} onClick={exportExcel}>Export Excel</Button>} />
    <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
      <label className="flex flex-col text-xs font-medium text-muted">From<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      <label className="flex flex-col text-xs font-medium text-muted">To<input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      {r?.team_view && r.agents.length > 1 && <label className="flex flex-col text-xs font-medium text-muted">Fronter<select value={range.agent_id} onChange={(event) => setRange({ ...range, agent_id: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-52")}><option value="">All fronters</option>{r.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>}
      {(range.from || range.to) && <Button variant="ghost" onClick={() => setRange({ ...range, from: "", to: "" })}>All time</Button>}
    </Card>
    {data.isLoading ? <Skeleton className="h-80" /> : data.isError || !r ? <Card><EmptyState icon={BarChart3} title="Reports unavailable" body={errorMessage(data.error)} /></Card> : <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Prospects" value={r.totals.prospects} tone="brand" />
        <KpiCard label="Qualified" value={r.totals.qualified} tone="success" />
        <KpiCard label="Became customers" value={r.totals.customers} tone="accent" />
        <KpiCard label="Customer gross" value={money(r.totals.gross)} tone="aqua" />
      </div>
      <Card><CardHeader title="By fronter" subtitle="Credit for every prospect mined" /><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
        <thead><tr className="text-left text-xs text-muted">{["Fronter", "Prospects", "New", "Contacted", "Not qualified", "Not interested", "Qualified", "Customers", "Conversion", "Customer gross"].map((label, index) => <th key={label} className={cn("py-2.5 font-medium", index ? "px-3 text-right" : "px-5")}>{label}</th>)}</tr></thead>
        <tbody>{r.people.map((row) => <tr key={row.id} className="border-t border-line-soft"><td className="px-5 py-3 font-semibold">{row.name}</td>{[row.prospects, row.new, row.contacted, row.not_qualified, row.not_interested, row.qualified, row.customers].map((value, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{value}</td>)}<td className="px-3 py-3 text-right tabular-nums">{row.conversion}%</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{money(row.gross)}</td></tr>)}
          {!r.people.length && <tr><td colSpan={10} className="px-5 py-10 text-center text-muted">No prospects in this period.</td></tr>}</tbody>
      </table></div></Card>
    </>}
  </div>;
}
