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
const editableStages = ["NEW", "CONTACTED", "QUALIFIED", "LOST"];
const stageCopy: Record<string, string> = { NEW: "Not yet contacted", CONTACTED: "Initial contact made", QUALIFIED: "A viable opportunity", CUSTOMER: "Converted customer profile", LOST: "No longer pursuing" };

type Profile = { id: string; full_name: string; email: string; role: string };
type Notice = { tone: "success" | "error"; message: string } | null;

export function BrokerageCommandCenter({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [section, setSection] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const sessionActions = useSingleFlight();

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
    ["customers", UsersRound, "Customers", sales],
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
      <PendingButton type="button" pending={sessionActions.isBusy("signout")} pendingLabel={collapsed ? "..." : "Signing out..."} disabled={sessionActions.isBusy()} onClick={() => void sessionActions.run("signout", async () => { await onSignOut(); })} title="Sign out" className={`mt-auto flex h-10 items-center gap-3 border-t border-white/10 pt-4 text-sm text-white/60 hover:text-white disabled:opacity-55 ${collapsed ? "justify-center" : "px-3"}`}><LogOut size={17}/>{!collapsed && "Sign out"}</PendingButton>
    </aside>
    <section className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-64"}`}>
      <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-black/8 bg-white/95 px-5 backdrop-blur lg:px-9"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Brokerage · {manager ? "Department manager" : teamLead ? "Team lead" : "Agent"}</p><h1 className="mt-1 text-lg font-semibold">{titleFor(section, sales)}</h1></div><div className="flex items-center gap-3"><button disabled={workspace.isFetching} onClick={() => void refresh()} title="Refresh workspace" aria-label="Refresh workspace" className="grid h-9 w-9 place-items-center rounded-md border border-black/10 text-black/55 hover:bg-black/5 disabled:opacity-50"><RefreshCw size={15} className={workspace.isFetching ? "animate-spin" : ""}/></button><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{profile.full_name}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-black/45">{profile.role.replace("_", " ")}</p></div></div></header>
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        {notice && <Toast notice={notice} dismiss={() => setNotice(null)}/>} 
        {section === "overview" && <Overview data={data} sales={sales} setSection={setSection}/>}
        {section === "workflow" && <BrokerageWorkflowGuide sales={sales} manager={manager} teamLead={teamLead} setSection={setSection}/>}
        {section === "sales" && sales && <SalesWorkspace data={data} api={api} refresh={refresh} report={report} onOpenCustomers={() => setSection("customers")}/>}
        {section === "customers" && sales && <CustomerDirectory api={api} report={report}/>}
        {section === "operations" && !sales && <OperationsBoard embedded initialWorkspace={data}/>}
        {section === "finance" && !sales && <InvoiceLedger embedded/>}
        {section === "teams" && manager && <TeamBuilderPanel/>}
        {section === "access" && manager && <DepartmentAccessPanel embedded/>}
        {section === "reports" && <ReportsWorkspace api={api} report={report} sales={sales} canViewTeamPerformance={manager || profile.role === "SUPER_ADMIN"}/>}
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

function SalesWorkspace({ data, api, refresh, report, onOpenCustomers }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers: () => void }) {
  if (data.capabilities?.departmentManager) return <SalesManagerWorkspace data={data} api={api} refresh={refresh} report={report}/>;
  return <SalesAgentWorkspace data={data} api={api} refresh={refresh} report={report} onOpenCustomers={onOpenCustomers}/>;
}

function SalesManagerWorkspace({ data, api, refresh, report }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const [selectedLead, setSelectedLead] = useState<string | null>(data.leads?.[0]?.id ?? null);
  const leads = data.leads ?? [];
  const quotes = data.quotes ?? [];
  const submitted = quotes.filter((quote: any) => quote.stage === "SUBMITTED");
  const approved = quotes.filter((quote: any) => quote.stage === "APPROVED");
  const customers = leads.filter((lead: any) => lead.stage === "CUSTOMER");
  return <div className="space-y-5"><section className="rounded-lg bg-[#191816] p-6 text-white"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Sales manager command view</p><h2 className="mt-2 text-2xl font-semibold">Review the department with a clear decision queue.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Pipeline stage describes the customer relationship. Manager action describes whether a quote needs review, has been returned for rework, or is ready to hand off to Brokerage Operations.</p></div><div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-right"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/45">Approval queue</p><p className="mt-1 text-2xl font-semibold text-[#f59a18]">{submitted.length}</p><p className="text-xs text-white/50">agent-submitted quotes awaiting a decision</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ManagerMetric label="Department leads" value={leads.length}/><ManagerMetric label="Customers" value={customers.length}/><ManagerMetric label="Review required" value={submitted.length}/><ManagerMetric label="Ready for Operations" value={approved.length}/></div></section><div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-4 py-4"><p className="font-semibold">Department pipeline</p><p className="mt-1 text-xs leading-5 text-black/45">Each row shows both the relationship stage and the exact action, if any, required from you. Select a record to open its full review file.</p></div><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-black/8 bg-black/[.025] px-4 py-2 text-[9px] font-bold uppercase tracking-[.1em] text-black/45"><span>Lead</span><span>Manager action</span></div><div className="max-h-[720px] divide-y divide-black/6 overflow-auto">{leads.map((lead: any) => { const state = managerLeadState(quotes.filter((quote: any) => quote.lead_id === lead.id)); return <button key={lead.id} onClick={() => setSelectedLead(lead.id)} className={`w-full px-4 py-4 text-left transition ${selectedLead === lead.id ? "bg-[#fff4e4]" : "hover:bg-black/[.025]"}`}><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{lead.company_name}</p><p className="mt-1 truncate text-xs text-black/50">{lead.contact_name || "No contact name"}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-black/40">Pipeline: {lead.stage}</p></div><div className="max-w-32 text-right"><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${state.tone}`}>{state.label}</span><p className="mt-2 text-[10px] leading-4 text-black/48">{state.copy}</p></div></div></button>; })}{!leads.length && <p className="p-7 text-sm text-black/45">No Sales leads exist in this department yet.</p>}</div></aside><section className="min-w-0 rounded-lg border border-black/8 bg-white">{selectedLead ? <LeadDetail leadId={selectedLead} data={data} api={api} refresh={refresh} report={report}/> : <Empty title="Select a department lead" copy="Choose a lead to open its complete commercial record and manager decision controls."/>}</section></div></div>;
}

function managerLeadState(quotes: any[]) {
  if (quotes.some((quote) => quote.stage === "SUBMITTED")) return { label: "REVIEW REQUIRED", copy: "Agent submitted a quote for approval.", tone: "bg-amber-100 text-amber-800" };
  if (quotes.some((quote) => quote.stage === "APPROVED")) return { label: "HANDOFF REQUIRED", copy: "Approved quote is ready for Operations.", tone: "bg-emerald-100 text-emerald-800" };
  if (quotes.some((quote) => quote.stage === "REJECTED")) return { label: "AGENT REWORK", copy: "Waiting for the agent to revise and resubmit.", tone: "bg-red-50 text-red-700" };
  if (quotes.some((quote) => quote.stage === "HANDED_OFF")) return { label: "WITH OPERATIONS", copy: "The approved work has been handed off.", tone: "bg-sky-50 text-sky-700" };
  if (quotes.some((quote) => quote.stage === "DRAFT")) return { label: "AGENT DRAFT", copy: "The agent has not submitted this quote yet.", tone: "bg-black/[.05] text-black/60" };
  return { label: "NO MANAGER ACTION", copy: "No quote has been submitted yet.", tone: "bg-black/[.05] text-black/60" };
}

function ManagerMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{label}</p></div>; }

function SalesAgentWorkspace({ data, api, refresh, report, onOpenCustomers }: { data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers: () => void }) {
  const [selectedLead, setSelectedLead] = useState<string | null>(data.leads?.[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" });
  const createLead = async (event: FormEvent) => { event.preventDefault(); if (creating) return; setCreating(true); try { await responseData(await api("/api/v1/brokerage/leads", { method: "POST", body: JSON.stringify({ ...form, estimated_monthly_value: form.estimated_monthly_value ? Number(form.estimated_monthly_value) : undefined, next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : undefined }) })); setForm({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" }); await refresh(); report("Lead created and added to the pipeline."); } catch (error) { report(message(error), "error"); } finally { setCreating(false); } };
  return <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className="space-y-5"><form onSubmit={createLead} className="rounded-lg bg-[#191816] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">New customer lead</p><h2 className="mt-2 text-xl font-semibold">Build the pipeline.</h2><fieldset disabled={creating} className="mt-5 space-y-3 disabled:opacity-55"><Input label="Company name" value={form.company_name} onChange={(company_name) => setForm({ ...form, company_name })}/><Input label="Contact name" value={form.contact_name} onChange={(contact_name) => setForm({ ...form, contact_name })}/><Input label="Contact email" type="email" required={false} value={form.contact_email} onChange={(contact_email) => setForm({ ...form, contact_email })}/><Input label="Phone" required={false} value={form.contact_phone} onChange={(contact_phone) => setForm({ ...form, contact_phone })}/><Input label="Source" required={false} value={form.source} onChange={(source) => setForm({ ...form, source })}/><Input label="Estimated monthly value" required={false} type="number" value={form.estimated_monthly_value} onChange={(estimated_monthly_value) => setForm({ ...form, estimated_monthly_value })}/><Input label="Next follow-up" required={false} type="datetime-local" value={form.next_follow_up_at} onChange={(next_follow_up_at) => setForm({ ...form, next_follow_up_at })}/><button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black">{creating && <LoaderCircle size={15} className="animate-spin"/>}{creating ? "Creating lead..." : "Create lead"}</button></fieldset></form><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-4 py-3"><p className="text-sm font-semibold">Pipeline</p><p className="mt-1 text-xs text-black/45">Select a lead to manage its customer journey.</p></div><div className="max-h-[650px] divide-y divide-black/6 overflow-auto">{(data.leads ?? []).map((lead: any) => <button key={lead.id} onClick={() => setSelectedLead(lead.id)} className={`w-full px-4 py-4 text-left transition ${selectedLead === lead.id ? "bg-[#fff4e4]" : "hover:bg-black/[.025]"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{lead.company_name}</p><span className="rounded-md bg-black/[.05] px-2 py-1 text-[9px] font-bold tracking-wide">{lead.stage}</span></div><p className="mt-1 truncate text-xs text-black/50">{lead.contact_name || "No contact name"}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#a65c00]">{lead.next_follow_up_at ? `Follow-up ${new Date(lead.next_follow_up_at).toLocaleDateString()}` : "No follow-up set"}</p></button>)}{!(data.leads ?? []).length && <p className="p-7 text-sm text-black/45">No leads in your current scope.</p>}</div></div></aside><section className="min-w-0 rounded-lg border border-black/8 bg-white">{selectedLead ? <LeadDetail leadId={selectedLead} data={data} api={api} refresh={refresh} report={report} onOpenCustomers={onOpenCustomers}/> : <Empty title="Select a lead" copy="Choose a pipeline record to update its details, record activities, and manage converted customers from the Customer workspace."/>}</section></div>;
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
  const deleteComment = (commentId: string) => void act("/api/v1/brokerage/comments/" + commentId, "DELETE", undefined, "Comment deleted.");

  return <div>
    <header className="border-b border-black/8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a65c00]">Manager review workspace</p><h2 className="mt-1 text-2xl font-semibold">{lead.company_name}</h2><p className="mt-2 text-sm text-black/50">{lead.contact_name || "No contact name"}{lead.contact_email && <>{ " · " }{lead.contact_email}</>}</p></div>
        <div className="flex items-center gap-2">
          <span title={stageCopy[lead.stage]} className="rounded-md bg-black/[.05] px-3 py-2 text-[10px] font-bold tracking-[.12em] text-black/60">PIPELINE · {lead.stage}</span>
          <PendingButton type="button" pending={leadBusy} pendingLabel="Saving..." onClick={() => void act(leadPath, "PATCH", { archived_at: lead.archived_at ? null : new Date().toISOString() }, lead.archived_at ? "Lead restored." : "Lead archived.")} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">{lead.archived_at ? "Restore" : "Archive"}</PendingButton>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><ReviewMetric label="Awaiting quote approval" value={submitted}/><ReviewMetric label="Approved, ready to hand off" value={approved}/><ReviewMetric label="Operations handoffs" value={handedOff}/></div>
    </header>
    <div className="grid gap-6 p-5 2xl:grid-cols-[.85fr_1.15fr]">
      <div className="space-y-6">
        <section className="rounded-lg bg-[#191816] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#f59a18]">Your decision path</p><ol className="mt-4 space-y-3 text-sm leading-6 text-white/65"><li><b className="text-white">1. Review:</b> open a submitted quote below and verify the rate and supporting files.</li><li><b className="text-white">2. Decide:</b> approve it or return it with a required rework reason.</li><li><b className="text-white">3. Handoff:</b> open an approved quote and create the Operations shipment.</li></ol></section>
        <section><SectionTitle title="Complete lead record" copy="Every available customer and commercial detail is visible before you make a quote decision."/><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Company" value={lead.company_name || "Not supplied"}/><Info label="Pipeline stage" value={lead.stage || "Not supplied"}/><Info label="Contact" value={lead.contact_name || "Not supplied"}/><Info label="Email" value={lead.contact_email || "Not supplied"}/><Info label="Phone" value={lead.contact_phone || "Not supplied"}/><Info label="Source" value={lead.source || "Not supplied"}/><Info label="Forecast" value={lead.estimated_monthly_value ? money(lead.estimated_monthly_value) : "Not supplied"}/><Info label="Next follow-up" value={lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : "Not scheduled"}/></div>{lead.notes && <div className="mt-4 rounded-md bg-black/[.035] p-3"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-black/45">Lead notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/65">{lead.notes}</p></div>}</section>
        <section className="border-t border-black/8 pt-6"><SectionTitle title="Agent activity history" copy="Calls, follow-ups, appointments, and notes recorded against this lead."/><Timeline rows={detail.data.activities ?? []} empty="No activities have been recorded."/></section>
      </div>
      <div className="space-y-6">
        <section className="rounded-lg border border-[#f59a18]/35 bg-[#fffaf1] p-5"><SectionTitle title="Quote approval and Operations handoff" copy="Open the submitted quote to inspect its shipment terms and documents. Managers approve or return it for rework; only an approved quote can be sent to Brokerage Operations."/><div className="mt-4 space-y-3">{quotes.map((quote: any) => <QuoteWorkspace key={quote.id} quoteId={quote.id} quote={quote} data={data} api={api} refresh={refreshLead} report={report}/>)}{!quotes.length && <p className="rounded-md border border-dashed border-black/15 bg-white px-4 py-5 text-sm text-black/50">No quote exists for this lead yet. There is nothing for the manager to approve until the Sales Agent creates and submits a shipment quote.</p>}</div></section>
        <section className="border-t border-black/8 pt-6"><SectionTitle title="Manager comments" copy="Leave direction or an approval note visible to people working this lead."/><form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2"><input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add direction for the Sales Agent" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/><PendingButton pending={commentBusy} pendingLabel="Posting..." className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton></form><CommentList rows={detail.data.comments ?? []} empty="No comments yet." onDelete={deleteComment} busy={actions.isBusy}/></section>
      </div>
    </div>
  </div>;
}

function ReviewMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md bg-black/[.035] p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-black/40">{label}</p></div>; }

function LeadDetail({ leadId, data, api, refresh, report, onOpenCustomers }: { leadId: string; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void; onOpenCustomers?: () => void }) {
  if (data.capabilities?.departmentManager) return <ManagerLeadReview leadId={leadId} data={data} api={api} refresh={refresh} report={report}/>;

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
      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a65c00]">Sales detail workspace</p><h2 className="mt-1 text-2xl font-semibold">{lead.company_name}</h2><p className="mt-2 text-sm text-black/50">{lead.contact_name || "No contact name"}{lead.contact_email && <>{ " · " }{lead.contact_email}</>}</p></div>
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
          <PendingButton type="button" pending={leadBusy} pendingLabel="Updating lead..." onClick={() => void perform(leadPath, "PATCH", { company_name: leadForm.company_name, contact_name: leadForm.contact_name, contact_email: leadForm.contact_email, contact_phone: leadForm.contact_phone, source: leadForm.source, estimated_monthly_value: leadForm.estimated_monthly_value === "" ? null : Number(leadForm.estimated_monthly_value), next_follow_up_at: leadForm.next_follow_up_at ? new Date(leadForm.next_follow_up_at).toISOString() : null }, "Lead information updated.")} className="mt-4 h-9 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-50">Update lead information</PendingButton>
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
        <section className="rounded-lg bg-[#191816] p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Customer conversion</p>
          <h3 className="mt-2 text-lg font-semibold">Move an approved relationship forward.</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Conversion opens the customer workspace with contact information, history, shipment progress, and customer comments.</p>
          <PendingButton type="button" pending={convertBusy} pendingLabel="Creating customer..." onClick={() => void perform(leadPath + "/convert", "POST", undefined, "Customer workspace created.")} className="mt-5 h-10 rounded-md bg-[#f59a18] px-4 text-sm font-bold text-black disabled:opacity-50">{detail.data.customer ? "Refresh customer" : "Convert to customer"}</PendingButton>
        </section>

        {detail.data.customer ? <CustomerWorkspace customerId={detail.data.customer.id} api={api} report={report}/> : <section className="rounded-lg border border-dashed border-black/15 p-5"><SectionTitle title="Commercial shipment workspace" copy="Convert the qualified lead to a customer first. The shipment form, rates, dates, status, follow-ups, and customer notes will then appear here in Sales Workspace."/></section>}
      </div>
    </div>
  </div>;
}

function CustomerWorkspace({ customerId, api, report, readOnly = false }: { customerId: string; api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void; readOnly?: boolean }) {
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

  if (customer.isLoading) return <div className="rounded-lg border border-black/8 p-5"><LoaderCircle className="animate-spin text-[#f59a18]" size={17}/></div>;
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
    {canEdit && <PendingButton type="button" pending={customerBusy} pendingLabel="Saving customer..." disabled={actions.isBusy() && !customerBusy} onClick={saveCustomer} className="mt-4 h-9 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-50">Save customer details</PendingButton>}

    <section className="mt-7 border-t border-black/8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><SectionTitle title={readOnly ? "Shipment history" : "Shipment desk"} copy={readOnly ? "Commercial shipment records are visible here for context. Their creation, editing, and status changes happen in Sales Workspace." : "Create and edit commercial shipment records here. Set the initial status in the form, then use the table dropdown for later updates."}/>{canEdit && <button type="button" onClick={() => { setShowNewShipment((value) => !value); setSelectedShipmentId(null); }} className="h-9 cursor-pointer rounded-md border border-black/10 px-3 text-xs font-bold transition hover:border-[#f59a18] hover:bg-[#fff4e4]">{showNewShipment ? "Close shipment form" : data.shipments.length ? "Add another shipment" : "Add shipment"}</button>}</div>
      {(showNewShipment || !data.shipments.length) && canEdit && <div className="mt-4 rounded-md border border-[#f59a18]/35 bg-[#fffaf1] p-4"><SalesShipmentForm customerId={customerId} api={api} report={report} onSaved={() => { setShowNewShipment(false); reload(); }}/></div>}
      <div className="mt-4 overflow-hidden rounded-md border border-black/8"><div className="grid grid-cols-[1.2fr_.9fr_.7fr] gap-3 border-b border-black/8 bg-black/[.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] text-black/45"><span>Shipment</span><span>Status</span><span>Rate</span></div>{data.shipments.length ? data.shipments.map((shipment: any) => { const quote = quotesById.get(shipment.quote_id); const canSubmit = canEdit && quote && ["DRAFT", "REJECTED"].includes(quote.stage); return <div key={shipment.id} className={`grid grid-cols-[1.2fr_.9fr_.7fr] gap-3 px-3 py-3 text-left text-xs transition ${selectedShipmentId === shipment.id ? "bg-[#fff4e4]" : "hover:bg-black/[.025]"}`}><button type="button" onClick={() => { setSelectedShipmentId(shipment.id); setShowNewShipment(false); }} className="min-w-0 cursor-pointer text-left"><b className="block truncate">{shipment.reference_number}</b><span className="mt-1 block truncate text-black/50">{shipment.pickup_location} to {shipment.delivery_location}</span></button><div>{canEdit ? <select aria-label={`Update status for ${shipment.reference_number}`} disabled={actions.isBusy("shipment-status:" + shipment.id)} value={shipment.sales_status ?? shipment.status} onChange={(event) => updateShipmentStatus(shipment, event.target.value)} className="h-8 cursor-pointer rounded-md border border-black/10 bg-white px-2 text-[10px] font-bold text-[#a65c00] disabled:cursor-wait disabled:opacity-55"><option>QUOTED</option><option>BOOKED</option><option>DELIVERED</option><option>PAID</option></select> : <span className="font-bold text-[#a65c00]">{shipment.sales_status ?? shipment.status}</span>}{canSubmit && <PendingButton type="button" pending={actions.isBusy("shipment-review:" + shipment.id)} pendingLabel="Submitting..." onClick={() => submitShipmentForReview(shipment)} className="mt-2 h-7 rounded-md border border-black/10 px-2 text-[9px] font-bold hover:bg-black/[.03]">Submit review</PendingButton>}{quote?.stage === "SUBMITTED" && <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-amber-700">Awaiting review</p>}{quote?.stage === "APPROVED" && <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Approved</p>}</div><div><span className="block">{money(shipment.amount_quoted)}</span>{shipment.amount_agreed != null && <span className="mt-1 block text-black/45">Agreed {money(shipment.amount_agreed)}</span>}</div></div>; }) : <p className="p-5 text-sm text-black/45">No commercial shipments have been added yet.</p>}</div>
      {selectedShipment && <div className="mt-4 rounded-md border border-black/8 bg-white p-4">{canEdit ? <SalesShipmentForm customerId={customerId} shipment={selectedShipment} api={api} report={report} onSaved={reload} onClose={() => setSelectedShipmentId(null)}/> : <div><p className="text-xs font-bold">Commercial shipment details</p><p className="mt-2 text-sm">{selectedShipment.pickup_location} to {selectedShipment.delivery_location}</p><p className="mt-1 text-xs text-black/50">{selectedShipment.sales_status ?? selectedShipment.status} · {money(selectedShipment.amount_quoted)}</p></div>}</div>}
    </section>

    <section className="mt-7 grid gap-6 border-t border-black/8 pt-6 xl:grid-cols-2"><div><SectionTitle title="Follow-up history" copy={readOnly ? "A historical view of customer activity. Add or manage follow-ups from Sales Workspace." : "Pending items need attention; completed items are retained as the customer history."}/><Timeline rows={data.activities ?? []} empty="No customer follow-ups have been recorded." onComplete={canEdit ? updateActivity : undefined} onDelete={canEdit ? deleteActivity : undefined} busy={actions.isBusy}/></div><div><SectionTitle title="Customer notes" copy={readOnly ? "A historical view of Sales notes. Add or manage notes from Sales Workspace." : "Keep account context visible to everyone with access to this customer."}/>{canEdit && <form onSubmit={(event) => { event.preventDefault(); postComment(); }} className="mt-4 flex gap-2"><input disabled={commentBusy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add customer comment" className="h-10 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-sm disabled:opacity-55"/><PendingButton pending={commentBusy} pendingLabel="Posting..." disabled={actions.isBusy() && !commentBusy} className="h-10 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Post</PendingButton></form>}<CommentList rows={data.comments} empty="No customer comments yet." onDelete={canEdit ? removeComment : undefined} busy={actions.isBusy}/></div></section>
  </section>;
}

function SalesShipmentForm({ customerId, shipment, api, report, onSaved, onClose }: { customerId: string; shipment?: any; api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void; onSaved: () => void; onClose?: () => void }) {
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
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{shipment ? "Edit commercial shipment" : "New commercial shipment"}</p><p className="mt-1 text-xs text-black/45">The shipment holds the commercial fields. A linked quote record is created automatically for the Manager approval workflow.</p></div>{onClose && <button type="button" onClick={onClose} className="cursor-pointer text-xs font-bold text-black/50 hover:text-black">Close</button>}</div><fieldset disabled={busy} className="mt-4 grid gap-3 disabled:opacity-55 sm:grid-cols-2"><Input light label="Reference number" value={form.reference_number} onChange={(reference_number) => setForm({ ...form, reference_number })}/><Input light label="Pickup" value={form.pickup_location} onChange={(pickup_location) => setForm({ ...form, pickup_location })}/><Input light label="Delivery" value={form.delivery_location} onChange={(delivery_location) => setForm({ ...form, delivery_location })}/><Input light label="Equipment" required={false} value={form.equipment_type} onChange={(equipment_type) => setForm({ ...form, equipment_type })}/><Input light label="Quoted rate" required={false} type="number" value={String(form.quoted_rate)} onChange={(quoted_rate) => setForm({ ...form, quoted_rate })}/><Input light label="Agreed rate" required={false} type="number" value={String(form.agreed_rate)} onChange={(agreed_rate) => setForm({ ...form, agreed_rate })}/><Input light label="Pickup date" required={false} type="date" value={form.pickup_date} onChange={(pickup_date) => setForm({ ...form, pickup_date })}/><Input light label="Delivery date" required={false} type="date" value={form.delivery_date} onChange={(delivery_date) => setForm({ ...form, delivery_date })}/><label className="grid gap-1 text-xs font-semibold text-black/65"><span>Commercial status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"><option>QUOTED</option><option>BOOKED</option><option>DELIVERED</option><option>PAID</option></select></label><label className="grid gap-1 text-xs font-semibold text-black/65 sm:col-span-2"><span>Supporting document <em className="font-normal text-black/40">optional, PDF or image</em></span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setSupportingFile(event.target.files?.[0] ?? null)} className="block h-10 w-full cursor-pointer rounded-md border border-black/10 bg-white px-3 py-2 text-xs file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-bold"/>{supportingFile && <span className="text-[11px] font-medium text-[#a65c00]">{supportingFile.name} will upload when you save this shipment.</span>}</label></fieldset><PendingButton type="button" pending={busy} pendingLabel={shipment ? "Saving shipment..." : "Adding shipment..."} onClick={save} className="mt-4 h-9 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-50">{shipment ? "Save shipment details" : "Add shipment"}</PendingButton></div>;
}

function CustomerDirectory({ api, report }: { api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void }) {
  const customers = useQuery({ queryKey: ["brokerage", "customers"], queryFn: async () => responseData<any>(await api("/api/v1/brokerage/customers")), staleTime: 20_000 });
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => { if (!selectedCustomer && customers.data?.customers?.[0]?.id) setSelectedCustomer(customers.data.customers[0].id); }, [customers.data, selectedCustomer]);
  if (customers.isLoading) return <DetailSkeleton/>;
  if (customers.isError || !customers.data) return <Empty title="Customers unavailable" copy={message(customers.error)}/>;
  const filtered = customers.data.customers.filter((customer: any) => `${customer.company_name} ${customer.contact_name ?? ""} ${customer.contact_email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 p-4"><p className="font-semibold">Customer directory</p><p className="mt-1 text-xs text-black/45">Only customers in your permitted Sales scope appear here.</p><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" className="mt-4 h-10 w-full rounded-md border border-black/10 px-3 text-sm"/></div><div className="max-h-[680px] divide-y divide-black/6 overflow-auto">{filtered.map((customer: any) => <button key={customer.id} type="button" onClick={() => setSelectedCustomer(customer.id)} className={`w-full px-4 py-4 text-left transition ${selectedCustomer === customer.id ? "bg-[#fff4e4]" : "hover:bg-black/[.025]"}`}><p className="text-sm font-semibold">{customer.company_name}</p><p className="mt-1 truncate text-xs text-black/50">{customer.contact_name || "No contact"}{customer.contact_email ? ` · ${customer.contact_email}` : ""}</p></button>)}{!filtered.length && <p className="p-6 text-sm text-black/45">No customers match this search.</p>}</div></aside><div>{selectedCustomer ? <CustomerWorkspace customerId={selectedCustomer} api={api} report={report} readOnly/> : <Empty title="Select a customer" copy="Choose a customer to view their contact record, shipment history, follow-ups, and notes. Make changes from Sales Workspace."/>}</div></div>;
}

function QuoteWorkspace({ quoteId, quote, data, api, refresh, report }: { quoteId: string; quote: any; data: any; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
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
      {detail.isLoading ? <div className="flex items-center gap-2 text-xs text-black/50"><LoaderCircle size={16} className="animate-spin text-[#f59a18]"/> Loading quote workspace...</div> : detail.data ? <>
        <div className="flex flex-wrap gap-2">
          {!managerReview && <PendingButton type="button" pending={actions.isBusy("submit")} pendingLabel="Submitting..." disabled={anyActionBusy || !["DRAFT", "REJECTED"].includes(quoteStage)} onClick={() => act("submit", "/api/v1/brokerage/quotes/" + quoteId + "/submit", "POST", undefined, "Quote submitted for review.")} className="h-8 rounded-md bg-[#191816] px-3 text-xs font-bold text-white disabled:opacity-35">Submit for review</PendingButton>}
          {managerReview && quoteStage === "SUBMITTED" && <>
            <PendingButton type="button" pending={actions.isBusy("reject")} pendingLabel="Returning..." disabled={anyActionBusy || !reviewNote.trim()} onClick={() => act("reject", "/api/v1/brokerage/quotes/" + quoteId + "/review", "POST", { action: "REJECT", note: reviewNote }, "Quote returned for rework.")} className="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-45">Reject for rework</PendingButton>
            <PendingButton type="button" pending={actions.isBusy("approve")} pendingLabel="Approving..." disabled={anyActionBusy} onClick={() => approve()} className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-45">Approve</PendingButton>
            <PendingButton type="button" pending={actions.isBusy("approve-handoff")} pendingLabel="Approving..." disabled={anyActionBusy} onClick={() => approve(true)} className="h-8 rounded-md bg-[#f59a18] px-3 text-xs font-bold text-black disabled:opacity-45">Approve &amp; hand off</PendingButton>
          </>}
          {data.capabilities?.canHandoffQuotes && quoteStage === "APPROVED" && <button type="button" disabled={anyActionBusy} onClick={() => setHandoffOpen((value) => !value)} className="h-8 cursor-pointer rounded-md bg-[#f59a18] px-3 text-xs font-bold disabled:opacity-45">{handoffOpen ? "Close handoff" : "Send to Operations"}</button>}
        </div>

        {data.capabilities?.canReviewQuotes && quoteStage === "SUBMITTED" && <textarea disabled={anyActionBusy} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Required reason when returning a quote for rework" className="mt-3 min-h-16 w-full rounded-md border border-black/10 p-3 text-sm disabled:opacity-55"/>}

        {data.capabilities?.canHandoffQuotes && quoteStage === "APPROVED" && handoffOpen && <form id={"handoff-" + quoteId} onSubmit={(event) => { event.preventDefault(); act("handoff", "/api/v1/brokerage/quotes/" + quoteId + "/handoff", "POST", handoff, "Quote handed to Operations."); }} className="mt-4 rounded-md border border-[#f59a18]/45 bg-[#fff4e4] p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold">Send approved quote to Operations</p><p className="mt-1 max-w-2xl text-xs leading-5 text-black/60">Choose the receiving Brokerage Operations department. Its manager is notified and assigns the shipment to an Operations Agent or team.</p></div><span className="rounded-md bg-[#f59a18] px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-black">Step 2 of 2</span></div>
          <div className="mt-4 max-w-xl space-y-3">
            <label className="grid gap-1 text-xs font-semibold text-black/65"><span>Receiving department</span><select required disabled={anyActionBusy} value={handoff.operations_department_id} onChange={(event) => setHandoff({ ...handoff, operations_department_id: event.target.value })} className="h-10 w-full cursor-pointer rounded-md border border-black/10 bg-white px-3 text-sm disabled:opacity-55"><option value="">Choose Brokerage Operations</option>{(data.operationsDepartments ?? []).map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-semibold text-black/65"><span>Shipment reference</span><input required disabled={anyActionBusy} value={handoff.reference_number} onChange={(event) => setHandoff({ ...handoff, reference_number: event.target.value })} placeholder="e.g. DG-2026-001" className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm disabled:opacity-55"/></label>
            <label className="grid gap-1 text-xs font-semibold text-black/65"><span>Customer name</span><input required disabled={anyActionBusy} value={handoff.customer_name} onChange={(event) => setHandoff({ ...handoff, customer_name: event.target.value })} placeholder="Customer company" className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm disabled:opacity-55"/></label>
          </div>
          <PendingButton pending={actions.isBusy("handoff")} pendingLabel="Creating shipment..." disabled={anyActionBusy && !actions.isBusy("handoff")} className="mt-4 h-10 rounded-md bg-[#191816] px-4 text-xs font-bold text-white disabled:opacity-50">Confirm Operations handoff</PendingButton>
        </form>}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-black/8 p-3">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Attachments</p><span className="text-[10px] text-black/40">{detail.data.attachments.length} file{detail.data.attachments.length === 1 ? "" : "s"}</span></div>
            {!managerReview && <label className="mt-2 flex h-9 items-center justify-center rounded-md border border-dashed border-black/20 text-xs font-bold disabled:opacity-50">
              Choose PDF or image
              <input disabled={anyActionBusy} className="hidden" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setStagedFile(event.target.files?.[0] ?? null)}/>
            </label>}
            {!managerReview && stagedFile && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#f59a18]/30 bg-[#fff7e8] p-3">
              <div className="min-w-0"><p className="truncate text-xs font-semibold">{stagedFile.name}</p><p className="mt-1 text-[10px] text-black/50">Ready to save. This file has not been uploaded yet.</p></div>
              <div className="flex gap-2">
                <button type="button" disabled={anyActionBusy} onClick={() => setStagedFile(null)} className="h-8 rounded-md border border-black/10 px-2 text-[11px] font-bold disabled:opacity-50">Discard</button>
                <PendingButton type="button" pending={actions.isBusy("attachment")} pendingLabel="Saving..." disabled={anyActionBusy && !actions.isBusy("attachment")} onClick={saveAttachment} className="h-8 rounded-md bg-[#191816] px-2 text-[11px] font-bold text-white disabled:opacity-50">Save attachment</PendingButton>
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

function ReportsWorkspace({ api, report, sales, canViewTeamPerformance }: { api: (path: string, init?: RequestInit) => Promise<Response>; report: (message: string, tone?: "success" | "error") => void; sales: boolean; canViewTeamPerformance: boolean }) {
  const [range, setRange] = useState({ from: "", to: "", agent_id: "" });
  const reports = useQuery({ queryKey: ["brokerage", "reports", range], queryFn: async () => responseData<any>(await api(`/api/v1/brokerage/reports?${new URLSearchParams(Object.entries(range).filter(([, value]) => value) as string[][]).toString()}`)), staleTime: 30_000 });
  const exportCsv = (title: string, rows: any[]) => { if (!rows.length) return report("There is no data in this report to export.", "error"); const readable = rows.map((row) => ({ "Shipment reference": row.reference_number ?? "", Customer: row.customer_name ?? row.company_name ?? "", Pickup: row.pickup_location ?? "", Delivery: row.delivery_location ?? "", Equipment: row.equipment_type ?? "", "Quoted rate": row.amount_quoted ?? row.quoted_rate ?? "", "Agreed rate": row.amount_agreed ?? "", "Commercial status": row.sales_status ?? row.status ?? "", "Pickup date": row.pickup_date ?? "", "Delivery date": row.delivery_date ?? "", "Created date": row.created_at ? new Date(row.created_at).toLocaleString() : "", "Last updated": row.updated_at ? new Date(row.updated_at).toLocaleString() : row.created_at ? new Date(row.created_at).toLocaleString() : "" })); const columns = Object.keys(readable[0]); const csv = [columns.join(","), ...readable.map((row) => columns.map((column) => JSON.stringify(row[column as keyof typeof row] ?? "")).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`; link.click(); URL.revokeObjectURL(url); report(`${title} exported as CSV without internal IDs.`); };
  if (reports.isLoading) return <DetailSkeleton/>;
  if (reports.isError || !reports.data) return <Empty title="Reports unavailable" copy={message(reports.error)}/>;
  const data = reports.data; const primary = sales ? data.sales : data.operations;
  const exportRows = sales ? primary.shipment_rows : primary.rows;
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">{sales ? canViewTeamPerformance ? "Brokerage performance" : "Your sales results" : "Brokerage performance"}</p><h2 className="mt-2 text-3xl font-semibold">{sales ? canViewTeamPerformance ? "Sales performance" : "Agent performance" : "Operations and revenue"}</h2></div><div className="flex flex-wrap gap-2"><input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"/><input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"/>{sales && canViewTeamPerformance && (data.sales.agents ?? []).length > 1 && <select value={range.agent_id} onChange={(event) => setRange({ ...range, agent_id: event.target.value })} className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"><option value="">All permitted agents</option>{data.sales.agents.map((agent: any) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select>}<button onClick={() => exportCsv(sales ? "Sales agent shipments" : "Operations report", exportRows)} className="h-10 cursor-pointer rounded-md bg-[#191816] px-3 text-xs font-bold text-white transition hover:bg-black">Export CSV</button></div></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{sales ? canViewTeamPerformance ? <><Metric label="Leads" value={data.sales.totals.leads}/><Metric label="Customers" value={data.sales.totals.customers}/><Metric label="Shipments" value={data.sales.totals.shipments}/><Metric label="Gross generated" value={money(data.sales.totals.gross_generated)}/><Metric label="Quoted value" value={money(data.sales.totals.quoted_value)}/></> : <><Metric label="Customers onboarded" value={data.sales.totals.customers}/><Metric label="Shipments created" value={data.sales.totals.shipments}/><Metric label="Gross generated" value={money(data.sales.totals.gross_generated)}/><Metric label="Quoted value" value={money(data.sales.totals.quoted_value)}/><Metric label="Agreed value" value={money(data.sales.totals.agreed_value)}/></> : <><Metric label="Shipments" value={data.operations.totals.shipments}/><Metric label="Invoiced" value={money(data.operations.totals.invoiced)}/><Metric label="Paid" value={money(data.operations.totals.paid)}/><Metric label="Outstanding" value={money(data.operations.totals.outstanding)}/></>}</div>{sales && !canViewTeamPerformance ? <div className="mt-7 space-y-5"><AgentShipmentReport rows={data.sales.shipment_rows}/><ReportTable title="Shipment status" values={data.sales.shipment_statuses}/></div> : <div className="mt-7 grid gap-5 xl:grid-cols-2">{sales ? <><ReportTable title="Pipeline by stage" values={data.sales.lead_stages}/><ReportTable title="Quote outcomes" values={data.sales.quote_stages}/><ReportTable title="Shipment status" values={data.sales.shipment_statuses}/><ReportTable title="Customer outcomes" values={data.sales.customer_outcomes}/><ReportTable title="Opportunities by agent" values={data.sales.by_agent}/><ReportTable title="Team performance" values={data.sales.by_team}/></> : <><ReportTable title="Shipment status" values={data.operations.shipment_statuses}/><ReportTable title="Invoice status" values={data.operations.invoice_statuses}/><ReportTable title="Workload by agent" values={data.operations.workload}/><ReportTable title="Customer volume" values={data.operations.by_customer}/></>}</div>}</div>;
}

function AgentShipmentReport({ rows }: { rows: any[] }) {
  return <section className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><p className="font-semibold">My shipment report</p><p className="mt-1 text-xs text-black/45">Your own customer shipment records. This is the detailed data included in the CSV export.</p></div><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-xs"><thead className="bg-black/[.025] text-[10px] font-bold uppercase tracking-[.1em] text-black/45"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Lane</th><th className="px-4 py-3">Equipment</th><th className="px-4 py-3">Quoted</th><th className="px-4 py-3">Agreed</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Dates</th></tr></thead><tbody className="divide-y divide-black/6">{rows.map((row: any) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.reference_number}</td><td className="px-4 py-3">{row.customer_name}</td><td className="px-4 py-3">{row.pickup_location} to {row.delivery_location}</td><td className="px-4 py-3">{row.equipment_type || "-"}</td><td className="px-4 py-3">{money(row.amount_quoted)}</td><td className="px-4 py-3">{row.amount_agreed == null ? "-" : money(row.amount_agreed)}</td><td className="px-4 py-3 font-bold text-[#a65c00]">{row.sales_status}</td><td className="px-4 py-3">{row.pickup_date || "-"} to {row.delivery_date || "-"}</td></tr>)}{!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-black/45">No shipments match this reporting period.</td></tr>}</tbody></table></div></section>;
}

function NotificationsWorkspace({ data, api, refresh, report }: { data: any[]; api: (path: string, init?: RequestInit) => Promise<Response>; refresh: () => Promise<void>; report: (message: string, tone?: "success" | "error") => void }) {
  const actions = useSingleFlight();
  const read = (item: any) => void actions.run("read:" + item.id, async () => {
    try {
      await responseData(await api("/api/v1/brokerage/notifications/" + item.id + "/read", { method: "PATCH" }));
      void refresh();
      report("Notification marked as read.");
    } catch (error) {
      report(message(error), "error");
    }
  });

  return <div>
    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Brokerage alerts</p>
    <h2 className="mt-2 text-3xl font-semibold">Notification inbox</h2>
    <div className="mt-7 divide-y overflow-hidden rounded-lg border border-black/8 bg-white">
      {data.map((item) => <article key={item.id} className={"flex gap-4 p-5 " + (item.read_at ? "opacity-65" : "bg-[#fffaf1]")}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-black/[.05] text-[#a65c00]"><Bell size={16}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-black/55">{item.body}</p></div>
            {!item.read_at && <PendingButton type="button" pending={actions.isBusy("read:" + item.id)} pendingLabel="Marking..." disabled={actions.isBusy() && !actions.isBusy("read:" + item.id)} onClick={() => read(item)} className="h-8 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">Mark read</PendingButton>}
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{item.kind.replaceAll("_", " · ")} · {new Date(item.created_at).toLocaleString()}</p>
        </div>
      </article>)}
      {!data.length && <Empty title="You are up to date" copy="Assignments, approvals, comments, document reviews, exceptions, and overdue invoices will appear here."/>}
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon?: any; label: string; value: string | number }) { return <div className="rounded-lg border border-black/8 bg-white p-5">{Icon && <Icon size={18} className="text-[#a65c00]"/>}<p className={`${Icon ? "mt-4" : ""} text-2xl font-semibold`}>{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{label}</p></div>; }
function ReportTable({ title, values }: { title: string; values: Record<string, number> }) { return <section className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><p className="font-semibold">{title}</p></div><div className="divide-y divide-black/6">{Object.entries(values).map(([key, value]) => <div key={key} className="flex items-center justify-between px-5 py-3 text-sm"><span className="truncate text-black/60">{key.replaceAll("_", " ")}</span><b>{value}</b></div>)}{!Object.keys(values).length && <p className="p-6 text-sm text-black/45">No matching records.</p>}</div></section>; }
function Timeline({ rows, empty, onComplete, onDelete, busy }: { rows: any[]; empty: string; onComplete?: (row: any, completed: boolean) => void; onDelete?: (id: string) => void; busy?: (key?: string) => boolean }) { return <div className="mt-4 space-y-3">{rows.map((row) => { const completed = Boolean(row.completed_at); const pending = busy?.("activity:" + row.id) || busy?.("delete-activity:" + row.id); return <article key={row.id} className={`rounded-md border px-4 py-3 text-xs ${completed ? "border-emerald-200 bg-emerald-50/45" : "border-black/8 bg-black/[.025]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><b>{(row.activity_type ?? row.event_type ?? "EVENT").replaceAll("_", " ")}</b>{row.activity_type && <span className={`rounded px-2 py-1 text-[9px] font-bold tracking-[.1em] ${completed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{completed ? "COMPLETED" : "PENDING"}</span>}</div>{row.can_delete && onDelete && <button type="button" disabled={pending} onClick={() => onDelete(row.id)} className="cursor-pointer text-[10px] font-bold text-red-700 transition hover:text-red-900 disabled:cursor-wait disabled:opacity-55">Delete</button>}</div>{row.body && <p className="mt-2 leading-5 text-black/70">{row.body}</p>}{row.due_at && <p className="mt-2 font-semibold text-[#a65c00]">Due date: {new Date(row.due_at).toLocaleString()}</p>}<div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/6 pt-2"><p className="text-black/40">Recorded: {new Date(row.created_at).toLocaleString()}{row.author_name ? ` · ${row.author_name}` : ""}</p>{row.activity_type && onComplete && <button type="button" disabled={pending} onClick={() => onComplete(row, !completed)} className="cursor-pointer text-[10px] font-bold text-[#a65c00] transition hover:text-[#7c4300] disabled:cursor-wait disabled:opacity-55">{completed ? "Mark pending" : "Mark completed"}</button>}</div></article>; })}{!rows.length && <p className="mt-3 text-xs text-black/45">{empty}</p>}</div>; }
function CommentList({ rows, empty, onDelete, busy }: { rows: any[]; empty: string; onDelete?: (id: string) => void; busy?: (key?: string) => boolean }) { return <div className="mt-4 space-y-3">{rows.map((row) => { const pending = busy?.("delete-comment:" + row.id); return <article key={row.id} className="rounded-md border border-black/8 bg-black/[.025] px-4 py-3 text-xs"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-black/75">{row.author_name ?? "Unknown user"}</p><p className="mt-2 leading-5 text-black/70">{row.body}</p><p className="mt-3 text-black/40">Posted: {new Date(row.created_at).toLocaleString()}</p></div>{row.can_delete && onDelete && <button type="button" disabled={pending} onClick={() => onDelete(row.id)} className="shrink-0 cursor-pointer text-[10px] font-bold text-red-700 transition hover:text-red-900 disabled:cursor-wait disabled:opacity-55">Delete</button>}</div></article>; })}{!rows.length && <p className="mt-3 text-xs text-black/45">{empty}</p>}</div>; }
function Input({ label, value, onChange, type = "text", light = false, required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; light?: boolean; required?: boolean }) { return <label className={`block text-xs font-bold ${light ? "text-black/55" : "text-white/65"}`}>{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-2 h-10 w-full rounded-md border px-3 text-sm outline-none ${light ? "border-black/10 bg-white" : "border-white/10 bg-white/5 text-white"}`}/></label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-black/[.035] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-black/40">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div>; }
function SectionTitle({ title, copy }: { title: string; copy: string }) { return <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-black/45">{copy}</p></div>; }
function Empty({ title, copy }: { title: string; copy: string }) { return <div className="p-10 text-center"><MessageSquare className="mx-auto text-[#a65c00]" size={22}/><h3 className="mt-3 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/50">{copy}</p></div>; }
function DetailSkeleton() { return <div className="animate-pulse p-5"><div className="h-5 w-40 rounded bg-black/[.06]"/><div className="mt-3 h-3 w-64 rounded bg-black/[.06]"/><div className="mt-8 grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 rounded bg-black/[.05]"/>)}</div></div>; }
function WorkspaceSkeleton() { return <main className="min-h-screen bg-[#f5f4f0] p-5 lg:p-10"><div className="h-16 animate-pulse rounded-lg bg-white"/><div className="mx-auto mt-8 grid max-w-7xl animate-pulse gap-4 md:grid-cols-3"><div className="h-56 rounded-lg bg-white"/><div className="h-56 rounded-lg bg-white md:col-span-2"/></div></main>; }
function Toast({ notice, dismiss }: { notice: Exclude<Notice, null>; dismiss: () => void }) { const success = notice.tone === "success"; return <div role="status" className={`fixed right-5 top-5 z-50 flex w-[min(390px,calc(100vw-40px))] items-center gap-3 rounded-lg border p-4 shadow-2xl ${success ? "border-emerald-400/30 bg-[#10231d] text-emerald-50" : "border-red-400/30 bg-[#311718] text-red-50"}`}><span className="grid h-8 w-8 place-items-center rounded-md bg-white/10">{success ? <Check size={16}/> : <X size={16}/>}</span><p className="flex-1 text-sm font-medium">{notice.message}</p><button onClick={dismiss} className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"><X size={16}/></button></div>; }
async function responseData<T>(response: Response): Promise<T> { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "The request could not be completed."); return body as T; }
function titleFor(section: string, sales: boolean) { return ({ overview: "Brokerage command center", sales: "Sales workspace", customers: "Customer workspace", operations: "Operations execution", finance: "Invoice ledger", teams: "Teams and Team Leads", access: "Agent access", reports: sales ? "Sales reports" : "Operations reports", notifications: "Notifications" } as Record<string, string>)[section] ?? "Brokerage"; }
function localInput(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value ?? 0)); }
function message(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }
