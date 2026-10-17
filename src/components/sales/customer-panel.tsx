"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Package, Plus, RefreshCw, Send, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { dateLabel, money } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, CardHeader, Chip, EmptyState, Skeleton, StatusChip, toneFor } from "@/components/ui/surface";
import { Stepper } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { FilePicker, SelectField, TextField } from "@/components/ui/field";
import { ActivityFeed, CommentFeed, Composer } from "@/components/sales/feed";
import { QuoteFile } from "@/components/sales/quote-panel";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { commercialStatuses, lane, operationsPosition, operationsSteps, quotePosition, quoteStageLabel, quoteSteps, type CustomerProfile, type Quote, type SalesShipment } from "@/components/sales/model";

export function useCustomerProfile(customerId: string) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: ["brokerage", "customer", customerId], queryFn: async () => responseData<CustomerProfile>(await api(`/api/v1/brokerage/customers/${customerId}/profile`)), staleTime: 15_000 });
}

/** The customer record with its shipments, follow-ups and notes. Editing happens only from Sales (not readOnly). */
export function CustomerPanel({ customerId, readOnly = false, onSyncFromLead }: { customerId: string; readOnly?: boolean; onSyncFromLead?: { run: () => void; pending: boolean } }) {
  const profile = useCustomerProfile(customerId);
  const { run, busy } = useBrokerageAction();
  const [drawer, setDrawer] = useState<{ shipment?: SalesShipment } | null>(null);

  if (profile.isLoading) return <div className="space-y-4"><Skeleton className="h-40 rounded-card" /><Skeleton className="h-64 rounded-card" /></div>;
  if (profile.isError || !profile.data) return <Card><EmptyState title="Customer unavailable" body={errorMessage(profile.error, "This customer could not be loaded.")} /></Card>;

  const data = profile.data;
  const canEdit = !readOnly && Boolean(data.can_edit);
  const quotesById = new Map(data.quotes.map((quote) => [quote.id, quote]));
  const openShipment = drawer?.shipment ? data.shipments.find((item) => item.id === drawer.shipment?.id) ?? drawer.shipment : undefined;

  return <div className="space-y-6">
    <CustomerDetails key={data.customer.updated_at ?? data.customer.id} data={data} canEdit={canEdit} onSyncFromLead={canEdit ? onSyncFromLead : undefined} />

    <Card>
      <CardHeader title="Shipments" subtitle={`${data.shipments.length} on record`} actions={canEdit && <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setDrawer({})}>Add shipment</Button>} />
      {data.shipments.length ? <ul className="divide-y divide-line-soft">
        {data.shipments.map((shipment) => {
          const quote = shipment.quote_id ? quotesById.get(shipment.quote_id) : undefined;
          return <li key={shipment.id}><button type="button" onClick={() => setDrawer({ shipment })} className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition-colors hover:bg-[#FAF8F4]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-aqua/12 text-aqua"><Truck size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{shipment.reference_number}</span><span className="block truncate text-xs text-muted">{lane(shipment)}{shipment.equipment_type ? ` · ${shipment.equipment_type}` : ""}</span></span>
            <span className="flex flex-wrap items-center gap-1.5"><StatusChip status={shipment.sales_status ?? shipment.status} />{quote && <Chip tone={toneFor(quote.stage)}>{quoteStageLabel[quote.stage] ?? quote.stage}</Chip>}</span>
            <span className="w-24 text-right text-sm font-semibold tabular-nums">{money(shipment.amount_agreed ?? shipment.amount_quoted)}</span>
            <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
          </button></li>;
        })}
      </ul> : <EmptyState icon={Package} title="No shipments yet" body={canEdit ? "Add the first shipment to create its quote for manager approval." : undefined} action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setDrawer({})}>Add shipment</Button>} />}
    </Card>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Follow-ups" />
        <div className="p-5"><ActivityFeed rows={data.activities} empty="No follow-ups recorded." busy={busy}
          onToggle={canEdit ? (row) => void run(`activity:${row.id}`, `/api/v1/brokerage/activities/${row.id}`, "PATCH", { completed: !row.completed_at }, row.completed_at ? "Activity reopened." : "Activity marked completed.") : undefined}
          onDelete={canEdit ? (row) => void run(`delete-activity:${row.id}`, `/api/v1/brokerage/activities/${row.id}`, "DELETE", undefined, "Activity deleted.") : undefined} /></div>
      </Card>
      <Card>
        <CardHeader title="Customer notes" />
        <div className="space-y-5 p-5">
          {canEdit && <Composer placeholder="Add a customer note" pending={busy(`customer-comment:${customerId}`)} onSubmit={async (body) => (await run(`customer-comment:${customerId}`, `/api/v1/brokerage/customers/${customerId}/comments`, "POST", { body }, "Customer comment added.")) !== undefined} />}
          <CommentFeed rows={data.comments} empty="No customer notes yet." busy={busy} onDelete={canEdit ? (row) => void run(`delete-comment:${row.id}`, `/api/v1/brokerage/comments/${row.id}`, "DELETE", undefined, "Customer comment deleted.") : undefined} />
        </div>
      </Card>
    </div>

    {drawer && <ShipmentDrawer key={openShipment?.id ?? "new"} customerId={customerId} shipment={openShipment} quote={openShipment?.quote_id ? quotesById.get(openShipment.quote_id) : undefined} canEdit={canEdit} onClose={() => setDrawer(null)} onCreated={() => setDrawer(null)} />}
  </div>;
}

