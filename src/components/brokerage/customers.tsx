"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PendingButton, useSingleFlight } from "@/components/action-state";
import { responseData } from "@/lib/api";
import { CommentList, DetailSkeleton, Empty, Info, Input, SectionTitle, Timeline, message, money } from "@/components/brokerage/shared";

export function CustomerWorkspace({ customerId, api, report, readOnly = false }: { customerId: string; api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const customer = useQuery({ queryKey: ["brokerage", "customer", customerId], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/customers/" + customerId + "/profile")), staleTime: 15_000 });
  const [comment, setComment] = useState("");
  const [customerForm, setCustomerForm] = useState({ company_name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [showNewShipment, setShowNewShipment] = useState(false);
  const actions = useSingleFlight();
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "customer", customerId] });
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "customers"] });
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "workspace"] });
  };

  useEffect(() => {
    if (customer.data?.customer) {
      const item = customer.data.customer;
      setCustomerForm({ company_name: item.company_name ?? "", contact_name: item.contact_name ?? "", contact_email: item.contact_email ?? "", contact_phone: item.contact_phone ?? "" });
    }
  }, [customer.data?.customer]);

  const postComment = () => void actions.run("comment", async () => {
    if (!comment.trim()) return;
    try {
      await responseData(await api("/api/v1/brokerage/customers/" + customerId + "/comments", { method: "POST", body: JSON.stringify({ body: comment }) }));
      setComment("");
      reload();
      report("Customer comment added.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const saveCustomer = () => void actions.run("customer", async () => {
    try {
      await responseData(await api("/api/v1/brokerage/customers/" + customerId, { method: "PATCH", body: JSON.stringify(customerForm) }));
      reload();
      report("Customer profile saved.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const updateShipmentStatus = (shipment: any, sales_status: string) => void actions.run("shipment-status:" + shipment.id, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/sales-shipments/" + shipment.id, { method: "PATCH", body: JSON.stringify({ status: sales_status }) }));
      reload();
      report(`Shipment status changed to ${sales_status}.`);
    } catch (error) {
      report(message(error), "error");
    }
  });
  const submitShipmentForReview = (shipment: any) => void actions.run("shipment-review:" + shipment.id, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/quotes/" + shipment.quote_id + "/submit", { method: "POST" }));
      reload();
      report("Shipment submitted to the Sales Manager for review.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const removeComment = (commentId: string) => void actions.run("delete-comment:" + commentId, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/comments/" + commentId, { method: "DELETE" }));
      reload();
      report("Customer comment deleted.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const updateActivity = (activity: any, completed: boolean) => void actions.run("activity:" + activity.id, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/activities/" + activity.id, { method: "PATCH", body: JSON.stringify({ completed }) }));
      reload();
      report(completed ? "Activity marked completed." : "Activity reopened.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const deleteActivity = (activityId: string) => void actions.run("delete-activity:" + activityId, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/activities/" + activityId, { method: "DELETE" }));
      reload();
      report("Activity deleted.");
    } catch (error) {
      report(message(error), "error");
    }
  });

  if (customer.isLoading) return <div className="rounded-lg border border-black/8 p-5"><LoaderCircle className="animate-spin text-brand" size={17}/></div>;
  if (customer.isError || !customer.data) return <Empty title="Customer workspace unavailable" copy={message(customer.error)}/>;

  const data = customer.data;
  const canEdit = !readOnly && Boolean(data.can_edit);
  const customerBusy = actions.isBusy("customer");
  const commentBusy = actions.isBusy("comment");
  const selectedShipment = (data.shipments ?? []).find((shipment: any) => shipment.id === selectedShipmentId);
  const quotesById = new Map<string, any>((data.quotes ?? []).map((quote: any) => [quote.id, quote]));
  return <section className="rounded-lg border border-black/8 p-5">
    <SectionTitle title={readOnly ? "Customer profile" : "Commercial shipment workspace"} copy={readOnly ? "A read-only customer record. Sales Workspace is the only place where customer, shipment, follow-up, and note changes are made." : "Manage the customer record, commercial shipments, follow-ups, and notes without leaving Sales Workspace."}/>
    {readOnly ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Company" value={data.customer.company_name || "Not supplied"}/><Info label="Contact" value={data.customer.contact_name || "Not supplied"}/><Info label="Email" value={data.customer.contact_email || "Not supplied"}/><Info label="Phone" value={data.customer.contact_phone || "Not supplied"}/></div> : <fieldset disabled={customerBusy || !canEdit} className="mt-4 grid gap-3 disabled:opacity-55 sm:grid-cols-2"><Input light label="Company" value={customerForm.company_name} onChange={(company_name) => setCustomerForm({ ...customerForm, company_name })}/><Input light label="Contact" required={false} value={customerForm.contact_name} onChange={(contact_name) => setCustomerForm({ ...customerForm, contact_name })}/><Input light label="Email" type="email" required={false} value={customerForm.contact_email} onChange={(contact_email) => setCustomerForm({ ...customerForm, contact_email })}/><Input light label="Phone" required={false} value={customerForm.contact_phone} onChange={(contact_phone) => setCustomerForm({ ...customerForm, contact_phone })}/></fieldset>}
    {canEdit && <PendingButton type="button" pending={customerBusy} pendingLabel="Saving customer..." disabled={actions.isBusy() && !customerBusy} onClick={saveCustomer} className="mt-4 h-9 rounded-md bg-ink-soft px-3 text-xs font-bold text-white disabled:opacity-50">Save customer details</PendingButton>}

    <section className="mt-7 border-t border-black/8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><SectionTitle title={readOnly ? "Shipment history" : "Shipment desk"} copy={readOnly ? "Commercial shipment records are visible here for context. Their creation, editing, and status changes happen in Sales Workspace." : "Create and edit commercial shipment records here. Set the initial status in the form, then use the table dropdown for later updates."}/>{canEdit && <button type="button" onClick={() => { setShowNewShipment((value) => !value); setSelectedShipmentId(null); }} className="h-9 cursor-pointer rounded-md border border-black/10 px-3 text-xs font-bold transition hover:border-brand hover:bg-brand-tint">{showNewShipment ? "Close shipment form" : data.shipments.length ? "Add another shipment" : "Add shipment"}</button>}</div>
      {(showNewShipment || !data.shipments.length) && canEdit && <div className="mt-4 rounded-md border border-brand/35 bg-[#fffaf1] p-4"><SalesShipmentForm customerId={customerId} api={api} report={report} onSaved={() => { setShowNewShipment(false); reload(); }}/></div>}
      <div className="mt-4 overflow-hidden rounded-md border border-black/8"><div className="grid grid-cols-[1.2fr_.9fr_.7fr] gap-3 border-b border-black/8 bg-black/[.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] text-black/45"><span>Shipment</span><span>Status</span><span>Rate</span></div>{data.shipments.length ? data.shipments.map((shipment: any) => { const quote = quotesById.get(shipment.quote_id); const canSubmit = canEdit && quote && ["DRAFT", "REJECTED"].includes(quote.stage); return <div key={shipment.id} className={`grid grid-cols-[1.2fr_.9fr_.7fr] gap-3 px-3 py-3 text-left text-xs transition ${selectedShipmentId === shipment.id ? "bg-brand-tint" : "hover:bg-black/[.025]"}`}><button type="button" onClick={() => { setSelectedShipmentId(shipment.id); setShowNewShipment(false); }} className="min-w-0 cursor-pointer text-left"><b className="block truncate">{shipment.reference_number}</b><span className="mt-1 block truncate text-black/50">{shipment.pickup_location} to {shipment.delivery_location}</span></button><div>{canEdit ? <select aria-label={`Update status for ${shipment.reference_number}`} disabled={actions.isBusy("shipment-status:" + shipment.id)} value={shipment.sales_status ?? shipment.status} onChange={(event) => updateShipmentStatus(shipment, event.target.value)} className="h-8 cursor-pointer rounded-md border border-black/10 bg-white px-2 text-[10px] font-bold text-brand-deep disabled:cursor-wait disabled:opacity-55"><option>QUOTED</option><option>BOOKED</option><option>DELIVERED</option><option>PAID</option></select> : <span className="font-bold text-brand-deep">{shipment.sales_status ?? shipment.status}</span>}{canSubmit && <PendingButton type="button" pending={actions.isBusy("shipment-review:" + shipment.id)} pendingLabel="Submitting..." onClick={() => submitShipmentForReview(shipment)} className="mt-2 h-7 rounded-md border border-black/10 px-2 text-[9px] font-bold hover:bg-black/[.03]">Submit review</PendingButton>}{quote?.stage === "SUBMITTED" && <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-amber-700">Awaiting review</p>}{quote?.stage === "APPROVED" && <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Approved</p>}</div><div><span className="block">{money(shipment.amount_quoted)}</span>{shipment.amount_agreed != null && <span className="mt-1 block text-black/45">Agreed {money(shipment.amount_agreed)}</span>}</div></div>; }) : <p className="p-5 text-sm text-black/45">No commercial shipments have been added yet.</p>}</div>
      {selectedShipment && <div className="mt-4 rounded-md border border-black/8 bg-white p-4">{canEdit ? <SalesShipmentForm customerId={customerId} shipment={selectedShipment} api={api} report={report} onSaved={reload} onClose={() => setSelectedShipmentId(null)}/> : <div><p className="text-xs font-bold">Commercial shipment details</p><p className="mt-2 text-sm">{selectedShipment.pickup_location} to {selectedShipment.delivery_location}</p><p className="mt-1 text-xs text-black/50">{selectedShipment.sales_status ?? selectedShipment.status} · {money(selectedShipment.amount_quoted)}</p></div>}</div>}
    </section>

    <section className="mt-7 grid gap-6 border-t border-black/8 pt-6 xl:grid-cols-2"><div><SectionTitle title="Follow-up history" copy={readOnly ? "A historical view of customer activity. Add or manage follow-ups from Sales Workspace." : "Pending items need attention; completed items are retained as the customer history."}/><Timeline rows={data.activities ?? []} empty="No customer follow-ups have been recorded." onComplete={canEdit ? updateActivity : undefined} onDelete={canEdit ? deleteActivity : undefined} busy={actions.isBusy}/></div><div><SectionTitle title="Customer notes" copy={readOnly ? "A historical view of Sales notes. Add or manage notes from Sales Workspace." : "Keep account context visible to everyone with access to this customer."}/>{canEdit && <form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2"><input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add customer comment" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/><PendingButton pending={commentBusy} pendingLabel="Posting..." disabled={actions.isBusy() && !commentBusy} className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton></form>}<CommentList rows={data.comments} empty="No customer comments yet." onDelete={canEdit ? removeComment : undefined} busy={actions.isBusy}/></div></section>
  </section>;
}

export function SalesShipmentForm({ customerId, shipment, api, report, onSaved, onClose }: { customerId: string; shipment?: any; api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void; onSaved: () => void; onClose?: () => void }) {
  const [form, setForm] = useState({ reference_number: "", pickup_location: "", delivery_location: "", equipment_type: "", quoted_rate: "", agreed_rate: "", pickup_date: "", delivery_date: "", status: "QUOTED" });
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const actions = useSingleFlight();
  useEffect(() => { setForm({ reference_number: shipment?.reference_number ?? "", pickup_location: shipment?.pickup_location ?? "", delivery_location: shipment?.delivery_location ?? "", equipment_type: shipment?.equipment_type ?? "", quoted_rate: shipment?.amount_quoted ?? "", agreed_rate: shipment?.amount_agreed ?? "", pickup_date: shipment?.pickup_date ?? "", delivery_date: shipment?.delivery_date ?? "", status: shipment?.sales_status ?? "QUOTED" }); }, [shipment?.id]);
  const save = () => void actions.run("shipment", async () => {
    try {
      const body = { ...form, equipment_type: form.equipment_type || null, quoted_rate: form.quoted_rate === "" ? null : Number(form.quoted_rate), agreed_rate: form.agreed_rate === "" ? null : Number(form.agreed_rate), pickup_date: form.pickup_date || null, delivery_date: form.delivery_date || null };
      const path = shipment ? "/api/v1/brokerage/sales-shipments/" + shipment.id : "/api/v1/brokerage/customers/" + customerId + "/shipments";
      const result = await responseData<any>(await api(path, { method: shipment ? "PATCH" : "POST", body: JSON.stringify(body) }));
      const quoteId = shipment?.quote_id ?? result?.shipment?.quote_id;
      if (supportingFile) {
        if (!quoteId) throw new Error("The linked quote was not available for this shipment.");
        const signed = await responseData<any>(await api("/api/v1/brokerage/quotes/" + quoteId + "/upload-url", { method: "POST", body: JSON.stringify({ file_name: supportingFile.name, content_type: supportingFile.type }) }));
        const uploaded = await fetch(signed.signed_url, { method: "PUT", headers: { "Content-Type": supportingFile.type }, body: supportingFile });
        if (!uploaded.ok) throw new Error("Supporting document upload failed.");
        await responseData(await api("/api/v1/brokerage/quotes/" + quoteId + "/attachments", { method: "POST", body: JSON.stringify({ file_name: supportingFile.name, storage_path: signed.path }) }));
      }
      onSaved();
      report(supportingFile ? "Shipment and supporting document saved." : shipment ? "Customer shipment saved." : "Customer shipment added.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const busy = actions.isBusy("shipment");
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{shipment ? "Edit commercial shipment" : "New commercial shipment"}</p><p className="mt-1 text-xs text-black/45">The shipment holds the commercial fields. A linked quote record is created automatically for the Manager approval workflow.</p></div>{onClose && <button type="button" onClick={onClose} className="cursor-pointer text-xs font-bold text-black/50 hover:text-black">Close</button>}</div><fieldset disabled={busy} className="mt-4 grid gap-3 disabled:opacity-55 sm:grid-cols-2"><Input light label="Reference number" value={form.reference_number} onChange={(reference_number) => setForm({ ...form, reference_number })}/><Input light label="Pickup" value={form.pickup_location} onChange={(pickup_location) => setForm({ ...form, pickup_location })}/><Input light label="Delivery" value={form.delivery_location} onChange={(delivery_location) => setForm({ ...form, delivery_location })}/><Input light label="Equipment" required={false} value={form.equipment_type} onChange={(equipment_type) => setForm({ ...form, equipment_type })}/><Input light label="Quoted rate" required={false} type="number" value={String(form.quoted_rate)} onChange={(quoted_rate) => setForm({ ...form, quoted_rate })}/><Input light label="Agreed rate" required={false} type="number" value={String(form.agreed_rate)} onChange={(agreed_rate) => setForm({ ...form, agreed_rate })}/><Input light label="Pickup date" required={false} type="date" value={form.pickup_date} onChange={(pickup_date) => setForm({ ...form, pickup_date })}/><Input light label="Delivery date" required={false} type="date" value={form.delivery_date} onChange={(delivery_date) => setForm({ ...form, delivery_date })}/><label className="grid gap-1 text-xs font-semibold text-black/65"><span>Commercial status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"><option>QUOTED</option><option>BOOKED</option><option>DELIVERED</option><option>PAID</option></select></label><label className="grid gap-1 text-xs font-semibold text-black/65 sm:col-span-2"><span>Supporting document <em className="font-normal text-black/40">optional, PDF or image</em></span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setSupportingFile(event.target.files?.[0] ?? null)} className="block h-10 w-full cursor-pointer rounded-md border border-black/10 bg-white px-3 py-2 text-xs file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-bold"/>{supportingFile && <span className="text-[11px] font-medium text-brand-deep">{supportingFile.name} will upload when you save this shipment.</span>}</label></fieldset><PendingButton type="button" pending={busy} pendingLabel={shipment ? "Saving shipment..." : "Adding shipment..."} onClick={save} className="mt-4 h-9 rounded-md bg-ink-soft px-3 text-xs font-bold text-white disabled:opacity-50">{shipment ? "Save shipment details" : "Add shipment"}</PendingButton></div>;
}

export function CustomerDirectory({ api, report }: { api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void }) {
  const customers = useQuery({ queryKey: ["brokerage", "customers"], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/customers")), staleTime: 20_000 });
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => { if (!selectedCustomer && customers.data?.customers?.[0]?.id) setSelectedCustomer(customers.data.customers[0].id); }, [customers.data, selectedCustomer]);
  if (customers.isLoading) return <DetailSkeleton/>;
  if (customers.isError || !customers.data) return <Empty title="Customers unavailable" copy={message(customers.error)}/>;
  const filtered = customers.data.customers.filter((customer: any) => `${customer.company_name} ${customer.contact_name ?? ""} ${customer.contact_email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 p-4"><p className="font-semibold">Customer directory</p><p className="mt-1 text-xs text-black/45">Only customers in your permitted Sales scope appear here.</p><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" className="mt-4 h-10 w-full rounded-md border border-black/10 px-3 text-sm"/></div><div className="max-h-[680px] divide-y divide-black/6 overflow-auto">{filtered.map((customer: any) => <button key={customer.id} type="button" onClick={() => setSelectedCustomer(customer.id)} className={`w-full px-4 py-4 text-left transition ${selectedCustomer === customer.id ? "bg-brand-tint" : "hover:bg-black/[.025]"}`}><p className="text-sm font-semibold">{customer.company_name}</p><p className="mt-1 truncate text-xs text-black/50">{customer.contact_name || "No contact"}{customer.contact_email ? ` · ${customer.contact_email}` : ""}</p></button>)}{!filtered.length && <p className="p-6 text-sm text-black/45">No customers match this search.</p>}</div></aside><div>{selectedCustomer ? <CustomerWorkspace customerId={selectedCustomer} api={api} report={report} readOnly/> : <Empty title="Select a customer" copy="Choose a customer to view their contact record, shipment history, follow-ups, and notes. Make changes from Sales Workspace."/>}</div></div>;
}
