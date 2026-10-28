"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, CircleSlash, ExternalLink, FileCheck2, FileSearch, FileText, ReceiptText, RotateCcw, ShieldAlert, Upload } from "lucide-react";
import { use, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { dateTimeLabel, money } from "@/lib/format";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton, StatusChip, humanize } from "@/components/ui/surface";
import { Stepper, Tabs } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Bump } from "@/components/ui/motion";
import { FilePicker, SelectField, TextAreaField, TextField, controlClass } from "@/components/ui/field";
import { ActivityFeed, CommentFeed, Composer } from "@/components/sales/feed";
import { documentAccept, documentProblem } from "@/lib/documents";
import { allowedStatuses, canCancel, canMissPickup, documentTypes, exceptionOpen, loadProfit, nextStatus, paymentStatuses, progressStatuses, statusLabel, useOperationsDirectory, type Directory, type Shipment, type ShipmentDetail } from "@/components/operations/model";

type TabKey = "details" | "documents" | "exception" | "activity";

export function ShipmentRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ShipmentScreen shipmentId={id} />;
}

export function ShipmentScreen({ shipmentId }: { shipmentId: string }) {
  const { api } = useBrokerage();
  const detail = useQuery({ queryKey: ["brokerage", "shipment", shipmentId], queryFn: async () => responseData<ShipmentDetail>(await api(`/api/v1/brokerage/shipments/${shipmentId}/detail`)), staleTime: 15_000 });
  if (detail.isLoading) return <div className="space-y-6" aria-busy="true"><Skeleton className="h-16 w-96 max-w-full" /><Skeleton className="h-24 rounded-card" /><Skeleton className="h-96 rounded-card" /></div>;
  if (detail.isError || !detail.data) return <EmptyState icon={FileSearch} title="Shipment unavailable" body={errorMessage(detail.error, "This shipment could not be loaded.")} action={<LinkButton href="/app/operations" variant="ink">Back to shipments</LinkButton>} className="mt-10" />;
  return <ShipmentView key={shipmentId} data={detail.data} />;
}

