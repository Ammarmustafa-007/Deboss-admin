"use client";

import { FileText, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PendingButton, useSingleFlight } from "@/components/action-state";
import { responseData } from "@/lib/api";
import { CustomerWorkspace } from "@/components/brokerage/customers";
import { CommentList, Empty, Info, Input, SectionTitle, Timeline, DetailSkeleton, editableStages, localInput, message, money, stageCopy } from "@/components/brokerage/shared";

export function SalesWorkspace({ data, api, refresh, report, onOpenCustomers }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers: () => void }) {
  if (data.capabilities?.departmentManager) return <SalesManagerWorkspace data={data} api={api} refresh={refresh} report={report}/>;
  return <SalesAgentWorkspace data={data} api={api} refresh={refresh} report={report} onOpenCustomers={onOpenCustomers}/>;
}

export function SalesManagerWorkspace({ data, api, refresh, report }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const [selectedLead, setSelectedLead] = useState<string | null>(data.leads?.[0]?.id ?? null);
  const leads = data.leads ?? [];
  const quotes = data.quotes ?? [];
  const submitted = quotes.filter((quote: any) => quote.stage === "SUBMITTED");
  const approved = quotes.filter((quote: any) => quote.stage === "APPROVED");
  const customers = leads.filter((lead: any) => lead.stage === "CUSTOMER");
  return <div className="space-y-5"><section className="rounded-lg bg-ink-soft p-6 text-white"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-brand">Sales manager command view</p><h2 className="mt-2 text-2xl font-semibold">Review the department with a clear decision queue.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Pipeline stage describes the customer relationship. Manager action describes whether a quote needs review, has been returned for rework, or is ready to hand off to Brokerage Operations.</p></div><div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-right"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/45">Approval queue</p><p className="mt-1 text-2xl font-semibold text-brand">{submitted.length}</p><p className="text-xs text-white/50">agent-submitted quotes awaiting a decision</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ManagerMetric label="Department leads" value={leads.length}/><ManagerMetric label="Customers" value={customers.length}/><ManagerMetric label="Review required" value={submitted.length}/><ManagerMetric label="Ready for Operations" value={approved.length}/></div></section><div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-4 py-4"><p className="font-semibold">Department pipeline</p><p className="mt-1 text-xs leading-5 text-black/45">Each row shows both the relationship stage and the exact action, if any, required from you. Select a record to open its full review file.</p></div><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-black/8 bg-black/[.025] px-4 py-2 text-[9px] font-bold uppercase tracking-[.1em] text-black/45"><span>Lead</span><span>Manager action</span></div><div className="max-h-[720px] divide-y divide-black/6 overflow-auto">{leads.map((lead: any) => { const state = managerLeadState(quotes.filter((quote: any) => quote.lead_id === lead.id)); return <button key={lead.id} onClick={() => setSelectedLead(lead.id)} className={`w-full px-4 py-4 text-left transition ${selectedLead === lead.id ? "bg-brand-tint" : "hover:bg-black/[.025]"}`}><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{lead.company_name}</p><p className="mt-1 truncate text-xs text-black/50">{lead.contact_name || "No contact name"}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-black/40">Pipeline: {lead.stage}</p></div><div className="max-w-32 text-right"><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${state.tone}`}>{state.label}</span><p className="mt-2 text-[10px] leading-4 text-black/48">{state.copy}</p></div></div></button>; })}{!leads.length && <p className="p-7 text-sm text-black/45">No Sales leads exist in this department yet.</p>}</div></aside><section className="min-w-0 rounded-lg border border-black/8 bg-white">{selectedLead ? <LeadDetail leadId={selectedLead} data={data} api={api} refresh={refresh} report={report}/> : <Empty title="Select a department lead" copy="Choose a lead to open its complete commercial record and manager decision controls."/>}</section></div></div>;
}

export function managerLeadState(quotes: any[]) {
  if (quotes.some((quote) => quote.stage === "SUBMITTED")) return { label: "REVIEW REQUIRED", copy: "Agent submitted a quote for approval.", tone: "bg-amber-100 text-amber-800" };
  if (quotes.some((quote) => quote.stage === "APPROVED")) return { label: "HANDOFF REQUIRED", copy: "Approved quote is ready for Operations.", tone: "bg-emerald-100 text-emerald-800" };
  if (quotes.some((quote) => quote.stage === "REJECTED")) return { label: "AGENT REWORK", copy: "Waiting for the agent to revise and resubmit.", tone: "bg-red-50 text-red-700" };
  if (quotes.some((quote) => quote.stage === "HANDED_OFF")) return { label: "WITH OPERATIONS", copy: "The approved work has been handed off.", tone: "bg-sky-50 text-sky-700" };
  if (quotes.some((quote) => quote.stage === "DRAFT")) return { label: "AGENT DRAFT", copy: "The agent has not submitted this quote yet.", tone: "bg-black/[.05] text-black/60" };
  return { label: "NO MANAGER ACTION", copy: "No quote has been submitted yet.", tone: "bg-black/[.05] text-black/60" };
}

export function ManagerMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{label}</p></div>; }

export function SalesAgentWorkspace({ data, api, refresh, report, onOpenCustomers }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers: () => void }) {
  const [selectedLead, setSelectedLead] = useState<string | null>(data.leads?.[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" });
  const createLead = async (event: FormEvent) => { event.preventDefault(); if (creating) return; setCreating(true); try { await responseData(await api("/api/v1/brokerage/leads", { method: "POST", body: JSON.stringify({ ...form, estimated_monthly_value: form.estimated_monthly_value ? Number(form.estimated_monthly_value) : undefined, next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : undefined }) })); setForm({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" }); await refresh(); report("Lead created and added to the pipeline."); } catch (error) { report(message(error), "error"); } finally { setCreating(false); } };
  return <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className="space-y-5"><form onSubmit={createLead} className="rounded-lg bg-ink-soft p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-brand">New customer lead</p><h2 className="mt-2 text-xl font-semibold">Build the pipeline.</h2><fieldset disabled={creating} className="mt-5 space-y-3 disabled:opacity-55"><Input label="Company name" value={form.company_name} onChange={(company_name) => setForm({ ...form, company_name })}/><Input label="Contact name" value={form.contact_name} onChange={(contact_name) => setForm({ ...form, contact_name })}/><Input label="Contact email" type="email" required={false} value={form.contact_email} onChange={(contact_email) => setForm({ ...form, contact_email })}/><Input label="Phone" required={false} value={form.contact_phone} onChange={(contact_phone) => setForm({ ...form, contact_phone })}/><Input label="Source" required={false} value={form.source} onChange={(source) => setForm({ ...form, source })}/><Input label="Estimated monthly value" required={false} type="number" value={form.estimated_monthly_value} onChange={(estimated_monthly_value) => setForm({ ...form, estimated_monthly_value })}/><Input label="Next follow-up" required={false} type="datetime-local" value={form.next_follow_up_at} onChange={(next_follow_up_at) => setForm({ ...form, next_follow_up_at })}/><button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-black">{creating && <LoaderCircle size={15} className="animate-spin"/>}{creating ? "Creating lead..." : "Create lead"}</button></fieldset></form><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-4 py-3"><p className="text-sm font-semibold">Pipeline</p><p className="mt-1 text-xs text-black/45">Select a lead to manage its customer journey.</p></div><div className="max-h-[650px] divide-y divide-black/6 overflow-auto">{(data.leads ?? []).map((lead: any) => <button key={lead.id} onClick={() => setSelectedLead(lead.id)} className={`w-full px-4 py-4 text-left transition ${selectedLead === lead.id ? "bg-brand-tint" : "hover:bg-black/[.025]"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{lead.company_name}</p><span className="rounded-md bg-black/[.05] px-2 py-1 text-[9px] font-bold tracking-wide">{lead.stage}</span></div><p className="mt-1 truncate text-xs text-black/50">{lead.contact_name || "No contact name"}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.12em] text-brand-deep">{lead.next_follow_up_at ? `Follow-up ${new Date(lead.next_follow_up_at).toLocaleDateString()}` : "No follow-up set"}</p></button>)}{!(data.leads ?? []).length && <p className="p-7 text-sm text-black/45">No leads in your current scope.</p>}</div></div></aside><section className="min-w-0 rounded-lg border border-black/8 bg-white">{selectedLead ? <LeadDetail leadId={selectedLead} data={data} api={api} refresh={refresh} report={report} onOpenCustomers={onOpenCustomers}/> : <Empty title="Select a lead" copy="Choose a pipeline record to update its details, record activities, and manage converted customers from the Customer workspace."/>}</section></div>;
}

