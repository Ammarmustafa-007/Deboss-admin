"use client";

import { Activity, Bell, Building2, Check, ChevronLeft, ChevronRight, ClipboardList, FileText, FolderKanban, LayoutDashboard, LoaderCircle, LogOut, MessageSquare, ReceiptText, RefreshCw, ShieldCheck, Truck, UsersRound, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { OperationsBoard } from "@/components/operations-board";
import { TeamBuilderPanel } from "@/components/team-builder-panel";
import { BrokerageWorkflowGuide } from "@/components/brokerage-workflow-guide";
import { InvoiceLedger } from "@/app/app/invoices/page";
import { DepartmentAccessPanel } from "@/app/app/access/page";
import { PendingButton, useSingleFlight } from "@/components/action-state";

const root = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const stages = ["NEW", "CONTACTED", "QUALIFIED", "CUSTOMER", "LOST"];

type Profile = { id: string; full_name: string; email: string; role: string };
type Notice = { tone: "success" | "error"; message: string } | null;

export function BrokerageCommandCenter({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [section, setSection] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(`${root}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
    });
  }, [supabase]);

  const workspace = useQuery({
    queryKey: ["brokerage", "workspace"],
    queryFn: async () => responseData<any>(await api("/api/v1/brokerage/workspace")),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const notifications = useQuery({
    queryKey: ["brokerage", "notifications"],
    queryFn: async () => responseData<any>(await api("/api/v1/brokerage/notifications")),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refresh = useCallback(async () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["brokerage", "workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["brokerage", "notifications"] }),
    ]).catch(() => undefined);
  }, [queryClient]);
  const report = (message: string, tone: "success" | "error" = "success") => setNotice({ message, tone });

  if (workspace.isLoading) return <WorkspaceSkeleton />;
  if (workspace.isError || !workspace.data) return <main className="grid min-h-screen place-items-center bg-[#f5f4f0] p-6"><div className="max-w-md text-center"><ShieldCheck className="mx-auto text-[#a65c00]" size={28}/><h1 className="mt-4 text-2xl font-semibold">Brokerage workspace unavailable</h1><p className="mt-2 text-sm leading-6 text-black/55">{workspace.error instanceof Error ? workspace.error.message : "We could not load your permitted Brokerage data."}</p><button onClick={() => void workspace.refetch()} className="mt-6 h-10 rounded-md bg-[#1a1917] px-4 text-sm font-bold text-white">Try again</button></div></main>;

  const data = workspace.data;
  const sales = Boolean(data.capabilities?.sales);
  const manager = Boolean(data.capabilities?.departmentManager);
  const teamLead = Boolean(data.capabilities?.teamLead);
  const unread = (notifications.data?.notifications ?? []).filter((item: any) => !item.read_at).length;
  const nav = [
    ["overview", LayoutDashboard, "Overview", true],
    ["workflow", Activity, "How work arrives", true],
    ["sales", ClipboardList, "Sales workspace", sales],
    ["operations", Truck, "Operations board", !sales],
    ["finance", ReceiptText, "Invoice ledger", !sales && (manager || data.capabilities?.canMarkInvoiceReady)],
    ["teams", UsersRound, "Teams & leads", manager],
    ["access", ShieldCheck, "Agent access", manager],
    ["reports", Activity, "Reports", true],
    ["notifications", Bell, "Notifications", true],
  ] as const;

  return <main className="min-h-screen bg-[#f5f4f0] text-[#191816]">
    <aside className={`fixed inset-y-0 z-30 hidden flex-col bg-[#10100f] p-4 text-white transition-[width] duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-64"}`}>
      <div className="mb-10 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#f59a18] text-black"><Building2 size={18}/></span>{!collapsed && <div className="min-w-0"><p className="text-sm font-bold tracking-[.18em]">DEBOSS</p><p className="truncate text-[8px] font-bold tracking-[.18em] text-[#f59a18]">GLOBAL OPERATIONS</p></div>}</div><button onClick={() => setCollapsed((value) => !value)} title={collapsed ? "Expand navigation" : "Collapse navigation"} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/55 hover:bg-white/10 hover:text-white">{collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}</button></div>
      {!collapsed && <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-white/35">Brokerage</p>}
      {nav.filter(([, , , visible]) => visible).map(([key, Icon, label]) => <button key={key} onClick={() => setSection(key)} title={collapsed ? label : undefined} className={`relative mb-1 flex h-11 items-center gap-3 rounded-md text-sm transition ${collapsed ? "justify-center" : "px-3"} ${section === key ? "bg-[#f59a18] font-bold text-black" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><Icon size={17}/>{!collapsed && label}{key === "notifications" && unread > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-md bg-red-500 px-1 text-[10px] font-bold text-white ${collapsed ? "absolute -right-1 -top-1" : "ml-auto"}`}>{unread}</span>}</button>)}
      <button onClick={onSignOut} title="Sign out" className={`mt-auto flex h-10 items-center gap-3 border-t border-white/10 pt-4 text-sm text-white/60 hover:text-white ${collapsed ? "justify-center" : "px-3"}`}><LogOut size={17}/>{!collapsed && "Sign out"}</button>
    </aside>
    <section className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-64"}`}>
      <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-black/8 bg-white/95 px-5 backdrop-blur lg:px-9"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Brokerage · {manager ? "Department manager" : teamLead ? "Team lead" : "Agent"}</p><h1 className="mt-1 text-lg font-semibold">{titleFor(section, sales)}</h1></div><div className="flex items-center gap-3"><button onClick={() => void refresh()} title="Refresh workspace" className="grid h-9 w-9 place-items-center rounded-md border border-black/10 text-black/55 hover:bg-black/5"><RefreshCw size={15}/></button><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{profile.full_name}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-black/45">{profile.role.replace("_", " ")}</p></div></div></header>
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        {notice && <Toast notice={notice} dismiss={() => setNotice(null)}/>} 
        {section === "overview" && <Overview data={data} sales={sales} setSection={setSection}/>} 
        {section === "workflow" && <BrokerageWorkflowGuide sales={sales} manager={manager} teamLead={teamLead} setSection={setSection}/>} 
        {section === "sales" && sales && <SalesWorkspace data={data} api={api} refresh={refresh} report={report}/>} 
        {section === "operations" && !sales && <OperationsBoard embedded initialWorkspace={data}/>} 
        {section === "finance" && !sales && <InvoiceLedger embedded/>}
        {section === "teams" && manager && <TeamBuilderPanel/>}
        {section === "access" && manager && <DepartmentAccessPanel embedded/>}
        {section === "reports" && <ReportsWorkspace api={api} report={report} sales={sales}/>} 
        {section === "notifications" && <NotificationsWorkspace data={notifications.data?.notifications ?? []} api={api} refresh={refresh} report={report}/>} 
      </div>
    </section>
  </main>;
}

function Overview({ data, sales, setSection }: { data: any; sales: boolean; setSection: (section: string) => void }) {
  const records = sales ? data.leads ?? [] : data.shipments ?? [];
  const attention = sales ? (data.quotes ?? []).filter((quote: any) => quote.stage === "SUBMITTED").length : (data.shipments ?? []).filter((shipment: any) => shipment.exception_note).length;
  return <div className="animate-in fade-in duration-300"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">{data.department?.function ?? "Brokerage"} department</p><h2 className="mt-2 text-3xl font-semibold">{sales ? "Pipeline, customers, and approvals." : "Assignments, execution, and billing."}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">This workspace is filtered by your current department, team membership, and delegated rights.</p></div><button onClick={() => setSection(sales ? "sales" : "operations")} className="flex h-10 items-center gap-2 rounded-md bg-[#1a1917] px-4 text-sm font-bold text-white">{sales ? <ClipboardList size={16}/> : <Truck size={16}/>}{sales ? "Open Sales workspace" : "Open Operations board"}</button></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={sales ? ClipboardList : Truck} label={sales ? "Visible leads" : "Visible shipments"} value={records.length}/><Metric icon={FolderKanban} label="Active teams" value={data.teams?.length ?? 0}/><Metric icon={Activity} label={sales ? "Pending approvals" : "Open exceptions"} value={attention}/><Metric icon={ShieldCheck} label="Delegated rights" value={data.permissions?.length ?? 0}/></div><div className="mt-7 grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><section className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><p className="font-semibold">Your current queue</p><p className="mt-1 text-xs text-black/45">The most recently updated records you are allowed to work on.</p></div><div className="divide-y divide-black/6">{records.slice(0, 7).map((record: any) => <div key={record.id} className="px-5 py-4"><p className="text-sm font-semibold">{sales ? record.company_name : `${record.reference_number} · ${record.customer_name}`}</p><p className="mt-1 text-xs text-black/50">{sales ? `${record.stage} · ${record.next_follow_up_at ? `Follow-up ${new Date(record.next_follow_up_at).toLocaleDateString()}` : "No follow-up scheduled"}` : `${record.status} · ${record.pickup_location} to ${record.delivery_location}`}</p></div>)}{!records.length && <p className="p-10 text-sm text-black/50">Your queue is clear.</p>}</div></section><section className="rounded-lg bg-[#191816] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Permission-aware workspace</p><h3 className="mt-3 text-xl font-semibold">Your controls match your access.</h3><p className="mt-3 text-sm leading-6 text-white/55">Managers see department-level ownership and configuration. Team Leads only receive the elevated controls explicitly granted by their manager. Agents work only with their own records unless access has been delegated.</p><div className="mt-6 flex flex-wrap gap-2">{(data.permissions ?? []).slice(0, 6).map((permission: string) => <span key={permission} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">{permission.replaceAll(".", " · ")}</span>)}{!(data.permissions ?? []).length && <span className="text-sm text-white/45">No additional delegated permissions.</span>}</div></section></div></div>;
}

function SalesWorkspace({ data, api, refresh, report }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  if (data.capabilities?.departmentManager) return <SalesManagerWorkspace data={data} api={api} refresh={refresh} report={report}/>;
  return <SalesAgentWorkspace data={data} api={api} refresh={refresh} report={report}/>;
}

function SalesManagerWorkspace({ data, api, refresh, report }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const [selectedLead, setSelectedLead] = useState<string | null>(data.leads?.[0]?.id ?? null);
  const leads = data.leads ?? [];
  const quotes = data.quotes ?? [];
  const submitted = quotes.filter((quote: any) => quote.stage === "SUBMITTED");
  const approved = quotes.filter((quote: any) => quote.stage === "APPROVED");
  const customers = leads.filter((lead: any) => lead.stage === "CUSTOMER");
  return <div className="space-y-5"><section className="rounded-lg bg-[#191816] p-6 text-white"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Sales manager command view</p><h2 className="mt-2 text-2xl font-semibold">Run the department, not a personal queue.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Review work from every Sales Agent, approve or return quotes, hand approved shipments to Operations, and use Teams & leads to control delegated access.</p></div><div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-right"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/45">Approval queue</p><p className="mt-1 text-2xl font-semibold text-[#f59a18]">{submitted.length}</p><p className="text-xs text-white/50">quotes awaiting review</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ManagerMetric label="Department leads" value={leads.length}/><ManagerMetric label="Customers" value={customers.length}/><ManagerMetric label="Awaiting approval" value={submitted.length}/><ManagerMetric label="Ready for handoff" value={approved.length}/></div></section><div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-4 py-4"><p className="font-semibold">Department pipeline</p><p className="mt-1 text-xs leading-5 text-black/45">Every Sales Agent's lead is visible here. Select one to review, approve its quote, or hand it to Operations.</p></div><div className="max-h-[720px] divide-y divide-black/6 overflow-auto">{leads.map((lead: any) => { const leadQuotes = quotes.filter((quote: any) => quote.lead_id === lead.id); const needsReview = leadQuotes.some((quote: any) => quote.stage === "SUBMITTED"); const readyForHandoff = leadQuotes.some((quote: any) => quote.stage === "APPROVED"); return <button key={lead.id} onClick={() => setSelectedLead(lead.id)} className={`w-full px-4 py-4 text-left transition ${selectedLead === lead.id ? "bg-[#fff4e4]" : "hover:bg-black/[.025]"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{lead.company_name}</p><span className={`rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${needsReview ? "bg-amber-100 text-amber-800" : readyForHandoff ? "bg-emerald-100 text-emerald-800" : "bg-black/[.05] text-black/65"}`}>{needsReview ? "REVIEW" : readyForHandoff ? "HANDOFF" : lead.stage}</span></div><p className="mt-1 truncate text-xs text-black/50">{lead.contact_name || "No contact name"}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.12em] text-black/40">{leadQuotes.length ? `${leadQuotes.length} quote${leadQuotes.length === 1 ? "" : "s"}` : "No quote yet"}</p></button>; })}{!leads.length && <p className="p-7 text-sm text-black/45">No Sales leads exist in this department yet.</p>}</div></aside><section className="min-w-0 rounded-lg border border-black/8 bg-white">{selectedLead ? <LeadDetail leadId={selectedLead} data={data} api={api} refresh={refresh} report={report}/> : <Empty title="Select a department lead" copy="Choose a lead to inspect the customer history, review quotes, and hand approved work to Operations."/>}</section></div></div>;
}

function ManagerMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{label}</p></div>; }

function SalesAgentWorkspace({ data, api, refresh, report }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const [selectedLead, setSelectedLead] = useState<string | null>(data.leads?.[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" });
  const createLead = async (event: FormEvent) => { event.preventDefault(); if (creating) return; setCreating(true); try { await responseData(await api("/api/v1/brokerage/leads", { method: "POST", body: JSON.stringify({ ...form, estimated_monthly_value: form.estimated_monthly_value ? Number(form.estimated_monthly_value) : undefined, next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : undefined }) })); setForm({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" }); await refresh(); report("Lead created and added to the pipeline."); } catch (error) { report(message(error), "error"); } finally { setCreating(false); } };
  return <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className="space-y-5"><form onSubmit={createLead} className="rounded-lg bg-[#191816] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">New customer lead</p><h2 className="mt-2 text-xl font-semibold">Build the pipeline.</h2><fieldset disabled={creating} className="mt-5 space-y-3 disabled:opacity-55"><Input label="Company name" value={form.company_name} onChange={(company_name) => setForm({ ...form, company_name })}/><Input label="Contact name" value={form.contact_name} onChange={(contact_name) => setForm({ ...form, contact_name })}/><Input label="Contact email" type="email" required={false} value={form.contact_email} onChange={(contact_email) => setForm({ ...form, contact_email })}/><Input label="Phone" required={false} value={form.contact_phone} onChange={(contact_phone) => setForm({ ...form, contact_phone })}/><Input label="Source" required={false} value={form.source} onChange={(source) => setForm({ ...form, source })}/><Input label="Estimated monthly value" required={false} type="number" value={form.estimated_monthly_value} onChange={(estimated_monthly_value) => setForm({ ...form, estimated_monthly_value })}/><Input label="Next follow-up" required={false} type="datetime-local" value={form.next_follow_up_at} onChange={(next_follow_up_at) => setForm({ ...form, next_follow_up_at })}/><button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black">{creating && <LoaderCircle size={15} className="animate-spin"/>}{creating ? "Creating lead..." : "Create lead"}</button></fieldset></form><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-4 py-3"><p className="text-sm font-semibold">Pipeline</p><p className="mt-1 text-xs text-black/45">Select a lead to manage its customer journey.</p></div><div className="max-h-[650px] divide-y divide-black/6 overflow-auto">{(data.leads ?? []).map((lead: any) => <button key={lead.id} onClick={() => setSelectedLead(lead.id)} className={`w-full px-4 py-4 text-left transition ${selectedLead === lead.id ? "bg-[#fff4e4]" : "hover:bg-black/[.025]"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{lead.company_name}</p><span className="rounded-md bg-black/[.05] px-2 py-1 text-[9px] font-bold tracking-wide">{lead.stage}</span></div><p className="mt-1 truncate text-xs text-black/50">{lead.contact_name || "No contact name"}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#a65c00]">{lead.next_follow_up_at ? `Follow-up ${new Date(lead.next_follow_up_at).toLocaleDateString()}` : "No follow-up set"}</p></button>)}{!(data.leads ?? []).length && <p className="p-7 text-sm text-black/45">No leads in your current scope.</p>}</div></div></aside><section className="min-w-0 rounded-lg border border-black/8 bg-white">{selectedLead ? <LeadDetail leadId={selectedLead} data={data} api={api} refresh={refresh} report={report}/> : <Empty title="Select a lead" copy="Choose a pipeline record to edit lead details, add activities, create quotes, and open the customer workspace."/>}</section></div>;
}

function ManagerLeadReview({ leadId, data, api, refresh, report }: { leadId: string; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
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

  return <div>
    <header className="border-b border-black/8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a65c00]">Manager review workspace</p><h2 className="mt-1 text-2xl font-semibold">{lead.company_name}</h2><p className="mt-2 text-sm text-black/50">{lead.contact_name || "No contact name"}{lead.contact_email && <>{ " · " }{lead.contact_email}</>}</p></div>
        <div className="flex items-center gap-2">
          <select disabled={leadBusy} value={lead.stage} onChange={(event) => void act(leadPath, "PATCH", { stage: event.target.value }, "Lead stage updated.")} className="h-9 rounded-md border border-black/10 bg-white px-2 text-xs font-bold disabled:opacity-55">{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
          <PendingButton type="button" pending={leadBusy} pendingLabel="Saving..." onClick={() => void act(leadPath, "PATCH", { archived_at: lead.archived_at ? null : new Date().toISOString() }, lead.archived_at ? "Lead restored." : "Lead archived.")} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">{lead.archived_at ? "Restore" : "Archive"}</PendingButton>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><ReviewMetric label="Awaiting quote approval" value={submitted}/><ReviewMetric label="Approved, ready to hand off" value={approved}/><ReviewMetric label="Operations handoffs" value={handedOff}/></div>
    </header>
    <div className="grid gap-6 p-5 2xl:grid-cols-[.85fr_1.15fr]">
      <div className="space-y-6">
        <section className="rounded-lg bg-[#191816] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#f59a18]">Your decision path</p><ol className="mt-4 space-y-3 text-sm leading-6 text-white/65"><li><b className="text-white">1. Review:</b> open a submitted quote below and verify the rate and supporting files.</li><li><b className="text-white">2. Decide:</b> approve it or return it with a required rework reason.</li><li><b className="text-white">3. Handoff:</b> open an approved quote and create the Operations shipment.</li></ol></section>
        <section><SectionTitle title="Customer context" copy="Read the commercial record before making an approval decision."/><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Contact" value={lead.contact_name || "Not supplied"}/><Info label="Phone" value={lead.contact_phone || "Not supplied"}/><Info label="Forecast" value={lead.estimated_monthly_value ? money(lead.estimated_monthly_value) : "Not supplied"}/><Info label="Next follow-up" value={lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : "Not scheduled"}/></div></section>
        <section className="border-t border-black/8 pt-6"><SectionTitle title="Agent activity history" copy="Calls, follow-ups, appointments, and notes recorded against this lead."/><Timeline rows={detail.data.activities ?? []} empty="No activities have been recorded."/></section>
      </div>
      <div className="space-y-6">
        <section className="rounded-lg border border-[#f59a18]/35 bg-[#fffaf1] p-5"><SectionTitle title="Quote approval and Operations handoff" copy="Open a quote to approve, reject for rework, or hand approved work to Brokerage Operations."/><div className="mt-4 space-y-3">{quotes.map((quote: any) => <QuoteWorkspace key={quote.id} quoteId={quote.id} quote={quote} data={data} api={api} refresh={refreshLead} report={report}/>)}{!quotes.length && <p className="rounded-md border border-dashed border-black/15 bg-white px-4 py-5 text-sm text-black/50">The Sales Agent has not created a quote yet. A quote must be submitted before it can be approved or sent to Operations.</p>}</div></section>
        <section className="border-t border-black/8 pt-6"><SectionTitle title="Manager comments" copy="Leave direction or an approval note visible to people working this lead."/><form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2"><input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add direction for the Sales Agent" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/><PendingButton pending={commentBusy} pendingLabel="Posting..." className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton></form><CommentList rows={detail.data.comments ?? []} empty="No comments yet."/></section>
      </div>
    </div>
  </div>;
}

function ReviewMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md bg-black/[.035] p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-black/40">{label}</p></div>; }

function LeadDetail({ leadId, data, api, refresh, report }: { leadId: string; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  if (data.capabilities?.departmentManager) return <ManagerLeadReview leadId={leadId} data={data} api={api} refresh={refresh} report={report}/>;

  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["brokerage", "lead", leadId], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/leads/" + leadId + "/detail")), staleTime: 15_000 });
  const [leadForm, setLeadForm] = useState<any>(null);
  const [activity, setActivity] = useState({ activity_type: "CALL", body: "", due_at: "" });
  const [comment, setComment] = useState("");
  const [quoteForm, setQuoteForm] = useState({ pickup_location: "", delivery_location: "", equipment_type: "", quoted_rate: "" });
  const actions = useSingleFlight();

  useEffect(() => {
    if (detail.data?.lead) setLeadForm({ ...detail.data.lead, next_follow_up_at: localInput(detail.data.lead.next_follow_up_at) });
  }, [detail.data?.lead]);

  const invalidate = async () => {
    void queryClient.invalidateQueries({ queryKey: ["brokerage", "lead", leadId] });
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
  const quoteBusy = actions.isBusy("POST:/api/v1/brokerage/quotes");

  const addActivity = () => void (async () => {
    const saved = await perform(leadPath + "/activities", "POST", { ...activity, due_at: activity.due_at ? new Date(activity.due_at).toISOString() : null }, "Activity added.");
    if (saved) setActivity({ activity_type: "CALL", body: "", due_at: "" });
  })();
  const addComment = () => void (async () => {
    if (!comment.trim()) return;
    const saved = await perform(leadPath + "/comments", "POST", { body: comment }, "Comment added.");
    if (saved) setComment("");
  })();
  const createQuote = () => void (async () => {
    const saved = await perform("/api/v1/brokerage/quotes", "POST", { lead_id: lead.id, ...quoteForm, quoted_rate: quoteForm.quoted_rate ? Number(quoteForm.quoted_rate) : undefined }, "Quote draft created.");
    if (saved) setQuoteForm({ pickup_location: "", delivery_location: "", equipment_type: "", quoted_rate: "" });
  })();

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/8 p-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a65c00]">Sales detail workspace</p><h2 className="mt-1 text-2xl font-semibold">{lead.company_name}</h2><p className="mt-2 text-sm text-black/50">{lead.contact_name || "No contact name"}{lead.contact_email && <>{ " · " }{lead.contact_email}</>}</p></div>
      <div className="flex items-center gap-2">
        <select disabled={leadBusy} value={leadForm.stage} onChange={(event) => { const stage = event.target.value; setLeadForm({ ...leadForm, stage }); void perform(leadPath, "PATCH", { stage }, "Lead stage updated."); }} className="h-9 rounded-md border border-black/10 bg-white px-2 text-xs font-bold disabled:opacity-55">{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
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
          <PendingButton type="button" pending={leadBusy} pendingLabel="Saving lead..." onClick={() => void perform(leadPath, "PATCH", { company_name: leadForm.company_name, contact_name: leadForm.contact_name, contact_email: leadForm.contact_email, contact_phone: leadForm.contact_phone, source: leadForm.source, estimated_monthly_value: leadForm.estimated_monthly_value === "" ? null : Number(leadForm.estimated_monthly_value), next_follow_up_at: leadForm.next_follow_up_at ? new Date(leadForm.next_follow_up_at).toISOString() : null }, "Lead details saved.")} className="mt-4 h-9 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-50">Save lead changes</PendingButton>
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
          <Timeline rows={detail.data.activities} empty="No activities have been recorded."/>
        </section>

        <section className="border-t border-black/8 pt-6">
          <SectionTitle title="Internal comments" copy="Comments are visible to the people permitted to work on this lead."/>
          <form onSubmit={(event) => { event.preventDefault(); addComment(); }} className="mt-4 flex gap-2">
            <input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/>
            <PendingButton pending={commentBusy} pendingLabel="Posting..." className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton>
          </form>
          <CommentList rows={detail.data.comments} empty="No comments yet."/>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg bg-[#191816] p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Customer conversion</p>
          <h3 className="mt-2 text-lg font-semibold">Move an approved relationship forward.</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Conversion opens the customer workspace with contact information, history, shipment progress, and customer comments.</p>
          <PendingButton type="button" pending={convertBusy} pendingLabel="Creating customer..." onClick={() => void perform(leadPath + "/convert", "POST", undefined, "Customer workspace created.")} className="mt-5 h-10 rounded-md bg-[#f59a18] px-4 text-sm font-bold text-black disabled:opacity-50">{detail.data.customer ? "Refresh customer" : "Convert to customer"}</PendingButton>
        </section>

        {detail.data.customer && <CustomerWorkspace customerId={detail.data.customer.id} api={api} report={report}/>}

        <section className="rounded-lg border border-black/8 p-5">
          <SectionTitle title="Quote desk" copy="Draft rates, attach supporting documents, submit for review, and hand off approved work."/>
          <form onSubmit={(event) => { event.preventDefault(); createQuote(); }} className="mt-4 space-y-3">
            <fieldset disabled={quoteBusy} className="space-y-3 disabled:opacity-55">
              <Input light label="Pickup" value={quoteForm.pickup_location} onChange={(pickup_location) => setQuoteForm({ ...quoteForm, pickup_location })}/>
              <Input light label="Delivery" value={quoteForm.delivery_location} onChange={(delivery_location) => setQuoteForm({ ...quoteForm, delivery_location })}/>
              <Input light label="Equipment" required={false} value={quoteForm.equipment_type} onChange={(equipment_type) => setQuoteForm({ ...quoteForm, equipment_type })}/>
              <Input light label="Quoted rate" required={false} type="number" value={quoteForm.quoted_rate} onChange={(quoted_rate) => setQuoteForm({ ...quoteForm, quoted_rate })}/>
            </fieldset>
            <PendingButton pending={quoteBusy} pendingLabel="Creating quote..." className="h-10 w-full rounded-md border border-black/10 text-sm font-bold disabled:opacity-50">Create quote draft</PendingButton>
          </form>
          <div className="mt-5 space-y-2">{detail.data.quotes.map((quote: any) => <QuoteWorkspace key={quote.id} quoteId={quote.id} quote={quote} data={data} api={api} refresh={invalidate} report={report}/>)}</div>
        </section>
      </div>
    </div>
  </div>;
}

function CustomerWorkspace({ customerId, api, report }: { customerId: string; api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void }) {
  const queryClient = useQueryClient();
  const customer = useQuery({ queryKey: ["brokerage", "customer", customerId], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/customers/" + customerId + "/profile")), staleTime: 15_000 });
  const [comment, setComment] = useState("");
  const actions = useSingleFlight();
  const postComment = () => void actions.run("comment", async () => {
    if (!comment.trim()) return;
    try {
      await responseData(await api("/api/v1/brokerage/customers/" + customerId + "/comments", { method: "POST", body: JSON.stringify({ body: comment }) }));
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["brokerage", "customer", customerId] });
      report("Customer comment added.");
    } catch (error) {
      report(message(error), "error");
    }
  });

  if (customer.isLoading) return <div className="rounded-lg border border-black/8 p-5"><LoaderCircle className="animate-spin text-[#f59a18]" size={17}/></div>;
  if (customer.isError || !customer.data) return null;

  const customerBusy = actions.isBusy("comment");
  const data = customer.data;
  return <section className="rounded-lg border border-black/8 p-5">
    <SectionTitle title="Customer workspace" copy="Contact details, relationship history, shipments, and shared customer notes."/>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Info label="Contact" value={data.customer.contact_name || "Not set"}/><Info label="Email" value={data.customer.contact_email || "Not set"}/><Info label="Phone" value={data.customer.contact_phone || "Not set"}/><Info label="Customer since" value={new Date(data.customer.created_at).toLocaleDateString()}/></div>
    <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Shipment history</p>{data.shipments.length ? <div className="mt-2 space-y-2">{data.shipments.map((shipment: any) => <div key={shipment.id} className="rounded-md bg-black/[.035] px-3 py-2 text-xs"><b>{shipment.reference_number}</b><span className="ml-2 text-black/50">{shipment.status} · {shipment.pickup_location} to {shipment.delivery_location}</span></div>)}</div> : <p className="mt-2 text-xs text-black/45">No Operations shipment has been created for this customer.</p>}</div>
    <form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-5 flex gap-2">
      <input disabled={customerBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add customer comment" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/>
      <PendingButton pending={customerBusy} pendingLabel="Posting..." className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton>
    </form>
    <CommentList rows={data.comments} empty="No customer comments yet."/>
  </section>;
}

function QuoteWorkspace({ quoteId, quote, data, api, refresh, report }: { quoteId: string; quote: any; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [handoff, setHandoff] = useState({ operations_department_id: data.operationsDepartments?.[0]?.id ?? "", reference_number: "", customer_name: "" });
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

  return <article className="rounded-md border border-black/8 bg-white">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left">
      <span><b className="text-sm">{quote.pickup_location} to {quote.delivery_location}</b><span className="mt-1 block text-xs text-black/50">{quote.equipment_type || "Equipment not specified"} · {quote.quoted_rate ? "$" + quote.quoted_rate : "Rate pending"}</span></span>
      <span className="rounded-md bg-black/[.05] px-2 py-1 text-[9px] font-bold">{quote.stage}</span>
    </button>
    {open && <div className="border-t border-black/8 p-4">
      {detail.isLoading ? <div className="flex items-center gap-2 text-xs text-black/50"><LoaderCircle size={16} className="animate-spin text-[#f59a18]"/> Loading quote workspace...</div> : detail.data ? <>
        <div className="flex flex-wrap gap-2">
          <PendingButton type="button" pending={actions.isBusy("submit")} pendingLabel="Submitting..." disabled={anyActionBusy || !["DRAFT", "REJECTED"].includes(quoteStage)} onClick={() => act("submit", "/api/v1/brokerage/quotes/" + quoteId + "/submit", "POST", undefined, "Quote submitted for review.")} className="h-8 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-35">Submit for review</PendingButton>
          {data.capabilities?.canReviewQuotes && quoteStage === "SUBMITTED" && <>
            <PendingButton type="button" pending={actions.isBusy("approve")} pendingLabel="Approving..." disabled={anyActionBusy} onClick={() => act("approve", "/api/v1/brokerage/quotes/" + quoteId + "/review", "POST", { action: "APPROVE" }, "Quote approved.")} className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-45">Approve</PendingButton>
            <PendingButton type="button" pending={actions.isBusy("reject")} pendingLabel="Returning..." disabled={anyActionBusy || !reviewNote.trim()} onClick={() => act("reject", "/api/v1/brokerage/quotes/" + quoteId + "/review", "POST", { action: "REJECT", note: reviewNote }, "Quote returned for rework.")} className="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-45">Reject for rework</PendingButton>
          </>}
          {data.capabilities?.canHandoffQuotes && quoteStage === "APPROVED" && <button type="button" disabled={anyActionBusy} onClick={() => document.getElementById("handoff-" + quoteId)?.scrollIntoView({ behavior: "smooth", block: "nearest" })} className="h-8 rounded-md bg-[#f59a18] px-3 text-xs font-bold disabled:opacity-45">Handoff</button>}
        </div>

        {data.capabilities?.canReviewQuotes && quoteStage === "SUBMITTED" && <textarea disabled={anyActionBusy} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Required reason when returning a quote for rework" className="mt-3 min-h-16 w-full rounded-md border border-black/10 p-3 text-sm disabled:opacity-55"/>}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Attachments</p>
            <label className="mt-2 flex h-9 items-center justify-center rounded-md border border-dashed border-black/20 text-xs font-bold disabled:opacity-50">
              Choose PDF or image
              <input disabled={anyActionBusy} className="hidden" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setStagedFile(event.target.files?.[0] ?? null)}/>
            </label>
            {stagedFile && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#f59a18]/30 bg-[#fff7e8] p-3">
              <div className="min-w-0"><p className="truncate text-xs font-semibold">{stagedFile.name}</p><p className="mt-1 text-[10px] text-black/50">Ready to save. This file has not been uploaded yet.</p></div>
              <div className="flex gap-2">
                <button type="button" disabled={anyActionBusy} onClick={() => setStagedFile(null)} className="h-8 rounded-md border border-black/10 px-2 text-[11px] font-bold disabled:opacity-50">Discard</button>
                <PendingButton type="button" pending={actions.isBusy("attachment")} pendingLabel="Saving..." disabled={anyActionBusy && !actions.isBusy("attachment")} onClick={saveAttachment} className="h-8 rounded-md bg-[#191816] px-2 text-[11px] font-bold text-white disabled:opacity-50">Save attachment</PendingButton>
              </div>
            </div>}
            <div className="mt-2 space-y-1">
              {detail.data.attachments.map((attachment: any) => <PendingButton key={attachment.id} type="button" pending={actions.isBusy("download:" + attachment.id)} pendingLabel="Opening..." disabled={anyActionBusy && !actions.isBusy("download:" + attachment.id)} onClick={() => openAttachment(attachment)} className="w-full justify-between rounded-md bg-black/[.035] px-2 py-2 text-left text-xs"><span className="truncate">{attachment.file_name}</span><FileText size={13}/></PendingButton>)}
              {!detail.data.attachments.length && <p className="text-xs text-black/45">No supporting files.</p>}
            </div>
          </div>
          <div><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Revision history</p><Timeline rows={detail.data.events} empty="No quote events yet."/></div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2">
          <input disabled={anyActionBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add review note or internal comment" className="h-9 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-xs disabled:opacity-55"/>
          <PendingButton pending={actions.isBusy("comment")} pendingLabel="Posting..." disabled={anyActionBusy && !actions.isBusy("comment")} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton>
        </form>
        <CommentList rows={detail.data.comments} empty="No quote comments."/>

        {data.capabilities?.canHandoffQuotes && quoteStage === "APPROVED" && <form id={"handoff-" + quoteId} onSubmit={(event) => { event.preventDefault(); act("handoff", "/api/v1/brokerage/quotes/" + quoteId + "/handoff", "POST", handoff, "Quote handed to Operations."); }} className="mt-5 rounded-md bg-[#fff4e4] p-3">
          <p className="text-xs font-bold">Sales to Operations handoff</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <select required disabled={anyActionBusy} value={handoff.operations_department_id} onChange={(event) => setHandoff({ ...handoff, operations_department_id: event.target.value })} className="h-9 rounded-md border border-black/10 bg-white px-2 text-xs disabled:opacity-55"><option value="">Operations department</option>{(data.operationsDepartments ?? []).map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
            <input required disabled={anyActionBusy} value={handoff.reference_number} onChange={(event) => setHandoff({ ...handoff, reference_number: event.target.value })} placeholder="Shipment reference" className="h-9 rounded-md border border-black/10 px-2 text-xs disabled:opacity-55"/>
            <input required disabled={anyActionBusy} value={handoff.customer_name} onChange={(event) => setHandoff({ ...handoff, customer_name: event.target.value })} placeholder="Customer name" className="h-9 rounded-md border border-black/10 px-2 text-xs disabled:opacity-55"/>
          </div>
          <PendingButton pending={actions.isBusy("handoff")} pendingLabel="Creating shipment..." disabled={anyActionBusy && !actions.isBusy("handoff")} className="mt-3 h-9 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-50">Create Operations shipment</PendingButton>
        </form>}
      </> : <p className="text-sm text-red-600">Quote details could not be loaded.</p>}
    </div>}
  </article>;
}

function ReportsWorkspace({ api, report, sales }: { api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void; sales: boolean }) {
  const [range, setRange] = useState({ from: "", to: "" });
  const reports = useQuery({ queryKey: ["brokerage", "reports", range], queryFn: async () => responseData<any>(await api(`/api/v1/brokerage/reports?${new URLSearchParams(Object.entries(range).filter(([, value]) => value) as string[][]).toString()}`)), staleTime: 30_000 });
  const exportCsv = (title: string, rows: any[]) => { if (!rows.length) return report("There is no data in this report to export.", "error"); const columns = Object.keys(rows[0]); const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? "")).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`; link.click(); URL.revokeObjectURL(url); report(`${title} exported as CSV.`); };
  if (reports.isLoading) return <DetailSkeleton/>;
  if (reports.isError || !reports.data) return <Empty title="Reports unavailable" copy={message(reports.error)}/>;
  const data = reports.data; const primary = sales ? data.sales : data.operations;
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Brokerage performance</p><h2 className="mt-2 text-3xl font-semibold">{sales ? "Sales performance" : "Operations and revenue"}</h2></div><div className="flex flex-wrap gap-2"><input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"/><input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"/><button onClick={() => exportCsv(sales ? "Sales report" : "Operations report", primary.rows)} className="h-10 rounded-md bg-[#191816] px-3 text-xs font-bold text-white">Export CSV</button></div></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sales ? <><Metric label="Leads" value={data.sales.totals.leads}/><Metric label="Customers" value={data.sales.totals.customers}/><Metric label="Pipeline value" value={money(data.sales.totals.pipeline_value)}/><Metric label="Quoted value" value={money(data.sales.totals.quoted_value)}/></> : <><Metric label="Shipments" value={data.operations.totals.shipments}/><Metric label="Invoiced" value={money(data.operations.totals.invoiced)}/><Metric label="Paid" value={money(data.operations.totals.paid)}/><Metric label="Outstanding" value={money(data.operations.totals.outstanding)}/></>}</div><div className="mt-7 grid gap-5 xl:grid-cols-2"><ReportTable title={sales ? "Pipeline by stage" : "Shipment status"} values={sales ? data.sales.lead_stages : data.operations.shipment_statuses}/><ReportTable title={sales ? "Quote outcomes" : "Invoice status"} values={sales ? data.sales.quote_stages : data.operations.invoice_statuses}/><ReportTable title={sales ? "Lead ownership" : "Workload by agent"} values={sales ? data.sales.by_agent : data.operations.workload}/><ReportTable title={sales ? "Team performance" : "Customer volume"} values={sales ? data.sales.by_team : data.operations.by_customer}/></div></div>;
}

function NotificationsWorkspace({ data, api, refresh, report }: { data: any[]; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const read = async (item: any) => { try { await responseData(await api(`/api/v1/brokerage/notifications/${item.id}/read`, { method: "PATCH" })); await refresh(); report("Notification marked as read."); } catch (error) { report(message(error), "error"); } };
  return <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Brokerage alerts</p><h2 className="mt-2 text-3xl font-semibold">Notification inbox</h2><div className="mt-7 divide-y overflow-hidden rounded-lg border border-black/8 bg-white">{data.map((item) => <article key={item.id} className={`flex gap-4 p-5 ${item.read_at ? "opacity-65" : "bg-[#fffaf1]"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-black/[.05] text-[#a65c00]"><Bell size={16}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-black/55">{item.body}</p></div>{!item.read_at && <button onClick={() => void read(item)} className="h-8 rounded-md border border-black/10 px-3 text-xs font-bold">Mark read</button>}</div><p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{item.kind.replaceAll("_", " · ")} · {new Date(item.created_at).toLocaleString()}</p></div></article>)}{!data.length && <Empty title="You are up to date" copy="Assignments, approvals, comments, document reviews, exceptions, and overdue invoices will appear here."/>}</div></div>;
}

function Metric({ icon: Icon, label, value }: { icon?: any; label: string; value: string | number }) { return <div className="rounded-lg border border-black/8 bg-white p-5">{Icon && <Icon size={18} className="text-[#a65c00]"/>}<p className={`${Icon ? "mt-4" : ""} text-2xl font-semibold`}>{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{label}</p></div>; }
function ReportTable({ title, values }: { title: string; values: Record<string, number> }) { return <section className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><p className="font-semibold">{title}</p></div><div className="divide-y divide-black/6">{Object.entries(values).map(([key, value]) => <div key={key} className="flex items-center justify-between px-5 py-3 text-sm"><span className="truncate text-black/60">{key.replaceAll("_", " ")}</span><b>{value}</b></div>)}{!Object.keys(values).length && <p className="p-6 text-sm text-black/45">No matching records.</p>}</div></section>; }
function Timeline({ rows, empty }: { rows: any[]; empty: string }) { return <div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="rounded-md bg-black/[.035] px-3 py-2 text-xs"><b>{(row.activity_type ?? row.event_type ?? "EVENT").replaceAll("_", " ")}</b>{row.body && <p className="mt-1 leading-5 text-black/60">{row.body}</p>}{row.due_at && <p className="mt-1 font-semibold text-[#a65c00]">Due {new Date(row.due_at).toLocaleString()}</p>}<p className="mt-1 text-black/35">{new Date(row.created_at).toLocaleString()}</p></div>)}{!rows.length && <p className="mt-3 text-xs text-black/45">{empty}</p>}</div>; }
function CommentList({ rows, empty }: { rows: any[]; empty: string }) { return <div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="rounded-md bg-black/[.035] px-3 py-2 text-xs"><p className="leading-5 text-black/70">{row.body}</p><p className="mt-1 text-black/35">{new Date(row.created_at).toLocaleString()}</p></div>)}{!rows.length && <p className="mt-3 text-xs text-black/45">{empty}</p>}</div>; }
function Input({ label, value, onChange, type = "text", light = false, required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; light?: boolean; required?: boolean }) { return <label className={`block text-xs font-bold ${light ? "text-black/55" : "text-white/65"}`}>{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-2 h-10 w-full rounded-md border px-3 text-sm outline-none ${light ? "border-black/10 bg-white" : "border-white/10 bg-white/5 text-white"}`}/></label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-black/[.035] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-black/40">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div>; }
function SectionTitle({ title, copy }: { title: string; copy: string }) { return <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-black/45">{copy}</p></div>; }
function Empty({ title, copy }: { title: string; copy: string }) { return <div className="p-10 text-center"><MessageSquare className="mx-auto text-[#a65c00]" size={22}/><h3 className="mt-3 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/50">{copy}</p></div>; }
function DetailSkeleton() { return <div className="animate-pulse p-5"><div className="h-5 w-40 rounded bg-black/[.06]"/><div className="mt-3 h-3 w-64 rounded bg-black/[.06]"/><div className="mt-8 grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 rounded bg-black/[.05]"/>)}</div></div>; }
function WorkspaceSkeleton() { return <main className="min-h-screen bg-[#f5f4f0] p-5 lg:p-10"><div className="h-16 animate-pulse rounded-lg bg-white"/><div className="mx-auto mt-8 grid max-w-7xl animate-pulse gap-4 md:grid-cols-3"><div className="h-56 rounded-lg bg-white"/><div className="h-56 rounded-lg bg-white md:col-span-2"/></div></main>; }
function Toast({ notice, dismiss }: { notice: Exclude<Notice, null>; dismiss: () => void }) { const success = notice.tone === "success"; return <div role="status" className={`fixed right-5 top-5 z-50 flex w-[min(390px,calc(100vw-40px))] items-center gap-3 rounded-lg border p-4 shadow-2xl ${success ? "border-emerald-400/30 bg-[#10231d] text-emerald-50" : "border-red-400/30 bg-[#311718] text-red-50"}`}><span className="grid h-8 w-8 place-items-center rounded-md bg-white/10">{success ? <Check size={16}/> : <X size={16}/>}</span><p className="flex-1 text-sm font-medium">{notice.message}</p><button onClick={dismiss} className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"><X size={16}/></button></div>; }
async function responseData<T>(response: Response): Promise<T> { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "The request could not be completed."); return body as T; }
function titleFor(section: string, sales: boolean) { return ({ overview: "Brokerage command center", sales: "Sales workspace", operations: "Operations execution", finance: "Invoice ledger", teams: "Teams and Team Leads", access: "Agent access", reports: sales ? "Sales reports" : "Operations reports", notifications: "Notifications" } as Record<string, string>)[section] ?? "Brokerage"; }
function localInput(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value ?? 0)); }
function message(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }
