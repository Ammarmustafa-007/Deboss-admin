"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText, Plus, RotateCcw, Send, ShieldAlert, Trash2, Truck as TruckIcon, XCircle } from "lucide-react";
import { use, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, dateTimeLabel, money } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { documentAccept, documentProblem } from "@/lib/documents";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useSession } from "@/components/app/session";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton, StatusChip } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { FilePicker, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Stepper, Tabs } from "@/components/ui/navigation";
import { ActivityFeed, CommentFeed, Composer } from "@/components/sales/feed";
import { DuplicateWarning, useDuplicateCheck } from "@/components/dispatch/carriers-screen";
import {
  activityTypes, carrierPosition, carrierStatusLabel, carrierSteps, documentLabel, documentTypes, invoiceStatusLabel, paymentLabel, paymentMethods, pct, requiredDocuments,
  truckStatusLabel, truckTypeLabel, truckTypes, useCarrier, useDispatchDirectory, weekLabel, type CarrierDetail,
} from "@/components/dispatch/model";

type TabKey = "overview" | "trucks" | "documents" | "activity" | "comments" | "invoices";

export function CarrierScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useCarrier(id);
  if (detail.isLoading) return <div className="space-y-4"><Skeleton className="h-16 w-80" /><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  if (detail.isError || !detail.data) return <EmptyState icon={ShieldAlert} title="Carrier unavailable" body={errorMessage(detail.error)} className="mt-10" />;
  return <CarrierView key={id} data={detail.data} />;
}