export function ManagerLeadReview({ leadId, data, api, refresh, report }: { leadId: string; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const actions = useSingleFlight();
  const detail = useQuery({ queryKey: ["brokerage", "lead", leadId], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/leads/" + leadId + "/detail")), staleTime: 15_000 });
  const refreshLead = async () => {
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "lead", leadId] });
    void refresh();
  };
  const act = async (path: string, method: string, body: unknown, success: string) => {
    const result = await actions.run(method + ":" + path, async () => {
      try {
        await responseData(await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
        await refreshLead();
        report(success);
        return true;
      } catch (error) {
        report(message(error), "error");
        return false;
      }
    });
    return result === true;
  };

  if (detail.isLoading) return <DetailSkeleton/>;
  if (detail.isError || !detail.data) return <Empty title="Lead review unavailable" copy={message(detail.error)}/>;

  const lead = detail.data.lead;
  const leadPath = "/api/v1/brokerage/leads/" + lead.id;
  const leadBusy = actions.isBusy("PATCH:" + leadPath);
  const commentBusy = actions.isBusy("POST:" + leadPath + "/comments");
  const quotes = detail.data.quotes ?? [];
  const submitted = quotes.filter((quote: any) => quote.stage === "SUBMITTED").length;
  const approved = quotes.filter((quote: any) => quote.stage === "APPROVED").length;
  const handedOff = quotes.filter((quote: any) => quote.stage === "HANDED_OFF").length;
  const postComment = () => void (async () => {
    if (!comment.trim()) return;
    if (await act(leadPath + "/comments", "POST", { body: comment }, "Manager comment added.")) setComment("");
  })();
  const deleteComment = (commentId: string) => void act("/api/v1/brokerage/comments/" + commentId, "DELETE", undefined, "Comment deleted.");

  return <div>
    <header className="border-b border-black/8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-brand-deep">Manager review workspace</p><h2 className="mt-1 text-2xl font-semibold">{lead.company_name}</h2><p className="mt-2 text-sm text-black/50">{lead.contact_name || "No contact name"}{lead.contact_email && <>{ " · " }{lead.contact_email}</>}</p></div>
        <div className="flex items-center gap-2">
          <span title={stageCopy[lead.stage]} className="rounded-md bg-black/[.05] px-3 py-2 text-[10px] font-bold tracking-[.12em] text-black/60">PIPELINE · {lead.stage}</span>
          <PendingButton type="button" pending={leadBusy} pendingLabel="Saving..." onClick={() => void act(leadPath, "PATCH", { archived_at: lead.archived_at ? null : new Date().toISOString() }, lead.archived_at ? "Lead restored." : "Lead archived.")} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">{lead.archived_at ? "Restore" : "Archive"}</PendingButton>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><ReviewMetric label="Awaiting quote approval" value={submitted}/><ReviewMetric label="Approved, ready to hand off" value={approved}/><ReviewMetric label="Operations handoffs" value={handedOff}/></div>
    </header>
    <div className="grid gap-6 p-5 2xl:grid-cols-[.85fr_1.15fr]">
      <div className="space-y-6">
        <section className="rounded-lg bg-ink-soft p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-brand">Your decision path</p><ol className="mt-4 space-y-3 text-sm leading-6 text-white/65"><li><b className="text-white">1. Review:</b> open a submitted quote below and verify the rate and supporting files.</li><li><b className="text-white">2. Decide:</b> approve it or return it with a required rework reason.</li><li><b className="text-white">3. Handoff:</b> open an approved quote and create the Operations shipment.</li></ol></section>
        <section><SectionTitle title="Complete lead record" copy="Every available customer and commercial detail is visible before you make a quote decision."/><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Company" value={lead.company_name || "Not supplied"}/><Info label="Pipeline stage" value={lead.stage || "Not supplied"}/><Info label="Contact" value={lead.contact_name || "Not supplied"}/><Info label="Email" value={lead.contact_email || "Not supplied"}/><Info label="Phone" value={lead.contact_phone || "Not supplied"}/><Info label="Source" value={lead.source || "Not supplied"}/><Info label="Forecast" value={lead.estimated_monthly_value ? money(lead.estimated_monthly_value) : "Not supplied"}/><Info label="Next follow-up" value={lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : "Not scheduled"}/></div>{lead.notes && <div className="mt-4 rounded-md bg-black/[.035] p-3"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-black/45">Lead notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/65">{lead.notes}</p></div>}</section>
        <section className="border-t border-black/8 pt-6"><SectionTitle title="Agent activity history" copy="Calls, follow-ups, appointments, and notes recorded against this lead."/><Timeline rows={detail.data.activities ?? []} empty="No activities have been recorded."/></section>
      </div>
      <div className="space-y-6">
        <section className="rounded-lg border border-brand/35 bg-[#fffaf1] p-5"><SectionTitle title="Quote approval and Operations handoff" copy="Open the submitted quote to inspect its shipment terms and documents. Managers approve or return it for rework; only an approved quote can be sent to Brokerage Operations."/><div className="mt-4 space-y-3">{quotes.map((quote: any) => <QuoteWorkspace key={quote.id} quoteId={quote.id} quote={quote} data={data} api={api} refresh={refreshLead} report={report}/>)}{!quotes.length && <p className="rounded-md border border-dashed border-black/15 bg-white px-4 py-5 text-sm text-black/50">No quote exists for this lead yet. There is nothing for the manager to approve until the Sales Agent creates and submits a shipment quote.</p>}</div></section>
        <section className="border-t border-black/8 pt-6"><SectionTitle title="Manager comments" copy="Leave direction or an approval note visible to people working this lead."/><form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2"><input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add direction for the Sales Agent" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/><PendingButton pending={commentBusy} pendingLabel="Posting..." className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton></form><CommentList rows={detail.data.comments ?? []} empty="No comments yet." onDelete={deleteComment} busy={actions.isBusy}/></section>
      </div>
    </div>
  </div>;
}

export function ReviewMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md bg-black/[.035] p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-black/40">{label}</p></div>; }

export function LeadDetail({ leadId, data, api, refresh, report, onOpenCustomers }: { leadId: string; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers?: () => void }) {
  if (data.capabilities?.departmentManager) return <ManagerLeadReview leadId={leadId} data={data} api={api} refresh={refresh} report={report}/>;
  return <AgentLeadDetail leadId={leadId} data={data} api={api} refresh={refresh} report={report} onOpenCustomers={onOpenCustomers}/>;
}

function AgentLeadDetail({ leadId, api, refresh, report }: { leadId: string; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers?: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["brokerage", "lead", leadId], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/leads/" + leadId + "/detail")), staleTime: 15_000 });
  const [leadForm, setLeadForm] = useState<any>(null);
  const [activity, setActivity] = useState({ activity_type: "CALL", body: "", due_at: "" });
  const [comment, setComment] = useState("");
  const actions = useSingleFlight();

  useEffect(() => {
    if (detail.data?.lead) setLeadForm({ ...detail.data.lead, next_follow_up_at: localInput(detail.data.lead.next_follow_up_at) });
  }, [detail.data?.lead]);

  const invalidate = async () => {
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "lead", leadId] });
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "customer"] });
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "customers"] });
    void refresh();
  };
  const perform = async (path: string, method: string, body: unknown, success: string) => {
    const result = await actions.run(method + ":" + path, async () => {
      try {
        await responseData(await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
        await invalidate();
        report(success);
        return true;
      } catch (error) {
        report(message(error), "error");
        return false;
      }
    });
    return result === true;
  };

  if (detail.isLoading || !leadForm) return <DetailSkeleton/>;
  if (detail.isError || !detail.data) return <Empty title="Lead detail unavailable" copy={message(detail.error)}/>;

  const lead = detail.data.lead;
  const leadPath = "/api/v1/brokerage/leads/" + lead.id;
  const leadBusy = actions.isBusy("PATCH:" + leadPath);
  const activityBusy = actions.isBusy("POST:" + leadPath + "/activities");
  const commentBusy = actions.isBusy("POST:" + leadPath + "/comments");
  const convertBusy = actions.isBusy("POST:" + leadPath + "/convert");

  const addActivity = () => void (async () => {
    const saved = await perform(leadPath + "/activities", "POST", { ...activity, due_at: activity.due_at ? new Date(activity.due_at).toISOString() : null }, "Activity added.");
    if (saved) setActivity({ activity_type: "CALL", body: "", due_at: "" });
  })();
  const addComment = () => void (async () => {
    if (!comment.trim()) return;
    const saved = await perform(leadPath + "/comments", "POST", { body: comment }, "Comment added.");
    if (saved) setComment("");
  })();
  const updateActivity = (activity: any, completed: boolean) => void perform("/api/v1/brokerage/activities/" + activity.id, "PATCH", { completed }, completed ? "Activity marked completed." : "Activity reopened.");
  const deleteActivity = (activityId: string) => void perform("/api/v1/brokerage/activities/" + activityId, "DELETE", undefined, "Activity deleted.");
  const deleteComment = (commentId: string) => void perform("/api/v1/brokerage/comments/" + commentId, "DELETE", undefined, "Comment deleted.");

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/8 p-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-brand-deep">Sales detail workspace</p><h2 className="mt-1 text-2xl font-semibold">{lead.company_name}</h2><p className="mt-2 text-sm text-black/50">{lead.contact_name || "No contact name"}{lead.contact_email && <>{ " · " }{lead.contact_email}</>}</p></div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {lead.stage === "CUSTOMER" ? <span title={stageCopy.CUSTOMER} className="rounded-md bg-emerald-50 px-3 py-2 text-[10px] font-bold tracking-[.12em] text-emerald-800">CUSTOMER · MANAGED IN CUSTOMERS</span> : <><label className="text-[10px] font-bold uppercase tracking-[.1em] text-black/45">Pipeline stage<select disabled={leadBusy} value={leadForm.stage} onChange={(event) => setLeadForm({ ...leadForm, stage: event.target.value })} className="ml-2 h-9 rounded-md border border-black/10 bg-white px-2 text-xs font-bold disabled:opacity-55">{editableStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><PendingButton type="button" pending={leadBusy} pendingLabel="Updating..." disabled={leadBusy || leadForm.stage === lead.stage} onClick={() => void perform(leadPath, "PATCH", { stage: leadForm.stage }, `Pipeline moved to ${leadForm.stage}.`)} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Update stage</PendingButton><p className="basis-full text-right text-[10px] text-black/45">{stageCopy[leadForm.stage]}</p></>}
        <PendingButton type="button" pending={leadBusy} pendingLabel="Saving..." onClick={() => void perform(leadPath, "PATCH", { archived_at: lead.archived_at ? null : new Date().toISOString() }, lead.archived_at ? "Lead restored." : "Lead archived.")} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">{lead.archived_at ? "Restore" : "Archive"}</PendingButton>
      </div>
    </div>
    <div className="grid gap-6 p-5 2xl:grid-cols-[1.05fr_.95fr]">
      <div className="space-y-6">
        <section>
          <SectionTitle title="Lead information" copy="Update contact details, forecast, and next follow-up."/>
          <fieldset disabled={leadBusy} className="mt-4 grid gap-3 disabled:opacity-55 sm:grid-cols-2">
            <Input light label="Company" value={leadForm.company_name ?? ""} onChange={(company_name) => setLeadForm({ ...leadForm, company_name })}/>
            <Input light label="Contact" required={false} value={leadForm.contact_name ?? ""} onChange={(contact_name) => setLeadForm({ ...leadForm, contact_name })}/>
            <Input light label="Email" type="email" required={false} value={leadForm.contact_email ?? ""} onChange={(contact_email) => setLeadForm({ ...leadForm, contact_email })}/>
            <Input light label="Phone" required={false} value={leadForm.contact_phone ?? ""} onChange={(contact_phone) => setLeadForm({ ...leadForm, contact_phone })}/>
            <Input light label="Source" required={false} value={leadForm.source ?? ""} onChange={(source) => setLeadForm({ ...leadForm, source })}/>
            <Input light label="Forecast" required={false} type="number" value={String(leadForm.estimated_monthly_value ?? "")} onChange={(estimated_monthly_value) => setLeadForm({ ...leadForm, estimated_monthly_value })}/>
            <Input light label="Follow-up" required={false} type="datetime-local" value={leadForm.next_follow_up_at ?? ""} onChange={(next_follow_up_at) => setLeadForm({ ...leadForm, next_follow_up_at })}/>
          </fieldset>
          <PendingButton type="button" pending={leadBusy} pendingLabel="Updating lead..." onClick={() => void perform(leadPath, "PATCH", { company_name: leadForm.company_name, contact_name: leadForm.contact_name, contact_email: leadForm.contact_email, contact_phone: leadForm.contact_phone, source: leadForm.source, estimated_monthly_value: leadForm.estimated_monthly_value === "" ? null : Number(leadForm.estimated_monthly_value), next_follow_up_at: leadForm.next_follow_up_at ? new Date(leadForm.next_follow_up_at).toISOString() : null }, "Lead information updated.")} className="mt-4 h-9 rounded-md bg-ink-soft px-3 text-xs font-bold text-white disabled:opacity-50">Update lead information</PendingButton>
        </section>

        <section className="border-t border-black/8 pt-6">
          <SectionTitle title="Activities and follow-ups" copy="Capture calls, email, notes, callbacks, and appointments in one timeline."/>
          <form onSubmit={(event) => { event.preventDefault(); addActivity(); }} className="mt-4 grid gap-3 sm:grid-cols-[130px_1fr]">
            <fieldset disabled={activityBusy} className="contents">
              <select value={activity.activity_type} onChange={(event) => setActivity({ ...activity, activity_type: event.target.value })} className="h-10 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"><option>CALL</option><option>EMAIL</option><option>NOTE</option><option>FOLLOW_UP</option><option>APPOINTMENT</option></select>
              <input required value={activity.body} onChange={(event) => setActivity({ ...activity, body: event.target.value })} placeholder="What happened or what is next?" className="h-10 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/>
              <input value={activity.due_at} onChange={(event) => setActivity({ ...activity, due_at: event.target.value })} type="datetime-local" className="h-10 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/>
            </fieldset>
            <PendingButton pending={activityBusy} pendingLabel="Adding..." className="h-10 rounded-md border border-black/10 text-xs font-bold disabled:opacity-50">Add activity</PendingButton>
          </form>
          <Timeline rows={detail.data.activities} empty="No activities have been recorded." onComplete={updateActivity} onDelete={deleteActivity} busy={actions.isBusy}/>
        </section>

        <section className="border-t border-black/8 pt-6">
          <SectionTitle title="Internal comments" copy="Comments are visible to the people permitted to work on this lead."/>
          <form onSubmit={(event) => { event.preventDefault(); addComment(); }} className="mt-4 flex gap-2">
            <input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/>
            <PendingButton pending={commentBusy} pendingLabel="Posting..." className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton>
          </form>
          <CommentList rows={detail.data.comments} empty="No comments yet." onDelete={deleteComment} busy={actions.isBusy}/>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg bg-ink-soft p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-brand">Customer conversion</p>
          <h3 className="mt-2 text-lg font-semibold">Move an approved relationship forward.</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Conversion opens the customer workspace with contact information, history, shipment progress, and customer comments.</p>
          <PendingButton type="button" pending={convertBusy} pendingLabel="Creating customer..." onClick={() => void perform(leadPath + "/convert", "POST", undefined, "Customer workspace created.")} className="mt-5 h-10 rounded-md bg-brand px-4 text-sm font-bold text-black disabled:opacity-50">{detail.data.customer ? "Refresh customer" : "Convert to customer"}</PendingButton>
        </section>

        {detail.data.customer ? <CustomerWorkspace customerId={detail.data.customer.id} api={api} report={report}/> : <section className="rounded-lg border border-dashed border-black/15 p-5"><SectionTitle title="Commercial shipment workspace" copy="Convert the qualified lead to a customer first. The shipment form, rates, dates, status, follow-ups, and customer notes will then appear here in Sales Workspace."/></section>}
      </div>
    </div>
  </div>;
}

