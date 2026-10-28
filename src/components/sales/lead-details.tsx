"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Pickaxe, Plus, Save } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { dateTimeLabel } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, CardHeader, StatusChip } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, controlClass } from "@/components/ui/field";
import { StatusMotion } from "@/components/ui/motion";
import { FullSheet, Sheet, type SheetColumn } from "@/components/fronter/sheet";
import { editableStages, stageLabel, type FronterProspect, type Lead, type LeadDetails } from "@/components/sales/model";

/**
 * The company details a lead carries (the Sales "Leads" sheet in the client's flow): the same columns a Fronter
 * collects, plus contact, source and notes. Shown as a card on the lead page and as a full-screen sheet.
 */

type DetailKey = keyof LeadDetails & string;
const loadTypes = [{ value: "FTL", label: "FTL" }, { value: "LTL", label: "LTL" }, { value: "BOTH", label: "Both" }];

/** Sheet columns, compact like the Fronter sheet. */
const detailColumns: { key: DetailKey | "contact_name" | "contact_phone" | "contact_email" | "source" | "notes"; label: string; width?: number; type?: "boolean" | "select"; options?: { value: string; label: string }[] }[] = [
  { key: "contact_name", label: "Contact", width: 130 }, { key: "contact_phone", label: "Phone", width: 115 }, { key: "contact_email", label: "Email", width: 165 },
  { key: "operator_name", label: "Operator" }, { key: "operator_number", label: "Operator #", width: 100 },
  { key: "truck_type", label: "Truck type", width: 100 }, { key: "load_type", label: "FTL / LTL", width: 82, type: "select", options: loadTypes },
  { key: "shipping_volume", label: "Volume", width: 95 }, { key: "commodity", label: "Commodity", width: 115 }, { key: "lanes", label: "Lanes", width: 150 },
  { key: "physical_address", label: "Physical address", width: 170 }, { key: "other_locations", label: "Other locations", width: 145 },
  { key: "billing_address", label: "Billing address", width: 170 }, { key: "billing_contact", label: "Billing contact", width: 130 },
  { key: "billing_phone", label: "Billing phone", width: 115 }, { key: "billing_email", label: "Billing email", width: 165 },
  { key: "payment_terms", label: "Terms", width: 95 }, { key: "w9_received", label: "W-9", width: 56, type: "boolean" }, { key: "ein", label: "EIN #", width: 100 },
  { key: "website", label: "Website", width: 145 }, { key: "source", label: "Source", width: 105 }, { key: "notes", label: "Notes", width: 200 },
];

/** Card groups on the lead page (full labels). */
const cardSections: { title: string; fields: [DetailKey, string][] }[] = [
  { title: "Operator & shipping", fields: [["operator_name", "Operator name"], ["operator_number", "Operator number"], ["truck_type", "Truck type"], ["load_type", "FTL / LTL"], ["shipping_volume", "Shipping volume"], ["commodity", "Commodity"], ["lanes", "Lanes they usually run"], ["website", "Website"]] },
  { title: "Locations", fields: [["physical_address", "Physical address"], ["other_locations", "Other locations"]] },
  { title: "Billing", fields: [["billing_address", "Billing address"], ["billing_contact", "Accounts / billing contact"], ["billing_phone", "Billing phone"], ["billing_email", "Billing email"], ["payment_terms", "Payment terms"], ["ein", "EIN #"], ["w9_received", "W-9 received"]] },
];
const wide = new Set<DetailKey>(["lanes", "physical_address", "other_locations", "billing_address"]);
const detailKeys = cardSections.flatMap((section) => section.fields.map(([key]) => key));

/** Company, location and billing details on the lead page, editable by whoever may edit the lead. */
export function LeadDetailsCard({ lead, editable, prospect }: { lead: Lead; editable: boolean; prospect?: FronterProspect | null }) {
  const { run, busy } = useBrokerageAction();
  const initial = useMemo(() => Object.fromEntries(detailKeys.map((key) => [key, key === "w9_received" ? Boolean(lead[key]) : (lead[key] as string | null) ?? ""])) as Record<DetailKey, string | boolean>, [lead]);
  const [form, setForm] = useState(initial);
  const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== initial[key as DetailKey]).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]));
  const dirty = Object.keys(changes).length > 0;
  const pending = busy(`lead-details:${lead.id}`);
  const save = async (event: FormEvent) => { event.preventDefault(); if (dirty) await run(`lead-details:${lead.id}`, `/api/v1/brokerage/leads/${lead.id}`, "PATCH", changes, "Company details saved."); };
  const field = (key: DetailKey, label: string) => {
    if (key === "w9_received") return <label key={key} className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-medium"><input type="checkbox" checked={Boolean(form[key])} disabled={!editable || pending} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="h-4 w-4" />{label}</label>;
    if (key === "load_type") return <SelectField key={key} label={label} value={String(form[key])} disabled={!editable || pending} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder="—" options={loadTypes} />;
    return <TextField key={key} label={label} type={key === "billing_email" ? "email" : "text"} value={String(form[key])} readOnly={!editable} disabled={pending} onChange={(event) => setForm({ ...form, [key]: event.target.value })} wrapperClassName={cn(wide.has(key) && "sm:col-span-2")} />;
  };
  return <Card>
    <CardHeader title="Company details" subtitle={prospect ? <span className="inline-flex items-center gap-1.5"><Pickaxe size={13} className="text-brand-deep" />From Fronters · mined and qualified by {prospect.fronter_name ?? "a Fronter"}{prospect.qualified_at ? ` · ${dateTimeLabel(prospect.qualified_at)}` : ""}</span> : "Operator, shipping, locations and billing"} />
    <form onSubmit={save} className="space-y-6 p-5">
      {cardSections.map((section) => <fieldset key={section.title}>
        <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{section.title}</legend>
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{section.fields.map(([key, label]) => field(key, label))}</div>
      </fieldset>)}
      {editable && <div className="flex justify-end gap-2">
        {dirty && <Button variant="ghost" onClick={() => setForm(initial)} disabled={pending}>Discard</Button>}
        <Button type="submit" variant="ink" icon={<Save size={15} />} pending={pending} pendingLabel="Saving…" disabled={!dirty}>Save details</Button>
      </div>}
    </form>
  </Card>;
}

