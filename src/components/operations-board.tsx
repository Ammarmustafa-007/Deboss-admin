"use client";

import { Download, FileCheck2, FileUp, LoaderCircle, MessageSquare, ShieldAlert, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const root = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const shipmentStatuses = ["BOOKED", "CARRIER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "EXCEPTION"];

export function OperationsBoard({ initialWorkspace }: { embedded?: boolean; initialWorkspace?: any }) {
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<any>(initialWorkspace);
  const [directory, setDirectory] = useState<any>({ users: [], teams: [] });
  const [selected, setSelected] = useState<any>();
  const [detail, setDetail] = useState<any>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const api = async (path: string, init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(`${root}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  };
  const json = async (response: Response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
    return body;
  };
  const refresh = async () => {
    const current = await json(await api("/api/v1/brokerage/workspace"));
    setWorkspace(current);
    if (current.capabilities?.departmentManager) {
      const response = await api("/api/v1/brokerage/operations-directory");
      if (response.ok) setDirectory(await response.json());
    }
  };
  const open = async (shipment: any) => {
    setSelected(shipment);
    setDetail(undefined);
    try { setDetail(await json(await api(`/api/v1/brokerage/shipments/${shipment.id}/detail`))); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Shipment detail could not be loaded."); }
  };
  useEffect(() => { void refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Workspace could not be loaded.")); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3600); return () => window.clearTimeout(timer); }, [notice]);

  const patch = async (shipment: any, body: unknown, success: string) => {
    if (busy) return;
    setBusy(shipment.id);
    try {
      await json(await api(`/api/v1/brokerage/shipments/${shipment.id}`, { method: "PATCH", body: JSON.stringify(body) }));
      setNotice(success);
      await refresh();
      await open({ ...shipment, ...(body as object) });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Update failed."); }
    finally { setBusy(""); }
  };

  if (!workspace) return <div className="grid min-h-[380px] place-items-center"><LoaderCircle className="animate-spin text-[#f59a18]"/></div>;
  const caps = workspace.capabilities ?? {};
  const manager = Boolean(caps.departmentManager);
  return <main className="text-[#191816]"><div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Brokerage Operations</p><h2 className="mt-2 text-3xl font-semibold">Execution board</h2></div><Truck className="text-[#f59a18]"/></div>{notice && <p role="status" className="mt-5 rounded-md border border-[#f59a18]/30 bg-[#fff1dc] px-4 py-3 text-sm text-[#7c4400]">{notice}</p>}
    {!workspace.shipments?.length ? <EmptyQueue manager={manager}/> : <div className="mt-7 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]"><section className="space-y-3">{workspace.shipments.map((shipment: any) => <article key={shipment.id} className={`rounded-lg border bg-white p-4 ${selected?.id === shipment.id ? "border-[#f59a18]" : "border-black/8"}`}><button onClick={() => void open(shipment)} className="w-full text-left"><b>{shipment.reference_number} · {shipment.customer_name}</b><p className="mt-1 text-xs text-black/50">{shipment.pickup_location} to {shipment.delivery_location}</p></button><div className="mt-3 flex flex-wrap gap-2"><select disabled={busy === shipment.id} value={shipment.status} onChange={(event) => void patch(shipment, { status: event.target.value }, "Shipment status updated.")} className="h-9 rounded-md border border-black/10 bg-white px-2 text-xs font-bold">{shipmentStatuses.map((status) => <option key={status}>{status}</option>)}</select>{manager && <><select disabled={busy === shipment.id} value={shipment.assigned_to ?? ""} onChange={(event) => void patch(shipment, { assigned_to: event.target.value || null }, "Shipment assignment updated.")} className="h-9 max-w-full rounded-md border border-black/10 bg-white px-2 text-xs"><option value="">Assign Agent</option>{directory.users.map((user: any) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select><select disabled={busy === shipment.id} value={shipment.team_id ?? ""} onChange={(event) => void patch(shipment, { team_id: event.target.value || null }, "Team assignment updated.")} className="h-9 max-w-full rounded-md border border-black/10 bg-white px-2 text-xs"><option value="">Assign Team</option>{directory.teams.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></>}</div></article>)}</section><section className="min-w-0 rounded-lg border border-black/8 bg-white p-5">{detail ? <ShipmentDetail detail={detail} caps={caps} manager={manager} api={api} patch={patch} refresh={() => void open(selected)} notice={setNotice}/> : <p className="p-8 text-center text-sm text-black/50">Select an assigned shipment to update its progress, paperwork, finance entries, and shipment notes.</p>}</section></div>}</main>;
}

function EmptyQueue({ manager }: { manager: boolean }) {
  return <section className="mt-7 rounded-lg border border-black/8 bg-white p-8"><Truck className="text-[#f59a18]" size={24}/><h3 className="mt-4 text-xl font-semibold">{manager ? "No Operations shipments to assign yet." : "No shipment is assigned to you yet."}</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">{manager ? "Approved Sales quotes appear here after they are handed to Brokerage Operations. Assign a shipment to an Agent or a team from this board once it arrives." : "Your normal Agent controls are ready automatically. When Sales hands a booked shipment to Operations and your manager assigns it to you, it will appear here with status updates, financial entries, paperwork, comments, and exception reporting."}</p></section>;
}

function ShipmentDetail({ detail, caps, manager, api, patch, refresh, notice }: any) {
  if (manager) return <ManagerShipmentReview detail={detail} caps={caps} api={api} patch={patch} refresh={refresh} notice={notice}/>;
  return <AgentShipmentExecution detail={detail} caps={caps} manager={false} api={api} patch={patch} refresh={refresh} notice={notice}/>;
}

function ManagerShipmentReview({ detail, caps, api, patch, refresh, notice }: any) {
  const shipment = detail.shipment;
  const pendingDocuments = (detail.documents ?? []).filter((document: any) => !document.is_verified).length;
  const exceptionOpen = Boolean(shipment.exception_note && !shipment.exception_resolution);
  return <div><section className="mb-6 rounded-lg bg-[#191816] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Operations manager review</p><div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-semibold">Control this shipment through execution.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Assign the work from the left-hand queue, monitor the Agent's updates below, review paperwork, resolve exceptions, and mark the shipment invoice-ready when it is complete.</p></div><span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[#f59a18]">{shipment.status.replaceAll("_", " ")}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><ManagerStatus label="Assignment" value={shipment.assigned_to ? "Assigned" : "Needs assignment"}/><ManagerStatus label="Documents" value={pendingDocuments ? `${pendingDocuments} pending review` : "No pending review"}/><ManagerStatus label="Exception" value={exceptionOpen ? "Needs resolution" : "No open exception"}/></div><p className="mt-5 text-xs leading-5 text-white/45">Manager controls are available throughout the record below: assignment in the queue, document verification in shipment paperwork, exception resolution in the exception workspace, and invoice readiness in shipment finance.</p></section><AgentShipmentExecution detail={detail} caps={caps} manager api={api} patch={patch} refresh={refresh} notice={notice}/></div>;
}

function ManagerStatus({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-sm font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{label}</p></div>; }

function AgentShipmentExecution({ detail, caps, manager, api, patch, refresh, notice }: any) {
  const shipment = detail.shipment;
  const [form, setForm] = useState<any>({});
  const [documentType, setDocumentType] = useState("BOL");
  const [reviewNote, setReviewNote] = useState("");
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => setForm({ carrier_name: shipment.carrier_name ?? "", pickup_date: shipment.pickup_date ?? "", delivery_date: shipment.delivery_date ?? "", amount_quoted: shipment.amount_quoted ?? "", amount_invoiced: shipment.amount_invoiced ?? "", amount_paid: shipment.amount_paid ?? "", payment_status: shipment.payment_status ?? "DRAFT", exception_note: shipment.exception_note ?? "", exception_resolution: shipment.exception_resolution ?? "", invoice_ready: Boolean(shipment.invoice_ready) }), [shipment]);
  const request = async (path: string, init?: RequestInit) => { const response = await api(path, init); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "The request could not be completed."); return body; };
  const number = (value: unknown) => value === "" || value === null ? null : Number(value);
  const saveFinance = () => void patch(shipment, { carrier_name: form.carrier_name || null, pickup_date: form.pickup_date || null, delivery_date: form.delivery_date || null, amount_quoted: number(form.amount_quoted), amount_invoiced: number(form.amount_invoiced), amount_paid: number(form.amount_paid), payment_status: form.payment_status, ...(caps.canMarkInvoiceReady ? { invoice_ready: Boolean(form.invoice_ready) } : {}) }, "Shipment finance updated.");
  const saveException = () => void patch(shipment, caps.canResolveExceptions ? { exception_note: form.exception_note || null, exception_resolution: form.exception_resolution || null, status: form.exception_note ? "EXCEPTION" : shipment.status } : { exception_note: form.exception_note || null, status: form.exception_note ? "EXCEPTION" : shipment.status }, caps.canResolveExceptions ? "Exception updated." : "Exception reported to your manager.");
  const upload = async (file: File) => { setUploading(true); try { const signed = await request(`/api/v1/brokerage/shipments/${shipment.id}/upload-url`, { method: "POST", body: JSON.stringify({ file_name: file.name, content_type: file.type }) }); const put = await fetch(signed.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!put.ok) throw new Error("Document upload failed."); await request(`/api/v1/brokerage/shipments/${shipment.id}/documents`, { method: "POST", body: JSON.stringify({ document_type: documentType, storage_path: signed.path }) }); notice("Document uploaded."); refresh(); } catch (error) { notice(error instanceof Error ? error.message : "Document upload failed."); } finally { setUploading(false); } };
  const addComment = async () => { if (!comment.trim()) return; try { await request(`/api/v1/brokerage/shipments/${shipment.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); notice("Shipment comment added."); refresh(); } catch (error) { notice(error instanceof Error ? error.message : "Comment could not be added."); } };
  const review = async (document: any, is_verified: boolean) => { try { await request(`/api/v1/brokerage/documents/${document.id}/review`, { method: "PATCH", body: JSON.stringify({ is_verified, review_note: reviewNote || null }) }); setReviewNote(""); notice(is_verified ? "Document verified." : "Document returned for changes."); refresh(); } catch (error) { notice(error instanceof Error ? error.message : "Document review failed."); } };
  const download = async (document: any) => { try { const result = await request(`/api/v1/brokerage/documents/${document.id}/download-url`); window.open(result.signed_url, "_blank", "noopener,noreferrer"); } catch (error) { notice(error instanceof Error ? error.message : "Document could not be opened."); } };
  return <div><header className="border-b border-black/8 pb-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Assigned shipment</p><h3 className="mt-1 text-xl font-semibold">{shipment.reference_number}</h3><p className="mt-1 text-sm text-black/50">{shipment.customer_name} · {shipment.pickup_location} to {shipment.delivery_location}</p></header>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><section><h4 className="font-semibold">Shipment finance and dates</h4><p className="mt-1 text-xs text-black/45">Agents record operational and financial facts for their assigned shipments.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Carrier" value={form.carrier_name ?? ""} onChange={(carrier_name) => setForm({ ...form, carrier_name })}/><Field label="Pickup date" type="date" value={form.pickup_date ?? ""} onChange={(pickup_date) => setForm({ ...form, pickup_date })}/><Field label="Delivery date" type="date" value={form.delivery_date ?? ""} onChange={(delivery_date) => setForm({ ...form, delivery_date })}/><label className="text-xs font-bold text-black/55">Payment status<select value={form.payment_status ?? "DRAFT"} onChange={(event) => setForm({ ...form, payment_status: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm">{["DRAFT", "SENT", "PENDING", "PAID", "OVERDUE", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></label><Field label="Quoted amount" type="number" value={String(form.amount_quoted ?? "")} onChange={(amount_quoted) => setForm({ ...form, amount_quoted })}/><Field label="Invoiced amount" type="number" value={String(form.amount_invoiced ?? "")} onChange={(amount_invoiced) => setForm({ ...form, amount_invoiced })}/><Field label="Paid amount" type="number" value={String(form.amount_paid ?? "")} onChange={(amount_paid) => setForm({ ...form, amount_paid })}/>{caps.canMarkInvoiceReady && <label className="mt-7 flex items-center gap-2 text-xs font-bold text-black/60"><input type="checkbox" checked={Boolean(form.invoice_ready)} onChange={(event) => setForm({ ...form, invoice_ready: event.target.checked })}/> Mark invoice-ready</label>}</div><button onClick={saveFinance} className="mt-4 h-9 rounded-md bg-[#191816] px-3 text-xs font-bold text-white">Save shipment details</button></section>
      <section><h4 className="flex items-center gap-2 font-semibold"><ShieldAlert size={16}/>Exception workspace</h4><p className="mt-1 text-xs text-black/45">{caps.canResolveExceptions ? "Update the issue and its resolution." : "Report an issue immediately; your manager or delegated Team Lead resolves it."}</p><label className="mt-4 block text-xs font-bold text-black/55">Exception detail<textarea value={form.exception_note ?? ""} onChange={(event) => setForm({ ...form, exception_note: event.target.value })} className="mt-2 min-h-20 w-full rounded-md border border-black/10 p-3 text-sm"/></label>{caps.canResolveExceptions && <label className="mt-3 block text-xs font-bold text-black/55">Resolution note<textarea value={form.exception_resolution ?? ""} onChange={(event) => setForm({ ...form, exception_resolution: event.target.value })} className="mt-2 min-h-20 w-full rounded-md border border-black/10 p-3 text-sm"/></label>}<button onClick={saveException} className="mt-3 h-9 rounded-md border border-black/10 px-3 text-xs font-bold">{caps.canResolveExceptions ? "Save exception" : "Report exception"}</button><div className="mt-4 space-y-2">{detail.events.filter((event: any) => event.event_type.includes("EXCEPTION")).map((event: any) => <p key={event.id} className="rounded-md bg-black/[.035] p-3 text-xs text-black/60">{event.event_type.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString()}{event.body ? ` · ${event.body}` : ""}</p>)}</div></section></div>
    <section className="mt-7 border-t border-black/8 pt-5"><h4 className="font-semibold">Shipment paperwork</h4><div className="mt-3 flex flex-wrap gap-2"><select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-10 rounded-md border border-black/10 bg-white px-3 text-xs"><option>BOL</option><option>POD</option><option>RATE_CONFIRMATION</option><option>INVOICE</option><option>OTHER</option></select><label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-black/20 px-3 text-xs font-bold"><FileUp size={15}/>{uploading ? "Uploading..." : "Upload PDF or image"}<input className="hidden" disabled={uploading} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/></label></div>{caps.canReviewDocuments && <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Verification or rejection note" className="mt-3 min-h-16 w-full rounded-md border border-black/10 p-3 text-sm"/>}<div className="mt-3 space-y-2">{detail.documents.map((document: any) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/[.035] p-3 text-xs"><span>{document.document_type} · {document.is_verified ? "Verified" : "Pending"}{document.review_note ? ` · ${document.review_note}` : ""}</span><div className="flex gap-2"><button onClick={() => void download(document)} className="flex items-center gap-1 font-bold"><Download size={13}/>Open</button>{caps.canReviewDocuments && <button onClick={() => void review(document, !document.is_verified)} className="flex items-center gap-1 font-bold"><FileCheck2 size={13}/>{document.is_verified ? "Return" : "Verify"}</button>}</div></div>)}</div></section>
    <section className="mt-7 grid gap-5 border-t border-black/8 pt-5 xl:grid-cols-2"><div><h4 className="flex items-center gap-2 font-semibold"><MessageSquare size={16}/>Shipment comments</h4><div className="mt-3 flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add internal comment" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm"/><button onClick={() => void addComment()} className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold">Post</button></div>{detail.comments.map((item: any) => <p key={item.id} className="mt-2 rounded-md bg-black/[.035] p-3 text-xs">{item.body}</p>)}</div><div><h4 className="font-semibold">Event timeline</h4><div className="mt-3 max-h-48 space-y-2 overflow-auto">{detail.events.map((event: any) => <div key={event.id} className="rounded-md bg-black/[.035] p-3 text-xs"><b>{event.event_type.replaceAll("_", " ")}</b><p className="mt-1 text-black/45">{new Date(event.created_at).toLocaleString()}</p></div>)}</div></div></section>
  </div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-bold text-black/55">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-black/10 px-3 text-sm"/></label>;
}