function CarrierView({ data }: { data: CarrierDetail }) {
  const { carrier, trucks, rights } = data;
  const search = useSearchParams();
  const initial = (search.get("tab") as TabKey | null) ?? (rights.review ? "documents" : "overview");
  const [tab, setTab] = useState<TabKey>(initial);
  const { current, blocked } = carrierPosition(carrier, trucks);
  const { run, busy } = useBrokerageAction();

  return <div className="space-y-6 animate-rise">
    <PageHeader crumbs={[{ label: rights.sales_side ? "Carriers" : "Trucks", href: rights.sales_side ? "/app/dispatch/carriers" : "/app/dispatch/trucks" }, { label: carrier.company_name }]}
      title={<span className="flex flex-wrap items-center gap-3">{carrier.company_name}<StatusChip status={carrier.review_status} label={carrierStatusLabel[carrier.review_status]} className="text-[13px]" /></span>}
      subtitle={[carrier.mc_number && `MC ${carrier.mc_number}`, carrier.dot_number && `DOT ${carrier.dot_number}`, carrier.owner_name && `Agent: ${carrier.owner_name}`, carrier.dispatch_department_name && `With ${carrier.dispatch_department_name}`].filter(Boolean).join(" · ")}
      actions={rights.submit && <Button variant="primary" icon={<Send size={15} />} pending={busy("submit-carrier")} pendingLabel="Submitting…" disabled={data.missing_documents.length > 0 || !trucks.length} title={data.missing_documents.length ? "Upload the required documents first" : !trucks.length ? "Add a truck first" : undefined} onClick={() => void run("submit-carrier", `/api/v1/dispatch/carriers/${carrier.id}/submit`, "POST", {}, "Carrier submitted for review.")}>{carrier.review_status === "RETURNED" ? "Resubmit for review" : "Submit for review"}</Button>} />

    <Card className="px-4 py-5 sm:px-6">
      <div className="overflow-x-auto"><Stepper steps={carrierSteps.map((label) => ({ label }))} current={current} tone={blocked ? "danger" : "brand"} className="min-w-[520px]" /></div>
      {carrier.review_status === "RETURNED" && carrier.review_note && <p className="mt-4 rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm text-[#A5183F]"><b>Returned for rework:</b> {carrier.review_note}</p>}
      {carrier.review_status === "DISCARDED" && <p className="mt-4 rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm text-[#A5183F]"><b>Discarded.</b> {carrier.review_note}</p>}
      {rights.submit && data.missing_documents.length > 0 && <p className="mt-4 rounded-[12px] bg-[#FFF6E8] px-4 py-3 text-sm text-[#7C4400]">Before submitting, upload: <b>{data.missing_documents.map((type) => documentLabel[type]).join(", ")}</b>{!trucks.length ? " and add at least one truck" : ""}.</p>}
    </Card>

    {data.duplicates.length > 0 && rights.sales_side && <DuplicateWarning matches={data.duplicates} />}
    {rights.review && <ReviewCard data={data} />}

    <Tabs<TabKey> value={tab} onChange={setTab} items={[
      { value: "overview", label: "Profile & terms" },
      { value: "trucks", label: "Trucks", count: trucks.length },
      { value: "documents", label: "Documents", count: data.documents.length, hidden: !rights.sales_side },
      { value: "activity", label: "Appointments & callbacks", count: data.activities.filter((row) => !row.completed_at).length, hidden: !rights.sales_side },
      { value: "comments", label: "Comments", count: data.comments.length },
      { value: "invoices", label: "Weekly invoices", count: data.invoices.length, hidden: !data.invoices.length },
    ]} />
    <div key={tab} className="animate-fade">
      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "trucks" && <TrucksTab data={data} />}
      {tab === "documents" && <DocumentsTab data={data} />}
      {tab === "activity" && <ActivityTab data={data} />}
      {tab === "comments" && <Card className="max-w-3xl"><CardHeader title="Comments" subtitle="Visible to the agent and managers on this carrier" /><div className="space-y-6 p-5">
        <Composer placeholder="Add a comment" pending={busy("comment")} onSubmit={async (body) => (await run("comment", "/api/v1/dispatch/comments", "POST", { entity_type: "CARRIER", entity_id: carrier.id, body }, "Comment added.")) !== undefined} />
        <CommentFeed rows={data.comments} empty="No comments yet." busy={busy} onDelete={(row) => void run(`delete-comment:${row.id}`, `/api/v1/brokerage/comments/${row.id}`, "DELETE", undefined, "Comment deleted.")} />
      </div></Card>}
      {tab === "invoices" && <Card><CardHeader title="Weekly invoices" /><ul className="divide-y divide-line-soft">{data.invoices.map((invoice) => <li key={invoice.id}><Link href={`/app/dispatch/invoices?open=${invoice.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F4]">
        <div className="min-w-0 flex-1"><p className="font-semibold">{invoice.invoice_number}</p><p className="text-xs text-muted">Week {weekLabel(invoice.week_start)} · gross {money(invoice.gross_amount)}</p></div>
        <b className="tabular-nums">{money(invoice.amount)}</b><StatusChip status={invoice.status} label={invoiceStatusLabel[invoice.status]} />{invoice.signed_off_at && <Chip tone="success">Signed off</Chip>}
      </Link></li>)}</ul></Card>}
    </div>
  </div>;
}

/** DS-6, DS-7 and answer 1: approve and hand off to Dispatch Operations, return for rework, or discard. */
function ReviewCard({ data }: { data: CarrierDetail }) {
  const { carrier } = data;
  const directory = useDispatchDirectory();
  const { run, busy } = useBrokerageAction();
  const departments = directory.data?.operations_departments ?? [];
  const [department, setDepartment] = useState("");
  const [note, setNote] = useState("");
  const chosen = department || (departments.length === 1 ? departments[0].id : "");
  const pending = busy("review");
  const review = (action: "APPROVE" | "RETURN" | "DISCARD", success: string) => void run("review", `/api/v1/dispatch/carriers/${carrier.id}/review`, "POST", { action, note: note || undefined, dispatch_department_id: action === "APPROVE" ? chosen : undefined }, success);
  return <Card className="border-brand/40">
    <CardHeader title="Review this carrier" subtitle={`Submitted ${dateTimeLabel(carrier.submitted_at)} by ${carrier.owner_name ?? "the agent"}. Check the profile, trucks and documents below.`} />
    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <SelectField label="Hand off to" required value={chosen} placeholder="Choose Dispatch Operations" disabled={pending} onChange={(event) => setDepartment(event.target.value)} options={departments.map((item) => ({ value: item.id, label: item.name }))} hint={!departments.length && !directory.isLoading ? "No active Dispatch Operations department. Ask the Director to set one up." : undefined} />
        <Button variant="success" icon={<CheckCircle2 size={15} />} pending={pending} pendingLabel="Approving…" disabled={!chosen} className="w-full" onClick={() => review("APPROVE", "Carrier approved and handed to Dispatch Operations.")}>Approve & hand off</Button>
      </div>
      <div className="space-y-3">
        <TextAreaField label="Comment for the agent" hint="Required to return or discard" maxLength={1000} value={note} disabled={pending} onChange={(event) => setNote(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<RotateCcw size={15} />} disabled={pending || !note.trim()} onClick={() => review("RETURN", "Carrier returned to the agent.")}>Return for rework</Button>
          <Button variant="danger" icon={<XCircle size={15} />} disabled={pending || !note.trim()} onClick={() => review("DISCARD", "Carrier discarded.")}>Discard</Button>
        </div>
      </div>
    </div>
  </Card>;
}

function OverviewTab({ data }: { data: CarrierDetail }) {
  const { carrier, rights } = data;
  const { api, manager, teamLead } = useBrokerage();
  const { run, busy } = useBrokerageAction();
  const initial = { company_name: carrier.company_name, mc_number: carrier.mc_number ?? "", dot_number: carrier.dot_number ?? "", contact_name: carrier.contact_name ?? "", phone: carrier.phone ?? "", email: carrier.email ?? "", operating_pattern: carrier.operating_pattern ?? "" };
  const [form, setForm] = useState(initial);
  const initialTerms = { charge_percent: carrier.charge_percent == null ? "" : String(carrier.charge_percent), payment_method: carrier.payment_method ?? "" };
  const [terms, setTerms] = useState(initialTerms);
  const duplicates = useDuplicateCheck(api, form.mc_number, form.dot_number, carrier.id);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => form[key] !== initial[key]);
  const termsDirty = terms.charge_percent !== initialTerms.charge_percent || terms.payment_method !== initialTerms.payment_method;
  const percent = terms.charge_percent === "" ? null : Number(terms.charge_percent);
  const percentError = percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100) ? "Enter 0 to 100." : undefined;
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const save = (event: FormEvent) => { event.preventDefault(); void run("save-carrier", `/api/v1/dispatch/carriers/${carrier.id}`, "PATCH", form, "Carrier saved."); };
  const saveTerms = (event: FormEvent) => { event.preventDefault(); if (percentError) return; void run("save-terms", `/api/v1/dispatch/carriers/${carrier.id}`, "PATCH", { charge_percent: percent, payment_method: terms.payment_method || null }, "Carrier terms saved."); };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
    <Card>
      <CardHeader title="Carrier profile" />
      <form onSubmit={save}>
        <fieldset disabled={!rights.edit || busy("save-carrier")} className="grid gap-4 p-5 sm:grid-cols-2">
          <TextField label="Company name" required minLength={2} maxLength={180} value={form.company_name} onChange={(event) => set("company_name")(event.target.value)} wrapperClassName="sm:col-span-2" />
          <TextField label="MC number" maxLength={20} value={form.mc_number} onChange={(event) => set("mc_number")(event.target.value)} />
          <TextField label="DOT number" maxLength={20} value={form.dot_number} onChange={(event) => set("dot_number")(event.target.value)} />
          {dirty && duplicates.length > 0 && <DuplicateWarning matches={duplicates} className="sm:col-span-2" />}
          <TextField label="Contact name" maxLength={160} value={form.contact_name} onChange={(event) => set("contact_name")(event.target.value)} />
          <TextField label="Phone" type="tel" maxLength={40} value={form.phone} onChange={(event) => set("phone")(event.target.value)} />
          <TextField label="Email" type="email" maxLength={180} value={form.email} onChange={(event) => set("email")(event.target.value)} wrapperClassName="sm:col-span-2" />
          <TextAreaField label="Operating pattern / notes" maxLength={3000} value={form.operating_pattern} onChange={(event) => set("operating_pattern")(event.target.value)} wrapperClassName="sm:col-span-2" />
        </fieldset>
        {rights.edit && <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4">{dirty && <Button variant="ghost" onClick={() => setForm(initial)}>Discard</Button>}<Button type="submit" variant="ink" disabled={!dirty || (!form.mc_number.trim() && !form.dot_number.trim())} pending={busy("save-carrier")} pendingLabel="Saving…">Save profile</Button></div>}
      </form>
    </Card>
    <div className="space-y-6">
      <Card>
        <CardHeader title="Carrier terms" subtitle="Used for every weekly invoice (DEBOSS revenue = gross × charge %)" />
        <form onSubmit={saveTerms}>
          <fieldset disabled={!rights.terms || busy("save-terms")} className="grid gap-4 p-5 sm:grid-cols-2">
            <TextField label="Charge %" type="number" min="0" max="100" step="0.01" inputMode="decimal" error={percentError} value={terms.charge_percent} onChange={(event) => setTerms({ ...terms, charge_percent: event.target.value })} />
            <SelectField label="Payment method" value={terms.payment_method} placeholder="Not set" onChange={(event) => setTerms({ ...terms, payment_method: event.target.value })} options={paymentMethods.map((method) => ({ value: method, label: paymentLabel[method] }))} />
          </fieldset>
          {rights.terms && <div className="flex justify-end border-t border-line-soft px-5 py-4"><Button type="submit" variant="ink" disabled={!termsDirty || Boolean(percentError)} pending={busy("save-terms")} pendingLabel="Saving…">Save terms</Button></div>}
        </form>
      </Card>
      {rights.assign && (manager || teamLead) && <OwnerCard data={data} />}
      <Card className="p-5 text-sm"><dl className="grid grid-cols-2 gap-y-3">
        <dt className="text-muted">Created</dt><dd>{dateLabel(carrier.created_at)}</dd>
        <dt className="text-muted">Submitted</dt><dd>{dateLabel(carrier.submitted_at)}</dd>
        <dt className="text-muted">Reviewed</dt><dd>{carrier.reviewed_at ? `${dateLabel(carrier.reviewed_at)}${carrier.reviewed_by_name ? ` · ${carrier.reviewed_by_name}` : ""}` : "—"}</dd>
        <dt className="text-muted">Charge %</dt><dd>{pct(carrier.charge_percent)}</dd>
      </dl></Card>
    </div>
  </div>;
}

function OwnerCard({ data }: { data: CarrierDetail }) {
  const { carrier } = data;
  const directory = useDispatchDirectory();
  const { run, busy } = useBrokerageAction();
  const pending = busy("assign-carrier");
  return <Card><CardHeader title="Assignment" subtitle="Which agent owns this carrier" /><div className="grid gap-4 p-5">
    <SelectField label="Agent" required value={carrier.owner_id} disabled={pending || !directory.data} onChange={(event) => event.target.value && void run("assign-carrier", `/api/v1/dispatch/carriers/${carrier.id}`, "PATCH", { owner_id: event.target.value }, "Carrier owner updated.")} options={(directory.data?.users ?? []).map((user) => ({ value: user.id, label: user.full_name }))} />
    <SelectField label="Team" value={carrier.team_id ?? ""} placeholder="No team" disabled={pending || !directory.data} onChange={(event) => void run("assign-carrier", `/api/v1/dispatch/carriers/${carrier.id}`, "PATCH", { team_id: event.target.value || null }, "Carrier team updated.")} options={(directory.data?.teams ?? []).map((team) => ({ value: team.id, label: team.name }))} />
  </div></Card>;
}

function TrucksTab({ data }: { data: CarrierDetail }) {
  const { carrier, trucks, rights } = data;
  const { run, busy } = useBrokerageAction();
  const [draft, setDraft] = useState({ unit_number: "", truck_type: "DRY_VAN", equipment_notes: "" });
  const canAdd = rights.edit && rights.sales_side && carrier.review_status !== "DISCARDED";
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run("add-truck", `/api/v1/dispatch/carriers/${carrier.id}/trucks`, "POST", draft, carrier.review_status === "APPROVED" ? "Truck added and sent to Dispatch Operations." : "Truck added.");
    if (saved !== undefined) setDraft({ unit_number: "", truck_type: "DRY_VAN", equipment_notes: "" });
  };
  return <div className="space-y-6">
    <Card>
      <CardHeader title="Trucks" subtitle="Each truck is a sale with its own Dispatcher, loads and weekly invoices" />
      {trucks.length ? <ul className="divide-y divide-line-soft">{trucks.map((truck) => <li key={truck.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-control bg-aqua/12 text-aqua"><TruckIcon size={17} /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold">{truck.unit_number} <span className="font-normal text-muted">· {truckTypeLabel[truck.truck_type]}</span></p><p className="text-xs text-muted">{truck.equipment_notes || "No equipment notes"}{truck.assigned_name ? ` · Dispatcher: ${truck.assigned_name}` : ""}</p></div>
        <StatusChip status={truck.status} label={truckStatusLabel[truck.status]} />
        {truck.status !== "PENDING" && <Link href={`/app/dispatch/trucks/${truck.id}`} className="text-xs font-semibold text-brand-deep hover:underline">Open truck</Link>}
        {canAdd && truck.status === "PENDING" && <Button size="sm" variant="ghost" aria-label="Remove truck" disabled={busy(`remove-truck:${truck.id}`)} onClick={() => void run(`remove-truck:${truck.id}`, `/api/v1/dispatch/trucks/${truck.id}`, "DELETE", undefined, "Truck removed.")} className="text-[#C4254B]"><Trash2 size={14} /></Button>}
      </li>)}</ul> : <EmptyState icon={TruckIcon} title="No trucks yet" body="Add at least one truck before submitting." />}
    </Card>
    {canAdd && <Card className="max-w-3xl"><CardHeader title="Add a truck" /><form onSubmit={add} className="grid items-end gap-3 p-5 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
      <TextField label="Unit / truck #" required maxLength={40} value={draft.unit_number} onChange={(event) => setDraft({ ...draft, unit_number: event.target.value })} />
      <SelectField label="Truck type" required value={draft.truck_type} onChange={(event) => setDraft({ ...draft, truck_type: event.target.value })} options={truckTypes.map((type) => ({ value: type, label: truckTypeLabel[type] }))} />
      <TextField label="Equipment notes" maxLength={500} value={draft.equipment_notes} onChange={(event) => setDraft({ ...draft, equipment_notes: event.target.value })} />
      <Button type="submit" variant="ink" icon={<Plus size={15} />} pending={busy("add-truck")} pendingLabel="Adding…" disabled={!draft.unit_number.trim()} className="h-11">Add</Button>
    </form></Card>}
  </div>;
}

/** DS-3: MC/DOT authority, W9, COI and packet. The first three are needed to submit (DS-5). */
function DocumentsTab({ data }: { data: CarrierDetail }) {
  const { carrier, documents, rights } = data;
  const { api, report } = useBrokerage();
  const { run, busy, refresh, wrap } = useBrokerageAction();
  const [type, setType] = useState(data.missing_documents[0] ?? "MC_AUTHORITY");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const canUpload = rights.edit && carrier.review_status !== "DISCARDED";
  const canRemove = rights.edit && ["DOCS_PENDING", "RETURNED"].includes(carrier.review_status);
  const pick = (picked: File | null) => { const problem = documentProblem(picked); setFileError(problem); setFile(problem ? null : picked); };
  const upload = () => void wrap("upload", async () => {
    if (!file) return;
    try {
      const signed = await responseData<{ signed_url: string; path: string }>(await api(`/api/v1/dispatch/carriers/${carrier.id}/upload-url`, { method: "POST", body: JSON.stringify({ file_name: file.name, content_type: file.type, file_size: file.size }) }));
      const put = await fetch(signed.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The document could not be uploaded.");
      await responseData(await api(`/api/v1/dispatch/carriers/${carrier.id}/documents`, { method: "POST", body: JSON.stringify({ document_type: type, file_name: file.name, storage_path: signed.path }) }));
      setFile(null);
      await refresh();
      report(`${documentLabel[type]} uploaded.`);
    } catch (error) { report(errorMessage(error, "The document could not be uploaded."), "error"); }
  });
  const open = (id: string) => void wrap(`open:${id}`, async () => {
    try { const { signed_url } = await responseData<{ signed_url: string }>(await api(`/api/v1/dispatch/documents/${id}/download-url`)); window.open(signed_url, "_blank", "noopener"); }
    catch (error) { report(errorMessage(error), "error"); }
  });
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Card>
      <CardHeader title="Documents" subtitle={`${documents.length} uploaded`} />
      <ul className="divide-y divide-line-soft border-b border-line-soft">{requiredDocuments.map((required) => { const done = documents.some((row) => row.document_type === required); return <li key={required} className="flex items-center gap-3 px-5 py-2.5 text-sm">{done ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-[#C4254B]" />}<span className={cn(!done && "text-[#A5183F]")}>{documentLabel[required]}</span><span className="ml-auto text-xs text-muted">{done ? "Uploaded" : "Required"}</span></li>; })}</ul>
      {documents.length ? <ul className="divide-y divide-line-soft">{documents.map((document) => <li key={document.id} className="flex items-center gap-3 px-5 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-control bg-info/12 text-info"><FileText size={17} /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{documentLabel[document.document_type]}</p><p className="truncate text-xs text-muted">{document.file_name} · {dateLabel(document.created_at)}{document.uploaded_by_name ? ` · ${document.uploaded_by_name}` : ""}</p></div>
        <Button size="sm" variant="ghost" icon={<ExternalLink size={13} />} pending={busy(`open:${document.id}`)} onClick={() => open(document.id)}>Open</Button>
        {canRemove && <Button size="sm" variant="ghost" aria-label="Remove document" disabled={busy(`remove-doc:${document.id}`)} onClick={() => void run(`remove-doc:${document.id}`, `/api/v1/dispatch/documents/${document.id}`, "DELETE", undefined, "Document removed.")} className="text-[#C4254B]"><Trash2 size={14} /></Button>}
      </li>)}</ul> : <p className="p-6 text-center text-sm text-muted">No documents uploaded yet.</p>}
    </Card>
    {canUpload && <Card className="h-fit"><CardHeader title="Upload a document" /><div className="space-y-4 p-5">
      <SelectField label="Document type" required value={type} onChange={(event) => setType(event.target.value)} options={documentTypes.map((value) => ({ value, label: documentLabel[value] }))} />
      <FilePicker label="File" file={file} onFile={pick} accept={documentAccept} error={fileError} placeholder="Choose a PDF, JPG or PNG" hint="PDF, JPG or PNG · up to 10 MB" disabled={busy("upload")} />
      <Button variant="ink" className="w-full" pending={busy("upload")} pendingLabel="Uploading…" disabled={!file} onClick={upload}>Upload</Button>
    </div></Card>}
  </div>;
}

/** DS-2: appointments, callbacks and follow-ups against the carrier. */
function ActivityTab({ data }: { data: CarrierDetail }) {
  const { carrier, activities, rights } = data;
  const { profile } = useSession();
  const { run, busy } = useBrokerageAction();
  const [form, setForm] = useState({ activity_type: "CALLBACK", body: "", due_at: "" });
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run("add-activity", `/api/v1/dispatch/carriers/${carrier.id}/activities`, "POST", { ...form, due_at: form.due_at ? new Date(form.due_at).toISOString() : null }, "Activity logged.");
    if (saved !== undefined) setForm({ activity_type: "CALLBACK", body: "", due_at: "" });
  };
  return <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
    {rights.edit && <Card className="h-fit"><CardHeader title="Log activity" /><form onSubmit={add} className="space-y-4 p-5"><fieldset disabled={busy("add-activity")} className="space-y-4">
      <SelectField label="Type" required value={form.activity_type} onChange={(event) => setForm({ ...form, activity_type: event.target.value })} options={activityTypes.map((type) => ({ value: type, label: type.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }))} />
      <TextAreaField label="What happened or what's next" required maxLength={3000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
      <TextField label="Due" type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
    </fieldset><Button type="submit" variant="ink" icon={<Plus size={15} />} className="w-full" pending={busy("add-activity")} pendingLabel="Adding…" disabled={!form.body.trim()}>Add activity</Button></form></Card>}
    <Card className={cn(!rights.edit && "xl:col-span-2")}><CardHeader title="Timeline" subtitle={`${activities.length} recorded`} /><div className="p-5">
      <ActivityFeed rows={activities.map((row) => ({ ...row, can_delete: row.created_by === profile.id }))} empty="No appointments or callbacks yet." busy={busy}
        onToggle={rights.edit ? (row) => void run(`activity:${row.id}`, `/api/v1/dispatch/activities/${row.id}`, "PATCH", { completed: !row.completed_at }, row.completed_at ? "Activity reopened." : "Activity marked done.") : undefined}
        onDelete={rights.edit ? (row) => void run(`delete-activity:${row.id}`, `/api/v1/dispatch/activities/${row.id}`, "DELETE", undefined, "Activity deleted.") : undefined} />
    </div></Card>
  </div>;
}