function CustomerDetails({ data, canEdit, onSyncFromLead }: { data: CustomerProfile; canEdit: boolean; onSyncFromLead?: { run: () => void; pending: boolean } }) {
  const { run, busy } = useBrokerageAction();
  const initial = { company_name: data.customer.company_name ?? "", contact_name: data.customer.contact_name ?? "", contact_email: data.customer.contact_email ?? "", contact_phone: data.customer.contact_phone ?? "" };
  const [form, setForm] = useState(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => form[key] !== initial[key]);
  const pending = busy(`customer:${data.customer.id}`);
  const save = (event: FormEvent) => { event.preventDefault(); void run(`customer:${data.customer.id}`, `/api/v1/brokerage/customers/${data.customer.id}`, "PATCH", form, "Customer profile saved."); };

  if (!canEdit) return <Card>
    <CardHeader title="Customer details" />
    <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 xl:grid-cols-4">{[["Company", initial.company_name], ["Contact", initial.contact_name], ["Email", initial.contact_email], ["Phone", initial.contact_phone]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 truncate text-sm font-semibold">{value || "—"}</dd></div>)}</dl>
  </Card>;

  return <Card>
    <CardHeader title="Customer details" actions={onSyncFromLead && <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} pending={onSyncFromLead.pending} onClick={onSyncFromLead.run} title="Copy company and contact details from the lead">Sync from lead</Button>} />
    <form onSubmit={save} className="p-5">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TextField label="Company" required minLength={2} maxLength={180} value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
        <TextField label="Contact" maxLength={160} value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} />
        <TextField label="Email" type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} />
        <TextField label="Phone" maxLength={80} value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
      </fieldset>
      {dirty && <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setForm(initial)} disabled={pending}>Discard</Button><Button type="submit" variant="ink" pending={pending} pendingLabel="Saving…">Save customer</Button></div>}
    </form>
  </Card>;
}

function shipmentForm(shipment?: SalesShipment) {
  return {
    reference_number: shipment?.reference_number ?? "",
    pickup_location: shipment?.pickup_location ?? "",
    delivery_location: shipment?.delivery_location ?? "",
    equipment_type: shipment?.equipment_type ?? "",
    quoted_rate: shipment?.amount_quoted == null ? "" : String(shipment.amount_quoted),
    agreed_rate: shipment?.amount_agreed == null ? "" : String(shipment.amount_agreed),
    pickup_date: shipment?.pickup_date ?? "",
    delivery_date: shipment?.delivery_date ?? "",
    status: shipment?.sales_status ?? "QUOTED",
  };
}