/** Lead stage as a pill: a dropdown while it can still move; a fixed chip once it is a customer or has quotes. */
function StagePill({ lead, locked, onChange }: { lead: Lead; locked: boolean; onChange: (stage: string) => void }) {
  if (locked || !editableStages.includes(lead.stage)) return <StatusChip status={lead.stage} label={stageLabel[lead.stage] ?? lead.stage} />;
  return <StatusMotion status={lead.stage} className="w-full">
    <span className="relative block w-full">
      <select aria-label={`Stage for ${lead.company_name}`} value={lead.stage} onChange={(event) => onChange(event.target.value)} className="h-6 w-full cursor-pointer appearance-none rounded-full border border-line bg-white pl-2.5 pr-6 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand">
        {editableStages.map((stage) => <option key={stage} value={stage}>{stageLabel[stage]}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70" />
    </span>
  </StatusMotion>;
}

/** The Sales Leads sheet: every lead in view, every column, edited in place. */
export function LeadsSheet({ leads, total, ownerName, canEdit, stageLocked, canCreate, onClose }: {
  leads: Lead[]; total: number; ownerName?: (id?: string | null) => string | undefined; canEdit: (lead: Lead) => boolean; stageLocked: (lead: Lead) => boolean; canCreate: boolean; onClose: () => void;
}) {
  const { api, report } = useBrokerage();
  const queryClient = useQueryClient();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["brokerage", "workspace"] });
  const setBusy = (id: string, value: boolean) => setBusyIds((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });

  const patch = async (lead: Lead, body: Record<string, unknown>, success?: string) => {
    setBusy(lead.id, true);
    // Show the edit straight away; the refreshed workspace settles it.
    queryClient.setQueriesData<{ leads?: Lead[] }>({ queryKey: ["brokerage", "workspace"] }, (current) => current?.leads ? { ...current, leads: current.leads.map((item) => item.id === lead.id ? { ...item, ...body } : item) } : current);
    try { await responseData(await api(`/api/v1/brokerage/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify(body) })); if (success) report(success); }
    catch (error) { report(errorMessage(error), "error"); }
    finally { setBusy(lead.id, false); void refresh(); }
  };
  const create = async (rows: Record<string, unknown>[]) => {
    let added = 0; let skipped = 0;
    for (const row of rows) {
      const name = String(row.company_name ?? "").trim();
      if (name.length < 2) { skipped++; continue; }
      const body = Object.fromEntries(Object.entries({ ...row, company_name: name }).filter(([, value]) => value !== "" && value !== undefined));
      try { await responseData(await api("/api/v1/brokerage/leads", { method: "POST", body: JSON.stringify(body) })); added++; } catch { skipped++; }
    }
    report(`${added} lead${added === 1 ? "" : "s"} added${skipped ? `, ${skipped} skipped (each needs a company name and a valid email)` : ""}.`, added ? "success" : "error");
    void refresh();
    return added > 0;
  };

  const columns: SheetColumn<Lead>[] = [
    { key: "company_name", label: "Company", width: 165, required: true, sticky: true },
    { key: "stage", label: "Stage", width: 125, render: (lead) => <StagePill lead={lead} locked={!canEdit(lead) || stageLocked(lead) || busyIds.has(lead.id)} onChange={(stage) => void patch(lead, { stage }, `${lead.company_name} moved to ${stageLabel[stage]}.`)} /> },
    ...(ownerName ? [{ key: "owner_id" as const, label: "Owner", width: 120, render: (lead: Lead) => <span className="text-ink/70">{ownerName(lead.owner_id) ?? "—"}</span> }] : []),
    ...detailColumns.map((column) => ({ ...column, key: column.key as keyof Lead & string, placeholder: "" })),
  ];

  return <FullSheet title="Leads sheet" noun={["lead", "leads"]} count={leads.length} total={total} onClose={onClose}
    tools={canCreate ? <form onSubmit={(event) => { event.preventDefault(); if (newName.trim()) void create([{ company_name: newName }]).then((ok) => ok && setNewName("")); }} className="flex flex-col gap-2 sm:flex-row">
      <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={180} placeholder="New lead: type a company name and press Enter" aria-label="New lead company name" className={cn(controlClass, "h-10 sm:flex-1")} />
      <Button type="submit" variant="ink" icon={<Plus size={15} />} disabled={newName.trim().length < 2}>Add lead</Button>
    </form> : undefined}>
    <Sheet columns={columns} rows={leads} locked={(lead) => !canEdit(lead) || Boolean(lead.archived_at)} busy={(lead) => busyIds.has(lead.id)} maxHeight={canCreate ? "calc(100dvh - 178px)" : "calc(100dvh - 120px)"}
      onChange={(lead, key, value) => void patch(lead, { [key]: value })}
      onPasteRows={canCreate ? (rows) => void create(rows) : undefined}
      empty="No leads in this view." />
  </FullSheet>;
}