export function QuoteWorkspace({ quoteId, quote, data, api, refresh, report }: { quoteId: string; quote: any; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [handoff, setHandoff] = useState({ operations_department_id: data.operationsDepartments?.[0]?.id ?? "", reference_number: "", customer_name: "" });
  const [handoffOpen, setHandoffOpen] = useState(false);
  const actions = useSingleFlight();
  const detail = useQuery({
    queryKey: ["brokerage", "quote", quoteId],
    queryFn: async () => responseData<any>(await api("/api/v1/brokerage/quotes/" + quoteId + "/detail")),
    enabled: open,
    staleTime: 10_000,
  });

  const refreshData = () => {
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "quote", quoteId] });
    void refresh();
  };

  const act = (key: string, path: string, method: string, body: unknown, success: string) => void actions.run(key, async () => {
    try {
      await responseData(await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
      refreshData();
      report(success);
    } catch (error) {
      report(message(error), "error");
    }
  });

  const approve = (openHandoff = false) => void actions.run(openHandoff ? "approve-handoff" : "approve", async () => {
    try {
      await responseData(await api("/api/v1/brokerage/quotes/" + quoteId + "/review", { method: "POST", body: JSON.stringify({ action: "APPROVE" }) }));
      // Reflect the decision immediately; the normal refetch then reconciles the server record.
      queryClient.setQueryData(["brokerage", "quote", quoteId], (current: any) => current ? { ...current, quote: { ...current.quote, stage: "APPROVED" } } : current);
      if (openHandoff) setHandoffOpen(true);
      refreshData();
      report(openHandoff ? "Quote approved. Choose an Operations department to finish handoff." : "Quote approved and ready for Operations handoff.");
    } catch (error) {
      report(message(error), "error");
    }
  });

  const saveAttachment = () => void actions.run("attachment", async () => {
    if (!stagedFile) return;
    try {
      const signed = await responseData<any>(await api("/api/v1/brokerage/quotes/" + quoteId + "/upload-url", { method: "POST", body: JSON.stringify({ file_name: stagedFile.name, content_type: stagedFile.type }) }));
      const uploaded = await fetch(signed.signed_url, { method: "PUT", headers: { "Content-Type": stagedFile.type }, body: stagedFile });
      if (!uploaded.ok) throw new Error("Attachment upload failed.");
      await responseData(await api("/api/v1/brokerage/quotes/" + quoteId + "/attachments", { method: "POST", body: JSON.stringify({ file_name: stagedFile.name, storage_path: signed.path }) }));
      setStagedFile(null);
      refreshData();
      report("Quote attachment saved.");
    } catch (error) {
      report(message(error), "error");
    }
  });

  const postComment = () => void actions.run("comment", async () => {
    if (!comment.trim()) return;
    try {
      await responseData(await api("/api/v1/brokerage/quotes/" + quoteId + "/comments", { method: "POST", body: JSON.stringify({ body: comment }) }));
      setComment("");
      refreshData();
      report("Quote comment added.");
    } catch (error) {
      report(message(error), "error");
    }
  });
  const deleteComment = (commentId: string) => act("delete-comment:" + commentId, "/api/v1/brokerage/comments/" + commentId, "DELETE", undefined, "Quote comment deleted.");

  const openAttachment = (attachment: any) => void actions.run("download:" + attachment.id, async () => {
    try {
      const link = await responseData<any>(await api("/api/v1/brokerage/quote-attachments/" + attachment.id + "/download-url"));
      window.open(link.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      report(message(error), "error");
    }
  });

  const quoteStage = detail.data?.quote?.stage;
  const anyActionBusy = actions.isBusy();
  const managerReview = Boolean(data.capabilities?.canReviewQuotes);

  return <article className="rounded-md border border-black/8 bg-white">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left">
      <span><b className="text-sm">{quote.pickup_location} to {quote.delivery_location}</b><span className="mt-1 block text-xs text-black/50">{quote.equipment_type || "Equipment not specified"} · {quote.quoted_rate ? "$" + quote.quoted_rate : "Rate pending"}</span></span>
      <span className="rounded-md bg-black/[.05] px-2 py-1 text-[9px] font-bold">{quote.stage}</span>
    </button>
    {open && <div className="border-t border-black/8 p-4">
      {detail.isLoading ? <div className="flex items-center gap-2 text-xs text-black/50"><LoaderCircle size={16} className="animate-spin text-brand"/> Loading quote workspace...</div> : detail.data ? <>
        <div className="flex flex-wrap gap-2">
          {!managerReview && <PendingButton type="button" pending={actions.isBusy("submit")} pendingLabel="Submitting..." disabled={anyActionBusy || !["DRAFT", "REJECTED"].includes(quoteStage)} onClick={() => act("submit", "/api/v1/brokerage/quotes/" + quoteId + "/submit", "POST", undefined, "Quote submitted for review.")} className="h-8 rounded-md bg-ink-soft px-3 text-xs font-bold text-white disabled:opacity-35">Submit for review</PendingButton>}
          {managerReview && quoteStage === "SUBMITTED" && <>
            <PendingButton type="button" pending={actions.isBusy("reject")} pendingLabel="Returning..." disabled={anyActionBusy || !reviewNote.trim()} onClick={() => act("reject", "/api/v1/brokerage/quotes/" + quoteId + "/review", "POST", { action: "REJECT", note: reviewNote }, "Quote returned for rework.")} className="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-45">Reject for rework</PendingButton>
            <PendingButton type="button" pending={actions.isBusy("approve")} pendingLabel="Approving..." disabled={anyActionBusy} onClick={() => approve()} className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-45">Approve</PendingButton>
            <PendingButton type="button" pending={actions.isBusy("approve-handoff")} pendingLabel="Approving..." disabled={anyActionBusy} onClick={() => approve(true)} className="h-8 rounded-md bg-brand px-3 text-xs font-bold text-black disabled:opacity-45">Approve &amp; hand off</PendingButton>
          </>}
          {data.capabilities?.canHandoffQuotes && quoteStage === "APPROVED" && <button type="button" disabled={anyActionBusy} onClick={() => setHandoffOpen((value) => !value)} className="h-8 cursor-pointer rounded-md bg-brand px-3 text-xs font-bold disabled:opacity-45">{handoffOpen ? "Close handoff" : "Send to Operations"}</button>}
        </div>

        {data.capabilities?.canReviewQuotes && quoteStage === "SUBMITTED" && <textarea disabled={anyActionBusy} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Required reason when returning a quote for rework" className="mt-3 min-h-16 w-full rounded-md border border-black/10 p-3 text-sm disabled:opacity-55"/>}

        {data.capabilities?.canHandoffQuotes && quoteStage === "APPROVED" && handoffOpen && <form id={"handoff-" + quoteId} onSubmit={(event) => { event.preventDefault(); act("handoff", "/api/v1/brokerage/quotes/" + quoteId + "/handoff", "POST", handoff, "Quote handed to Operations."); }} className="mt-4 rounded-md border border-brand/45 bg-brand-tint p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold">Send approved quote to Operations</p><p className="mt-1 max-w-2xl text-xs leading-5 text-black/60">Choose the receiving Brokerage Operations department. Its manager is notified and assigns the shipment to an Operations Agent or team.</p></div><span className="rounded-md bg-brand px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-black">Step 2 of 2</span></div>
          <div className="mt-4 max-w-xl space-y-3">
            <label className="grid gap-1 text-xs font-semibold text-black/65"><span>Receiving department</span><select required disabled={anyActionBusy} value={handoff.operations_department_id} onChange={(event) => setHandoff({ ...handoff, operations_department_id: event.target.value })} className="h-10 w-full cursor-pointer rounded-md border border-black/10 bg-white px-3 text-sm disabled:opacity-55"><option value="">Choose Brokerage Operations</option>{(data.operationsDepartments ?? []).map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-semibold text-black/65"><span>Shipment reference</span><input required disabled={anyActionBusy} value={handoff.reference_number} onChange={(event) => setHandoff({ ...handoff, reference_number: event.target.value })} placeholder="e.g. DG-2026-001" className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm disabled:opacity-55"/></label>
            <label className="grid gap-1 text-xs font-semibold text-black/65"><span>Customer name</span><input required disabled={anyActionBusy} value={handoff.customer_name} onChange={(event) => setHandoff({ ...handoff, customer_name: event.target.value })} placeholder="Customer company" className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm disabled:opacity-55"/></label>
          </div>
          <PendingButton pending={actions.isBusy("handoff")} pendingLabel="Creating shipment..." disabled={anyActionBusy && !actions.isBusy("handoff")} className="mt-4 h-10 rounded-md bg-ink-soft px-4 text-xs font-bold text-white disabled:opacity-50">Confirm Operations handoff</PendingButton>
        </form>}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-black/8 p-3">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Attachments</p><span className="text-[10px] text-black/40">{detail.data.attachments.length} file{detail.data.attachments.length === 1 ? "" : "s"}</span></div>
            {!managerReview && <label className="mt-2 flex h-9 items-center justify-center rounded-md border border-dashed border-black/20 text-xs font-bold disabled:opacity-50">
              Choose PDF or image
              <input disabled={anyActionBusy} className="hidden" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setStagedFile(event.target.files?.[0] ?? null)}/>
            </label>}
            {!managerReview && stagedFile && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand/30 bg-[#fff7e8] p-3">
              <div className="min-w-0"><p className="truncate text-xs font-semibold">{stagedFile.name}</p><p className="mt-1 text-[10px] text-black/50">Ready to save. This file has not been uploaded yet.</p></div>
              <div className="flex gap-2">
                <button type="button" disabled={anyActionBusy} onClick={() => setStagedFile(null)} className="h-8 rounded-md border border-black/10 px-2 text-[11px] font-bold disabled:opacity-50">Discard</button>
                <PendingButton type="button" pending={actions.isBusy("attachment")} pendingLabel="Saving..." disabled={anyActionBusy && !actions.isBusy("attachment")} onClick={saveAttachment} className="h-8 rounded-md bg-ink-soft px-2 text-[11px] font-bold text-white disabled:opacity-50">Save attachment</PendingButton>
              </div>
            </div>}
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
              {detail.data.attachments.map((attachment: any) => <PendingButton key={attachment.id} type="button" pending={actions.isBusy("download:" + attachment.id)} pendingLabel="Opening..." disabled={anyActionBusy && !actions.isBusy("download:" + attachment.id)} onClick={() => openAttachment(attachment)} className="w-full justify-between rounded-md bg-black/[.035] px-2 py-2 text-left text-xs"><span className="truncate">{attachment.file_name}</span><FileText size={13}/></PendingButton>)}
              {!detail.data.attachments.length && <p className="text-xs text-black/45">No supporting files.</p>}
            </div>
          </div>
          <div className="rounded-md border border-black/8 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Revision history</p><span className="text-[10px] text-black/40">{detail.data.events.length} event{detail.data.events.length === 1 ? "" : "s"}</span></div><div className="mt-2 max-h-52 overflow-y-auto pr-1"><Timeline rows={detail.data.events} empty="No quote events yet."/></div></div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2">
          <input disabled={anyActionBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add review note or internal comment" className="h-9 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-xs disabled:opacity-55"/>
          <PendingButton pending={actions.isBusy("comment")} pendingLabel="Posting..." disabled={anyActionBusy && !actions.isBusy("comment")} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton>
        </form>
        <CommentList rows={detail.data.comments} empty="No quote comments." onDelete={deleteComment} busy={actions.isBusy}/>

      </> : <p className="text-sm text-red-600">Quote details could not be loaded.</p>}
    </div>}
  </article>;
}