function ShipmentView({ data }: { data: ShipmentDetail }) {
  const { workspace, manager } = useBrokerage();
  const caps = workspace.capabilities ?? {};
  const { shipment, documents, events, comments, invoice } = data;
  // While in exception, the progress line shows where the shipment was when it was raised.
  // A missed pickup or a cancellation also holds the line where the load was, in red.
  const paused = ["EXCEPTION", "MISSED_PICKUP", "CANCELLED"].includes(shipment.status);
  const heldAt = (status: string) => { const from = events.find((event) => event.to_status === status)?.from_status; return from && progressStatuses.includes(from) ? from : "BOOKED"; };
  const lineStatus = paused ? heldAt(shipment.status) : shipment.status;
  const cancelled = shipment.status === "CANCELLED";
  const directory = useOperationsDirectory(manager || Boolean(caps.teamLead));
  const pendingDocuments = documents.filter((document) => !document.is_verified).length;
  const [tab, setTab] = useState<TabKey>(exceptionOpen(shipment) ? "exception" : "details");

  return <div className="space-y-6 animate-rise">
    <PageHeader
      crumbs={[{ label: "Operations", href: "/app/operations" }, { label: shipment.reference_number }]}
      title={<span className="flex flex-wrap items-center gap-3">{shipment.reference_number}<StatusChip status={shipment.status} label={statusLabel[shipment.status]} className="text-[13px]" />{shipment.invoice_ready && <Chip tone="success">Invoice-ready</Chip>}</span>}
      subtitle={<>{shipment.customer_name || "—"} · {shipment.pickup_location || "—"} <span className="text-brand">→</span> {shipment.delivery_location || "—"}{shipment.sales_agent_name && <> · Sales agent <b className="font-semibold text-ink">{shipment.sales_agent_name}</b></>}</>}
      actions={<>
        {invoice?.invoice_number
          ? (manager || caps.canMarkInvoiceReady ? <Link href="/app/invoices"><Chip tone="info" className="h-8 px-3 text-[13px] hover:brightness-95"><ReceiptText size={13} />{invoice.invoice_number}{invoice.status ? ` · ${humanize(invoice.status)}` : ""}</Chip></Link> : <Chip tone="info" className="h-8 px-3 text-[13px]"><ReceiptText size={13} />{invoice.invoice_number}{invoice.status ? ` · ${humanize(invoice.status)}` : ""}</Chip>)
          : (manager || caps.canMarkInvoiceReady) && ["DELIVERED", "COMPLETED"].includes(shipment.status) && <GenerateInvoice shipmentId={shipment.id} />}
        <StatusControl shipment={shipment} />
      </>}
    />

    <Card className="px-4 py-5 sm:px-6">
      {/* An exception pauses the lifecycle: the line holds its place in red rather than disappearing. */}
      <div className="overflow-x-auto"><Stepper steps={progressStatuses.map((status) => ({ label: statusLabel[status] }))} current={lineStatus === "COMPLETED" ? progressStatuses.length : Math.max(0, progressStatuses.indexOf(lineStatus))} tone={paused ? "danger" : "brand"} className="min-w-[560px]" /></div>
      {shipment.status === "EXCEPTION" && <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm"><AlertTriangle size={18} className="shrink-0 text-danger" /><p><b>Shipment in exception.</b> {shipment.exception_note ? shipment.exception_note : "Details are in the Exception tab."}</p></div>}
      {shipment.status === "MISSED_PICKUP" && <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm animate-fade"><CircleSlash size={18} className="shrink-0 text-danger" /><p><b>Pickup missed.</b> {shipment.missed_pickup_reason} Re-book the load or cancel it.</p></div>}
      {cancelled && <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-black/[.04] px-4 py-3 text-sm animate-fade"><Ban size={18} className="shrink-0 text-ink/60" /><p><b>Load cancelled{shipment.cancelled_at ? ` · ${dateTimeLabel(shipment.cancelled_at)}` : ""}.</b> {shipment.cancel_reason}</p></div>}
      {(manager || caps.canAssignShipments) && !cancelled && <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] xl:items-center">
        <Assignment shipment={shipment} directory={directory.data} />
        <Signal ok={!pendingDocuments} label="Documents" value={pendingDocuments ? `${pendingDocuments} pending review` : documents.length ? "All verified" : "None uploaded"} />
        <Signal ok={!exceptionOpen(shipment)} label="Exception" value={exceptionOpen(shipment) ? "Needs resolution" : "None open"} />
      </div>}
    </Card>

    <Tabs<TabKey> value={tab} onChange={setTab} items={[
      { value: "details", label: "Load details & finance" },
      { value: "documents", label: "Documents", count: caps.canReviewDocuments ? (pendingDocuments || undefined) : (documents.length || undefined) },
      { value: "exception", label: exceptionOpen(shipment) ? <span className="flex items-center gap-1.5 text-[#C4254B]"><ShieldAlert size={14} />Exception</span> : "Exception" },
      { value: "activity", label: "Comments & timeline", count: comments.length || undefined },
    ]} />

    <div key={tab} className="animate-fade">
      {tab === "details" && <LoadForm shipment={shipment} canMarkInvoiceReady={Boolean(caps.canMarkInvoiceReady)} />}
      {tab === "documents" && <Documents data={data} canReview={Boolean(caps.canReviewDocuments)} />}
      {tab === "exception" && <ExceptionPanel data={data} canResolve={Boolean(caps.canResolveExceptions)} directory={directory.data} />}
      {tab === "activity" && <ActivityPanel shipmentId={shipment.id} events={events} comments={comments} directory={directory.data} />}
    </div>
  </div>;
}

function Signal({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return <div className="flex items-center gap-3">
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-control", ok ? "bg-success/12 text-success" : "bg-brand/12 text-brand")}>{ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
    <div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="truncate text-sm font-semibold">{value}</p></div>
  </div>;
}

/** Primary "next step" action, a status menu for corrections, and Missed pickup / Cancel (each needs a reason). */
function StatusControl({ shipment }: { shipment: Shipment }) {
  const { run, busy } = useBrokerageAction();
  const [asking, setAsking] = useState<"MISSED_PICKUP" | "CANCELLED" | null>(null);
  const pending = busy(`status:${shipment.id}`);
  const step = nextStatus[shipment.status];
  const move = (status: string, extra: Record<string, unknown> = {}) => run(`status:${shipment.id}`, `/api/v1/brokerage/shipments/${shipment.id}`, "PATCH", { status, ...extra }, status === "CANCELLED" ? "Load cancelled." : status === "MISSED_PICKUP" ? "Missed pickup recorded." : ["DELIVERED", "COMPLETED"].includes(status) ? `${statusLabel[status]}. Invoice created for billing.` : `Status: ${statusLabel[status]}.`);
  if (shipment.status === "CANCELLED") return null;
  const locked = pending || ["EXCEPTION", "COMPLETED", "MISSED_PICKUP"].includes(shipment.status);
  return <div className="flex flex-wrap items-center gap-2">
    {canMissPickup(shipment.status) && <Button variant="outline" icon={<CircleSlash size={15} />} disabled={pending} onClick={() => setAsking("MISSED_PICKUP")}>Missed pickup</Button>}
    {canCancel(shipment.status) && <Button variant="ghost" className="text-[#A5183F]" icon={<Ban size={15} />} disabled={pending} onClick={() => setAsking("CANCELLED")}>Cancel load</Button>}
    {step && <Button variant="primary" icon={<ArrowRight size={15} />} pending={pending} pendingLabel="Updating…" onClick={() => void move(step.status)}>{step.action}</Button>}
    {!["MISSED_PICKUP"].includes(shipment.status) && <>
      <label className="sr-only" htmlFor={`status-${shipment.id}`}>Change status</label>
      <select id={`status-${shipment.id}`} value={shipment.status} disabled={locked} onChange={(event) => void move(event.target.value)} title={shipment.status === "EXCEPTION" ? "Resolve the exception to continue" : "Change status"} className={cn(controlClass, "h-10 w-auto min-w-40 text-[13px] font-medium text-ink", pending && "opacity-60")}>
        {allowedStatuses(shipment.status).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
      </select>
    </>}
    {asking && <ReasonModal kind={asking} reference={shipment.reference_number} pending={pending} onClose={() => setAsking(null)}
      onConfirm={async (reason) => { if (await move(asking, asking === "CANCELLED" ? { cancel_reason: reason } : { missed_pickup_reason: reason }) !== undefined) setAsking(null); }} />}
  </div>;
}

/** Asks for the reason a missed pickup or a cancellation needs before it is saved. */
export function ReasonModal({ kind, reference, pending, onClose, onConfirm }: { kind: "MISSED_PICKUP" | "CANCELLED"; reference: string; pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const cancel = kind === "CANCELLED";
  return <Modal open onClose={onClose} dismissible={!pending} title={cancel ? `Cancel ${reference}?` : `Missed pickup on ${reference}`}
    subtitle={cancel ? "The load ends here. The customer and its other loads are not affected." : "The load waits here until you re-book it or cancel it."}
    footer={<><Button variant="ghost" onClick={onClose} disabled={pending}>Back</Button><Button variant={cancel ? "danger" : "primary"} icon={cancel ? <Ban size={15} /> : <CircleSlash size={15} />} pending={pending} pendingLabel="Saving…" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>{cancel ? "Cancel load" : "Record missed pickup"}</Button></>}>
    <TextAreaField label={cancel ? "Reason for cancelling" : "What happened at pickup"} required autoFocus maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={cancel ? "e.g. Customer postponed the shipment to next month" : "e.g. Driver arrived after the facility closed"} />
  </Modal>;
}

function GenerateInvoice({ shipmentId }: { shipmentId: string }) {
  const { run, busy } = useBrokerageAction();
  return <Button variant="outline" icon={<ReceiptText size={15} />} pending={busy("generate-invoice")} pendingLabel="Creating…" onClick={() => void run("generate-invoice", `/api/v1/brokerage/shipments/${shipmentId}/invoice`, "POST", {}, "Invoice created.")}>Generate invoice</Button>;
}

function Assignment({ shipment, directory }: { shipment: Shipment; directory?: Directory }) {
  const { run, busy } = useBrokerageAction();
  const pending = busy(`assign:${shipment.id}`);
  const assign = (patch: { assigned_to?: string | null; team_id?: string | null }) => void run(`assign:${shipment.id}`, `/api/v1/brokerage/shipments/${shipment.id}`, "PATCH", patch, "Shipment assignment updated.");
  const select = (label: string, value: string, empty: string, options: { id: string; label: string }[], onChange: (value: string) => void) => <label className="min-w-0 text-xs text-muted">{label}
    <select value={value} disabled={pending || !directory} onChange={(event) => onChange(event.target.value)} className={cn(controlClass, "mt-1 h-10 text-[13px] font-medium", !value && empty === "Needs assignment" && "border-accent/50 text-accent")}>
      <option value="">{empty}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </label>;
  return <>
    {select("Operations agent", shipment.assigned_to ?? "", "Needs assignment", (directory?.users ?? []).map((user) => ({ id: user.id, label: user.full_name })), (value) => assign({ assigned_to: value || null }))}
    {select("Team", shipment.team_id ?? "", "No team", (directory?.teams ?? []).map((team) => ({ id: team.id, label: team.name })), (value) => assign({ team_id: value || null }))}
  </>;
}

const loadSections: { title: string; hint?: string; fields: [keyof Shipment & string, string, ("date" | "email" | "area")?][] }[] = [
  { title: "Carrier", hint: "Only Operations sees who the carrier is. Sales sees the carrier rate and profit.", fields: [["carrier_name", "Carrier company"], ["carrier_mc", "MC #"], ["dispatcher_name", "Dispatcher name"], ["dispatcher_phone", "Dispatcher phone"], ["dispatcher_email", "Dispatcher email", "email"], ["driver_name", "Driver name"], ["driver_phone", "Driver phone"], ["truck_type_size", "Truck type & size"], ["truck_number", "Truck no."], ["trailer_number", "Trailer no."]] },
  { title: "Pickup", fields: [["pickup_facility", "Facility name"], ["pickup_address", "Address"], ["pickup_contact", "Point of contact"], ["pickup_po", "PO #"], ["pickup_date", "Pickup date", "date"], ["pickup_notes", "Notes", "area"]] },
  { title: "Delivery", fields: [["delivery_facility", "Facility name"], ["delivery_address", "Delivery address"], ["delivery_contact", "Point of contact"], ["delivery_date", "Delivery date", "date"], ["delivery_notes", "Notes", "area"]] },
  { title: "Commodity", fields: [["commodity_product", "Product"], ["commodity_weight", "Weight"], ["commodity_pieces", "Pallets / skids / pieces"]] },
];
const loadKeys = loadSections.flatMap((section) => section.fields.map(([key]) => key));

function loadState(shipment: Shipment) {
  const text = (value: unknown) => value == null ? "" : String(value);
  return { ...Object.fromEntries(loadKeys.map((key) => [key, text(shipment[key])])), carrier_rate: text(shipment.carrier_rate), amount_quoted: text(shipment.amount_quoted), amount_invoiced: text(shipment.amount_invoiced), amount_paid: text(shipment.amount_paid), payment_status: shipment.payment_status ?? "DRAFT", invoice_ready: Boolean(shipment.invoice_ready) } as Record<string, string | boolean>;
}

/** Everything Operations records on a load: carrier, carrier rate (profit is worked out live), pickup, delivery, commodity, then finance. */
function LoadForm({ shipment, canMarkInvoiceReady }: { shipment: Shipment; canMarkInvoiceReady: boolean }) {
  const { run, busy } = useBrokerageAction();
  const initial = loadState(shipment);
  const [form, setForm] = useState(initial);
  const changed = Object.keys(initial).filter((key) => form[key] !== initial[key]);
  const dirty = changed.length > 0;
  const pending = busy(`finance:${shipment.id}`);
  const locked = shipment.status === "CANCELLED";
  const set = (field: string) => (value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const number = (value: string | boolean) => value === "" ? null : Number(value);
  const money_ = ["carrier_rate", "amount_quoted", "amount_invoiced", "amount_paid"];

  // Amounts must be numbers of 0 or more (BO-3); shown under each field before anything is sent.
  const amountError = (value: string | boolean) => value === "" ? undefined : !Number.isFinite(Number(value)) ? "Enter a number." : Number(value) < 0 ? "Cannot be negative." : undefined;
  const errors = Object.fromEntries(money_.map((key) => [key, amountError(form[key])]));
  const invalid = Object.values(errors).some(Boolean);
  const profit = loadProfit(shipment.amount_agreed, form.carrier_rate);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (invalid || !dirty) return;
    const body = Object.fromEntries(changed.filter((key) => key !== "invoice_ready" || canMarkInvoiceReady).map((key) => [key, money_.includes(key) ? number(form[key]) : key === "invoice_ready" || key === "payment_status" ? form[key] : (form[key] as string).trim() || null]));
    void run(`finance:${shipment.id}`, `/api/v1/brokerage/shipments/${shipment.id}`, "PATCH", body, "Load details saved.");
  };
  const field = ([key, label, kind]: [string, string, ("date" | "email" | "area")?]) => kind === "area"
    ? <TextAreaField key={key} label={label} value={String(form[key])} onChange={(event) => set(key)(event.target.value)} wrapperClassName="sm:col-span-2 xl:col-span-3" className="min-h-16" />
    : <TextField key={key} label={label} type={kind === "date" ? "date" : kind === "email" ? "email" : "text"} value={String(form[key])} onChange={(event) => set(key)(event.target.value)} />;

  return <Card>
    <form onSubmit={save}>
      <fieldset disabled={pending || locked} className="divide-y divide-line-soft">
        {loadSections.slice(0, 1).map((section) => <section key={section.title} className="p-5"><h3 className="text-sm font-semibold">{section.title}</h3>{section.hint && <p className="mb-4 mt-0.5 text-xs text-muted">{section.hint}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{section.fields.map(field)}</div></section>)}
        <section className="p-5"><h3 className="mb-4 text-sm font-semibold">Rate & profit</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
            <TextField label="Carrier rate" type="number" min="0" step="0.01" inputMode="decimal" error={errors.carrier_rate} value={String(form.carrier_rate)} onChange={(event) => set("carrier_rate")(event.target.value)} />
            <Readout label="Agreed rate (from Sales)" value={shipment.amount_agreed == null ? "Not set" : money(shipment.amount_agreed)} />
            <Readout label="Profit" value={profit ? money(profit.profit) : "—"} tone={profit ? (profit.profit < 0 ? "bad" : "good") : undefined} />
            <Readout label="Profit %" value={profit?.pct != null ? `${profit.pct}%` : "—"} tone={profit ? (profit.profit < 0 ? "bad" : "good") : undefined} />
          </div>
          {(shipment.miles != null || shipment.load_notes) && <p className="mt-3 text-xs text-muted">From Sales: {shipment.miles != null ? <b className="font-semibold text-ink">{shipment.miles} miles</b> : null}{shipment.miles != null && shipment.load_notes ? " · " : ""}{shipment.load_notes}</p>}
          {!shipment.amount_agreed && <p className="mt-3 text-xs text-muted">Profit appears once Sales enters the agreed rate.</p>}
        </section>
        {loadSections.slice(1).map((section) => <section key={section.title} className="p-5"><h3 className="mb-4 text-sm font-semibold">{section.title}</h3><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{section.fields.map(field)}</div></section>)}
        <section className="p-5"><h3 className="mb-4 text-sm font-semibold">Finance</h3><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField label="Quoted amount" type="number" min="0" step="0.01" inputMode="decimal" error={errors.amount_quoted} value={String(form.amount_quoted)} onChange={(event) => set("amount_quoted")(event.target.value)} />
          <TextField label="Invoiced amount" type="number" min="0" step="0.01" inputMode="decimal" error={errors.amount_invoiced} value={String(form.amount_invoiced)} onChange={(event) => set("amount_invoiced")(event.target.value)} />
          <TextField label="Paid amount" type="number" min="0" step="0.01" inputMode="decimal" error={errors.amount_paid} value={String(form.amount_paid)} onChange={(event) => set("amount_paid")(event.target.value)} />
          <SelectField label="Payment status" required value={String(form.payment_status)} onChange={(event) => set("payment_status")(event.target.value)} options={paymentStatuses.map((status) => ({ value: status, label: humanize(status) }))} />
        </div>
        {canMarkInvoiceReady && <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-control border border-line px-4 py-3 text-sm font-medium hover:border-brand">
          <input type="checkbox" checked={Boolean(form.invoice_ready)} onChange={(event) => set("invoice_ready")(event.target.checked)} className="h-4 w-4" />Mark invoice-ready
        </label>}</section>
      </fieldset>
      {!locked && <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4">
        {dirty && <Button variant="ghost" onClick={() => setForm(initial)} disabled={pending}>Discard</Button>}
        <Button type="submit" variant="ink" pending={pending} pendingLabel="Saving…" disabled={!dirty || invalid}>Save changes</Button>
      </div>}
    </form>
  </Card>;
}

function Readout({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <div className="rounded-control border border-line-soft bg-[#FAF8F4] px-3.5 py-2.5">
    <p className="text-xs text-muted">{label}</p>
    <p className={cn("mt-0.5 text-lg font-bold tabular-nums transition-colors", tone === "good" && "text-[#14693A]", tone === "bad" && "text-[#A5183F]")}><Bump value={value} /></p>
  </div>;
}

function Documents({ data, canReview }: { data: ShipmentDetail; canReview: boolean }) {
  const { api, report } = useBrokerage();
  const { run, busy, wrap, refresh } = useBrokerageAction();
  const { shipment, documents } = data;
  const [documentType, setDocumentType] = useState("BOL");
  const [file, setFile] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const uploading = busy("document");

  // Same rules the API and storage enforce (BO-4), checked as soon as a file is picked.
  const [fileError, setFileError] = useState<string>();
  const pick = (picked: File | null) => {
    const problem = documentProblem(picked);
    setFileError(problem);
    setFile(problem ? null : picked);
  };

  const upload = () => void wrap("document", async () => {
    if (!file) return;
    try {
      const signed = await responseData<{ signed_url: string; path: string }>(await api(`/api/v1/brokerage/shipments/${shipment.id}/upload-url`, { method: "POST", body: JSON.stringify({ file_name: file.name, content_type: file.type, file_size: file.size }) }));
      const put = await fetch(signed.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Document upload failed.");
      await responseData(await api(`/api/v1/brokerage/shipments/${shipment.id}/documents`, { method: "POST", body: JSON.stringify({ document_type: documentType, storage_path: signed.path }) }));
      setFile(null);
      void refresh();
      report("Document saved.");
    } catch (error) { report(errorMessage(error, "Document upload failed."), "error"); }
  });

  const open = (id: string) => void wrap(`download:${id}`, async () => {
    try {
      const result = await responseData<{ signed_url: string }>(await api(`/api/v1/brokerage/documents/${id}/download-url`));
      window.open(result.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) { report(errorMessage(error, "Document could not be opened."), "error"); }
  });

  const review = async (id: string, is_verified: boolean) => {
    if (await run(`review:${id}`, `/api/v1/brokerage/documents/${id}/review`, "PATCH", { is_verified, review_note: reviewNote || null }, is_verified ? "Document verified." : "Document returned for changes.") !== undefined) setReviewNote("");
  };

  return <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
    <Card className="h-fit">
      <CardHeader title="Upload paperwork" />
      <div className="space-y-4 p-5">
        <SelectField label="Document type" required value={documentType} disabled={uploading} onChange={(event) => setDocumentType(event.target.value)} options={documentTypes.map((type) => ({ value: type, label: type.replaceAll("_", " ") }))} />
        <FilePicker label="File" file={file} onFile={pick} disabled={uploading} accept={documentAccept} hint="PDF, JPG or PNG · up to 10 MB" error={fileError} placeholder="Choose a PDF, JPG or PNG" />
        <div className="flex gap-2">
          {file && <Button variant="ghost" onClick={() => setFile(null)} disabled={uploading}>Discard</Button>}
          <Button variant="ink" icon={<Upload size={15} />} pending={uploading} pendingLabel="Saving…" disabled={!file} onClick={upload} className="flex-1">Save document</Button>
        </div>
      </div>
    </Card>
    <Card>
      <CardHeader title="Documents" subtitle={`${documents.length} uploaded`} />
      {canReview && documents.length > 0 && <div className="border-b border-line-soft p-5"><TextAreaField label="Review note" hint="Sent with the next verify or return." value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="min-h-16" /></div>}
      {documents.length ? <ul className="divide-y divide-line-soft">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-info/12 text-info"><FileText size={17} /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{document.document_type.replaceAll("_", " ")}</p><p className="truncate text-xs text-muted">{document.created_at ? dateTimeLabel(document.created_at) : ""}{document.review_note ? ` · ${document.review_note}` : ""}</p></div>
        <Chip tone={document.is_verified ? "success" : "brand"}>{document.is_verified ? "Verified" : "Pending review"}</Chip>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" icon={<ExternalLink size={13} />} pending={busy(`download:${document.id}`)} onClick={() => open(document.id)}>Open</Button>
          {canReview && <Button size="sm" variant={document.is_verified ? "outline" : "success"} icon={document.is_verified ? <RotateCcw size={13} /> : <FileCheck2 size={13} />} pending={busy(`review:${document.id}`)} disabled={busy() && !busy(`review:${document.id}`)} onClick={() => void review(document.id, !document.is_verified)}>{document.is_verified ? "Return" : "Verify"}</Button>}
        </div>
      </li>)}</ul> : <EmptyState icon={FileText} title="No documents yet" body="Upload the BOL, POD or rate confirmation for this shipment." />}
    </Card>
  </div>;
}

function ExceptionPanel({ data, canResolve, directory }: { data: ShipmentDetail; canResolve: boolean; directory?: Directory }) {
  const { run, busy } = useBrokerageAction();
  const { shipment, events } = data;
  const initial = { exception_note: shipment.exception_note ?? "", exception_resolution: shipment.exception_resolution ?? "" };
  const [form, setForm] = useState(initial);
  const dirty = form.exception_note !== initial.exception_note || form.exception_resolution !== initial.exception_resolution;
  const pending = busy(`exception:${shipment.id}`);
  const history = events.filter((event) => event.event_type.includes("EXCEPTION"));
  // Where the shipment was before the exception, so resolving puts it back on track.
  const previous = events.find((event) => event.to_status === "EXCEPTION")?.from_status ?? (shipment.status === "EXCEPTION" ? "IN_TRANSIT" : shipment.status);
  const ownerName = directory?.users.find((user) => user.id === shipment.exception_owner_id)?.full_name;

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(`exception:${shipment.id}`, `/api/v1/brokerage/shipments/${shipment.id}`, "PATCH", canResolve
      ? { exception_note: form.exception_note || null, exception_resolution: form.exception_resolution || null, status: form.exception_note && !form.exception_resolution ? "EXCEPTION" : previous }
      : { exception_note: form.exception_note || null, status: form.exception_note ? "EXCEPTION" : previous },
    canResolve ? (form.exception_resolution ? `Exception resolved. Back to ${statusLabel[previous] ?? previous}.` : "Exception updated.") : "Exception reported to your manager.");
  };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Card>
      <CardHeader title={exceptionOpen(shipment) ? "Open exception" : shipment.exception_resolution ? "Resolved exception" : "Report an exception"} actions={exceptionOpen(shipment) ? <Chip tone="danger">Needs resolution</Chip> : shipment.exception_resolution ? <Chip tone="success">Resolved</Chip> : undefined} />
      <form onSubmit={save} className="space-y-4 p-5">
        <fieldset disabled={pending} className="space-y-4">
          <TextAreaField label="What went wrong" required maxLength={3000} value={form.exception_note} onChange={(event) => setForm({ ...form, exception_note: event.target.value })} />
          {canResolve && <TextAreaField label="Resolution" hint={exceptionOpen(shipment) ? `Saving a resolution moves the shipment back to ${statusLabel[previous] ?? previous}.` : undefined} value={form.exception_resolution} onChange={(event) => setForm({ ...form, exception_resolution: event.target.value })} />}
        </fieldset>
        <div className="flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm(initial)} disabled={pending}>Discard</Button>}
          <Button type="submit" variant={canResolve ? "ink" : "danger"} icon={<ShieldAlert size={15} />} pending={pending} pendingLabel={canResolve ? "Saving…" : "Reporting…"} disabled={!dirty}>{canResolve ? "Save exception" : "Report exception"}</Button>
        </div>
      </form>
    </Card>
    <div className="space-y-6">
    {canResolve && directory && <Card className="h-fit">
      <CardHeader title="Exception owner" subtitle="Who is fixing it" />
      <div className="p-5"><SelectField label="Owner" value={shipment.exception_owner_id ?? ""} placeholder="No owner" disabled={busy(`owner:${shipment.id}`)} onChange={(event) => void run(`owner:${shipment.id}`, `/api/v1/brokerage/shipments/${shipment.id}`, "PATCH", { exception_owner_id: event.target.value || null }, event.target.value ? "Exception owner assigned." : "Exception owner cleared.")} options={directory.users.map((user) => ({ value: user.id, label: user.full_name }))} />{ownerName && <p className="mt-2 text-xs text-muted">{ownerName} is notified.</p>}</div>
    </Card>}
    <Card className="h-fit">
      <CardHeader title="Exception history" />
      <div className="p-5"><ActivityFeed rows={history} empty="No exception activity." /></div>
    </Card>
    </div>
  </div>;
}

function ActivityPanel({ shipmentId, events, comments, directory }: { shipmentId: string; events: ShipmentDetail["events"]; comments: ShipmentDetail["comments"]; directory?: Directory }) {
  const { profile } = useSession();
  const { run, busy } = useBrokerageAction();
  const authorName = (id?: string | null) => id === profile.id ? profile.full_name : directory?.users.find((user) => user.id === id)?.full_name ?? "Operations team";
  return <div className="grid gap-6 xl:grid-cols-2">
    <Card>
      <CardHeader title="Comments" />
      <div className="space-y-5 p-5">
        <Composer placeholder="Add an internal comment" pending={busy(`shipment-comment:${shipmentId}`)} onSubmit={async (body) => (await run(`shipment-comment:${shipmentId}`, `/api/v1/brokerage/shipments/${shipmentId}/comments`, "POST", { body }, "Shipment comment added.")) !== undefined} />
        <CommentFeed rows={comments.map((comment) => ({ ...comment, author_name: authorName(comment.author_id) }))} empty="No comments yet." />
      </div>
    </Card>
    <Card>
      <CardHeader title="Timeline" subtitle={`${events.length} events`} />
      <div className="max-h-[560px] overflow-y-auto p-5"><ActivityFeed rows={events} empty="No events yet." /></div>
    </Card>
  </div>;
}