function ShipmentDrawer({ customerId, shipment, quote, canEdit, onClose, onCreated }: { customerId: string; shipment?: SalesShipment; quote?: Quote; canEdit: boolean; onClose: () => void; onCreated: () => void }) {
  const { api, report } = useBrokerage();
  const { run, busy, refresh, wrap } = useBrokerageAction();
  const initial = shipmentForm(shipment);
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const isNew = !shipment;
  const dirty = Boolean(file) || (Object.keys(initial) as (keyof typeof initial)[]).some((key) => form[key] !== initial[key]);
  const saving = busy("save-shipment");
  const submitting = busy(`submit-quote:${quote?.id}`);
  const set = (field: keyof typeof initial) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  // Same request sequence as before: save the shipment, then upload the optional supporting document to its quote.
  const save = (event: FormEvent) => {
    event.preventDefault();
    void wrap("save-shipment", async () => {
      try {
        const body = { ...form, equipment_type: form.equipment_type || null, quoted_rate: form.quoted_rate === "" ? null : Number(form.quoted_rate), agreed_rate: form.agreed_rate === "" ? null : Number(form.agreed_rate), pickup_date: form.pickup_date || null, delivery_date: form.delivery_date || null };
        const path = shipment ? `/api/v1/brokerage/sales-shipments/${shipment.id}` : `/api/v1/brokerage/customers/${customerId}/shipments`;
        const result = await responseData<{ shipment?: SalesShipment }>(await api(path, { method: shipment ? "PATCH" : "POST", body: JSON.stringify(body) }));
        const quoteId = shipment?.quote_id ?? result?.shipment?.quote_id;
        if (file) {
          if (!quoteId) throw new Error("The linked quote was not available for this shipment.");
          const signed = await responseData<{ signed_url: string; path: string }>(await api(`/api/v1/brokerage/quotes/${quoteId}/upload-url`, { method: "POST", body: JSON.stringify({ file_name: file.name, content_type: file.type }) }));
          const uploaded = await fetch(signed.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
          if (!uploaded.ok) throw new Error("Supporting document upload failed.");
          await responseData(await api(`/api/v1/brokerage/quotes/${quoteId}/attachments`, { method: "POST", body: JSON.stringify({ file_name: file.name, storage_path: signed.path }) }));
        }
        setFile(null);
        void refresh();
        report(file ? "Shipment and supporting document saved." : shipment ? "Customer shipment saved." : "Customer shipment added.");
        if (isNew) onCreated();
      } catch (error) {
        report(errorMessage(error), "error");
      }
    });
  };

  const canSubmit = canEdit && quote && ["DRAFT", "REJECTED"].includes(quote.stage);
  const { current, blocked } = quotePosition(quote?.stage);

  const lanes = <div className="grid gap-4 sm:grid-cols-2">
    <TextField label="Reference number" required minLength={3} maxLength={64} value={form.reference_number} onChange={(event) => set("reference_number")(event.target.value)} wrapperClassName="sm:col-span-2" />
    <TextField label="Pickup" required minLength={2} maxLength={180} value={form.pickup_location} onChange={(event) => set("pickup_location")(event.target.value)} />
    <TextField label="Delivery" required minLength={2} maxLength={180} value={form.delivery_location} onChange={(event) => set("delivery_location")(event.target.value)} />
    <TextField label="Equipment" maxLength={120} value={form.equipment_type} onChange={(event) => set("equipment_type")(event.target.value)} wrapperClassName="sm:col-span-2" />
  </div>;
  const rates = <div className="grid gap-4 sm:grid-cols-2">
    <TextField label="Quoted rate" type="number" min="0" value={form.quoted_rate} onChange={(event) => set("quoted_rate")(event.target.value)} />
    <TextField label="Agreed rate" type="number" min="0" value={form.agreed_rate} onChange={(event) => set("agreed_rate")(event.target.value)} />
    <TextField label="Pickup date" type="date" value={form.pickup_date} onChange={(event) => set("pickup_date")(event.target.value)} />
    <TextField label="Delivery date" type="date" value={form.delivery_date} onChange={(event) => set("delivery_date")(event.target.value)} />
    <SelectField label="Commercial status" required value={form.status} onChange={(event) => set("status")(event.target.value)} options={commercialStatuses.map((status) => ({ value: status, label: status.charAt(0) + status.slice(1).toLowerCase() }))} wrapperClassName="sm:col-span-2" />
    <div className="sm:col-span-2"><FilePicker label="Supporting document" file={file} onFile={setFile} accept="application/pdf,image/jpeg,image/png" hint={file ? "Uploads when you save." : "Optional · PDF or image"} /></div>
  </div>;

  if (isNew) return <Drawer open onClose={onClose} dismissible={!saving} title="New shipment" subtitle={step === 0 ? "Step 1 of 2 · Lane" : "Step 2 of 2 · Rates & dates"}
    footer={step === 0
      ? <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="ink" type="submit" form="shipment-form">Continue</Button></>
      : <><Button variant="ghost" onClick={() => setStep(0)} disabled={saving}>Back</Button><Button variant="primary" type="submit" form="shipment-form" pending={saving} pendingLabel="Adding shipment…">Add shipment</Button></>}>
    <Stepper steps={[{ label: "Lane" }, { label: "Rates & dates" }]} current={step} className="mx-auto mb-6 max-w-xs" />
    <form id="shipment-form" onSubmit={step === 0 ? (event) => { event.preventDefault(); setStep(1); } : save}>
      <fieldset disabled={saving}>{step === 0 ? lanes : rates}</fieldset>
    </form>
  </Drawer>;

  return <Drawer open onClose={onClose} dismissible={!saving && !submitting} className="max-w-2xl" title={shipment!.reference_number} subtitle={lane(shipment!)}
    footer={canEdit ? <>
      {dirty && <Button variant="ghost" onClick={() => { setForm(initial); setFile(null); }} disabled={saving}>Discard</Button>}
      <Button variant={canSubmit && !dirty ? "outline" : "ink"} type="submit" form="shipment-form" pending={saving} pendingLabel="Saving…" disabled={!dirty}>Save changes</Button>
      {canSubmit && <Button variant="primary" icon={<Send size={15} />} pending={submitting} pendingLabel="Submitting…" disabled={dirty || saving} title={dirty ? "Save your changes first" : undefined} onClick={() => void run(`submit-quote:${quote!.id}`, `/api/v1/brokerage/quotes/${quote!.id}/submit`, "POST", undefined, "Shipment submitted to the Sales Manager for review.")}>{quote!.stage === "REJECTED" ? "Resubmit for approval" : "Submit for approval"}</Button>}
    </> : undefined}>
    {quote && <div className="mb-6 rounded-[12px] border border-line-soft bg-[#FBFAF7] p-4">
      <Stepper steps={quoteSteps.map((label) => ({ label }))} current={current} tone={blocked ? "danger" : "brand"} />
      {quote.stage === "REJECTED" && <p className="mt-4 rounded-lg bg-danger/[.07] px-3.5 py-2.5 text-sm text-[#A5183F]"><b>Returned for rework.</b>{quote.rejection_note ? ` ${quote.rejection_note}` : ""}</p>}
    </div>}

    {shipment!.operations_department_id && <OperationsProgress shipment={shipment!} />}

    {canEdit ? <form id="shipment-form" onSubmit={save}>
      <fieldset disabled={saving} className="space-y-6">
        <section><h3 className="mb-3 text-sm font-semibold">Lane</h3>{lanes}</section>
        <section><h3 className="mb-3 text-sm font-semibold">Rates & dates</h3>{rates}</section>
      </fieldset>
    </form> : <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {[["Lane", lane(shipment!)], ["Equipment", shipment!.equipment_type || "—"], ["Quoted rate", money(shipment!.amount_quoted)], ["Agreed rate", money(shipment!.amount_agreed)], ["Pickup date", dateLabel(shipment!.pickup_date)], ["Delivery date", dateLabel(shipment!.delivery_date)], ["Commercial status", shipment!.sales_status ?? shipment!.status ?? "—"]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 text-sm font-semibold">{value}</dd></div>)}
    </dl>}

    {quote && <div className={cn("mt-8 border-t border-line-soft pt-6")}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><FileText size={15} />Quote file</h3>
      <QuoteFile quoteId={quote.id} readOnly={!canEdit} />
    </div>}
  </Drawer>;
}

function OperationsProgress({ shipment }: { shipment: SalesShipment }) {
  const { current, exception, invoice } = operationsPosition(shipment);
  return <div className="mb-6 rounded-[12px] border border-line-soft bg-[#FBFAF7] p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Truck size={15} className="text-aqua" />Operations progress</h3>
      <span className="flex flex-wrap gap-1.5">
        {exception && <Chip tone="danger">Exception in Operations</Chip>}
        {invoice?.invoice_number && <Chip tone={toneFor(invoice.status)}>{invoice.invoice_number}{invoice.status ? ` · ${invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}` : ""}</Chip>}
      </span>
    </div>
    <Stepper steps={operationsSteps.map((label) => ({ label }))} current={current} tone={exception ? "danger" : "brand"} />
  </div>;
}
