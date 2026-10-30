"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BarChart3, Container, Download, Gauge, Hourglass, PlayCircle, ReceiptText, RotateCcw, ShieldCheck, Truck as TruckIcon, UserX, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { downloadExcel, periodLabel, type ExcelSheet } from "@/lib/excel";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { MyPerformance } from "@/components/finance/my-performance";
import { Card, CardHeader, EmptyState, IconTile, KpiCard, PageHeader, Skeleton, StatusChip, humanize, type Tone } from "@/components/ui/surface";
import { Button, LinkButton } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { carrierStatusLabel, invoiceStatusLabel, pct, truckStatusLabel, truckTypeLabel, useCarriers, useDispatchInvoices, useTrucks } from "@/components/dispatch/model";

type PersonRow = { id: string; name: string; carriers: number; pending: number; discarded: number; trucks: number; active: number; onboarded: number; loads: number; week_gross: number; month_gross: number; period_gross: number; weekly_target: number; monthly_target: number; revenue: number; collected: number; outstanding: number };
type CarrierRow = { id: string; company_name: string; mc_number?: string | null; dot_number?: string | null; owner?: string | null; review_status: string; charge_percent?: number | null; trucks: number; running: number; gross: number; revenue: number; collected: number; outstanding: number };
type TruckRow = { id: string; unit_number: string; truck_type: string; status: string; carrier: string; dispatcher?: string | null; loads: number; week_gross: number; gross: number; revenue: number; outstanding: number };
type Report = {
  side: "SALES" | "OPERATIONS"; team_view: boolean; week_start: string; month_start: string;
  totals: Record<string, number>; people: PersonRow[]; carriers: CarrierRow[]; trucks: TruckRow[];
  carrier_statuses: Record<string, number>; truck_statuses: Record<string, number>; invoice_statuses: Record<string, number>;
  agents: { id: string; full_name: string }[];
  load_rows: { id: string; pickup_date: string; rate: number; status: string; truck?: string | null; carrier?: string | null }[];
};

function thisMonth() {
  const now = new Date();
  const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now), agent_id: "" };
}
function useDispatchReport(range: { from: string; to: string; agent_id: string }) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: ["brokerage", "dispatch", "report", range], queryFn: async () => responseData<Report>(await api(`/api/v1/dispatch/reports?${new URLSearchParams(Object.entries(range).filter(([, value]) => value)).toString()}`)), staleTime: 30_000 });
}
const progress = (value: number, target: number) => target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null;

function TargetBar({ label, value, target }: { label: string; value: number; target: number }) {
  const percent = progress(value, target);
  return <div><div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm"><span className="text-ink/75">{label}</span><b className="tabular-nums">{money(value)}{target ? <span className="font-normal text-muted"> / {money(target)}</span> : null}</b></div>
    <div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className={cn("h-full rounded-full", percent !== null && percent >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${percent ?? 0}%` }} /></div>
    <p className="mt-1 text-xs text-muted">{percent === null ? "No target set" : `${percent}% of target`}</p></div>;
}

// ---- Dashboard ----------------------------------------------------------------------------------------------
type Attention = { href: string; icon: LucideIcon; tone: Tone; title: string; detail: string };

export function DispatchDashboard() {
  const { profile } = useSession();
  const { sales, manager, workspace, unread } = useBrokerage();
  const report = useDispatchReport({ ...thisMonth(), agent_id: "" });
  const carriers = useCarriers();
  const trucks = useTrucks();
  const invoices = useDispatchInvoices();
  const canReviewCarriers = manager || Boolean(workspace.capabilities?.canReviewCarriers);
  const canAssign = manager || Boolean(workspace.capabilities?.canAssignTrucks);
  const canReviewInvoices = manager || Boolean(workspace.capabilities?.canReviewInvoices);
  const canSignOff = manager || Boolean(workspace.capabilities?.canSignOffInvoices);
  const me = report.data?.people.find((person) => person.id === profile.id);
  const totals = report.data?.totals ?? {};
  const carrierList = carriers.data ?? []; const truckList = trucks.data?.trucks ?? []; const invoiceList = invoices.data ?? [];

  const attention: Attention[] = sales ? [
    ...(canReviewCarriers ? carrierList.filter((carrier) => carrier.review_status === "PENDING_REVIEW") : []).map((carrier) => ({ href: `/app/dispatch/carriers/${carrier.id}`, icon: Hourglass, tone: "brand" as Tone, title: carrier.company_name, detail: `Waiting for your review · ${carrier.owner_name ?? ""}` })),
    ...carrierList.filter((carrier) => carrier.review_status === "RETURNED" && carrier.owner_id === profile.id).map((carrier) => ({ href: `/app/dispatch/carriers/${carrier.id}`, icon: RotateCcw, tone: "danger" as Tone, title: carrier.company_name, detail: carrier.review_note ?? "Returned for rework" })),
    ...carrierList.filter((carrier) => carrier.review_status === "DOCS_PENDING" && carrier.owner_id === profile.id).map((carrier) => ({ href: `/app/dispatch/carriers/${carrier.id}?tab=documents`, icon: Container, tone: "accent" as Tone, title: carrier.company_name, detail: "Upload documents and submit for review" })),
    ...(canSignOff ? invoiceList.filter((invoice) => invoice.status === "PAID" && !invoice.signed_off_at) : []).map((invoice) => ({ href: `/app/dispatch/invoices?open=${invoice.id}`, icon: ShieldCheck, tone: "success" as Tone, title: invoice.invoice_number, detail: `Paid ${money(invoice.amount)} · waiting for sign-off` })),
  ] : [
    ...(canAssign ? truckList.filter((truck) => truck.status === "ACTIVE") : []).map((truck) => ({ href: `/app/dispatch/trucks/${truck.id}`, icon: UserX, tone: "accent" as Tone, title: `${truck.carrier?.company_name} · ${truck.unit_number}`, detail: "Needs a Dispatcher" })),
    ...(canReviewInvoices ? invoiceList.filter((invoice) => invoice.status === "SUBMITTED") : []).map((invoice) => ({ href: `/app/dispatch/invoices?open=${invoice.id}`, icon: ReceiptText, tone: "brand" as Tone, title: invoice.invoice_number, detail: `${money(invoice.amount)} · waiting for your review` })),
    ...invoiceList.filter((invoice) => invoice.status === "DRAFT" && invoice.review_note && invoice.dispatcher_id === profile.id).map((invoice) => ({ href: `/app/dispatch/invoices?open=${invoice.id}`, icon: RotateCcw, tone: "danger" as Tone, title: invoice.invoice_number, detail: invoice.review_note ?? "Returned" })),
    ...truckList.filter((truck) => truck.status === "ONBOARDED" && truck.assigned_to === profile.id).map((truck) => ({ href: `/app/dispatch/trucks/${truck.id}`, icon: PlayCircle, tone: "aqua" as Tone, title: `${truck.carrier?.company_name} · ${truck.unit_number}`, detail: "New truck · log its first load" })),
    ...invoiceList.filter((invoice) => invoice.overdue).map((invoice) => ({ href: `/app/dispatch/invoices?open=${invoice.id}`, icon: AlertTriangle, tone: "danger" as Tone, title: invoice.invoice_number, detail: `Overdue · ${money(invoice.outstanding)} outstanding` })),
  ];

  const hour = new Date().getHours();
  return <div className="space-y-6 animate-rise">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[28px]">{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, {profile.full_name.split(" ")[0]}</h1></div>
      <LinkButton href={sales ? "/app/dispatch/carriers" : "/app/dispatch/trucks"} variant="ink" icon={sales ? <Container size={16} /> : <TruckIcon size={16} />}>{sales ? "Open carriers" : manager ? "Open dispatch board" : "Open my trucks"}<ArrowRight size={15} /></LinkButton>
    </header>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {sales ? <>
        <KpiCard label={manager ? "Department carriers" : "My carriers"} value={totals.carriers ?? "…"} icon={Container} tone="brand" />
        <KpiCard label="Pending review" value={totals.pending ?? "…"} icon={Hourglass} tone="accent" />
        <KpiCard label="Trucks running" value={totals.running ?? "…"} icon={PlayCircle} tone="success" />
        <KpiCard label="Gross this week" value={money(totals.week_gross)} icon={Gauge} tone="aqua" />
      </> : <>
        {canAssign ? <KpiCard label="Needs a dispatcher" value={truckList.filter((truck) => truck.status === "ACTIVE").length} icon={UserX} tone="accent" /> : <KpiCard label="My trucks" value={truckList.length} icon={TruckIcon} tone="brand" />}
        <KpiCard label="Running" value={truckList.filter((truck) => truck.status === "RUNNING").length} icon={PlayCircle} tone="success" />
        <KpiCard label="Gross this week" value={money(totals.week_gross)} icon={Gauge} tone="aqua" />
        <KpiCard label={canReviewInvoices ? "Invoices to review" : "Draft invoices"} value={invoiceList.filter((invoice) => invoice.status === (canReviewInvoices ? "SUBMITTED" : "DRAFT")).length} icon={ReceiptText} tone="brand" />
      </>}
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Needs your attention" subtitle={`${attention.length} item${attention.length === 1 ? "" : "s"}${unread ? ` · ${unread} unread notification${unread === 1 ? "" : "s"}` : ""}`} />
        {attention.length ? <ul className="divide-y divide-line-soft">{attention.slice(0, 8).map((item, index) => <li key={index}><Link href={item.href} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F4]"><IconTile icon={item.icon} tone={item.tone} size={34} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-muted">{item.detail}</p></div><ArrowRight size={15} className="text-muted" /></Link></li>)}</ul>
          : <EmptyState icon={ShieldCheck} title="You're all caught up" />}
      </Card>
      <Card>
        <CardHeader title={me ? "My targets" : "This month"} subtitle={report.data ? `Gross from loads · ${periodLabel(report.data.month_start, undefined)}` : undefined} />
        <div className="space-y-5 p-5">{report.isLoading ? <Skeleton className="h-24" /> : me ? <>
          <TargetBar label="This week" value={me.week_gross} target={me.weekly_target} />
          <TargetBar label="This month" value={me.month_gross} target={me.monthly_target} />
        </> : <>
          <TargetBar label="This week" value={totals.week_gross ?? 0} target={0} />
          <TargetBar label="This month" value={totals.month_gross ?? 0} target={0} />
          <p className="text-xs text-muted">Per-person targets are on the Reports page.</p>
        </>}</div>
      </Card>
    </div>
    <MyPerformance />
  </div>;
}

// ---- Reports (DS-9, DS-13, DP-5, DP-6, IN-6, RP-6) ---------------------------------------------------------------
type Column<T> = { label: string; value: (row: T) => ReactNode; right?: boolean; total?: (rows: T[]) => ReactNode };
function Table<T>({ title, subtitle, rows, columns, keyOf }: { title: string; subtitle?: string; rows: T[]; columns: Column<T>[]; keyOf: (row: T) => string }) {
  return <Card><CardHeader title={title} subtitle={subtitle} /><div className="max-h-[520px] overflow-auto"><table className="w-full text-sm" style={{ minWidth: Math.max(620, columns.length * 115) }}>
    <thead className="sticky top-0 bg-white"><tr className="text-left text-xs text-muted">{columns.map((column, index) => <th key={column.label} className={cn("whitespace-nowrap py-2.5 font-medium", index ? "px-3" : "px-5", column.right && "text-right")}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={keyOf(row)} className="border-t border-line-soft">{columns.map((column, index) => <td key={column.label} className={cn("whitespace-nowrap py-3", index ? "px-3" : "px-5 font-semibold", column.right && "text-right tabular-nums")}>{column.value(row)}</td>)}</tr>)}
      {!rows.length && <tr><td colSpan={columns.length} className="px-5 py-10 text-center text-muted">No records in this period.</td></tr>}
      {rows.length > 0 && columns.some((column) => column.total) && <tr className="border-t-2 border-line bg-[#FBFAF7] font-semibold">{columns.map((column, index) => <td key={column.label} className={cn("whitespace-nowrap py-3", index ? "px-3" : "px-5", column.right && "text-right tabular-nums")}>{index === 0 ? "Total" : column.total?.(rows) ?? ""}</td>)}</tr>}
    </tbody></table></div></Card>;
}
const sumOf = <T,>(key: keyof T) => (rows: T[]) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
const moneyOf = <T,>(key: keyof T) => (rows: T[]) => money(sumOf<T>(key)(rows));
const owed = (value: number) => <span className={cn(value > 0 && "font-semibold text-[#A5183F]")}>{money(value)}</span>;
const targetCell = (value: number, target: number) => target ? <span>{money(value)} <span className={cn("text-xs", value >= target ? "text-success" : "text-muted")}>({progress(value, target)}%)</span></span> : money(value);

function Breakdown({ title, values, labels }: { title: string; values: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(values); const max = Math.max(1, ...entries.map(([, value]) => value));
  return <Card><CardHeader title={title} />{entries.length ? <ul className="space-y-3.5 p-5">{entries.map(([key, value]) => <li key={key}><div className="mb-1.5 flex justify-between text-sm"><span className="text-ink/75">{labels[key] ?? humanize(key)}</span><b className="tabular-nums">{value}</b></div><div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${(value / max) * 100}%` }} /></div></li>)}</ul> : <p className="p-6 text-center text-sm text-muted">No records.</p>}</Card>;
}

export function DispatchReportsScreen() {
  const { profile } = useSession();
  const { sales, report } = useBrokerage();
  const [range, setRange] = useState(thisMonth);
  // Visited pages stay mounted; leaving Reports resets the filters, like the Brokerage reports.
  useEffect(() => () => setRange(thisMonth()), []);
  const data = useDispatchReport(range);
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const incoming = data.data?.agents;
  const [seen, setSeen] = useState<typeof incoming>();
  if (incoming && incoming !== seen && !range.agent_id) { setSeen(incoming); setAgents(incoming); }
  const r = data.data;
  const personLabel = sales ? "Agent" : "Dispatcher";

  const exportExcel = () => {
    if (!r) return;
    const sheets: ExcelSheet[] = [
      { name: sales ? "By agent" : "By dispatcher", title: sales ? "By agent" : "By dispatcher", rows: r.people as never[], columns: [
        { header: personLabel, key: "name" }, ...(sales ? [{ header: "Carriers", key: "carriers", type: "number" as const }, { header: "Pending", key: "pending", type: "number" as const }, { header: "Discarded / DNC", key: "discarded", type: "number" as const }] : []),
        { header: "Trucks", key: "trucks", type: "number" }, { header: "Running", key: "active", type: "number" }, { header: "Onboarded", key: "onboarded", type: "number" }, { header: "Loads", key: "loads", type: "number" },
        { header: "Gross (period)", key: "period_gross", type: "money" }, { header: "Gross this week", key: "week_gross", type: "money" }, { header: "Weekly target", key: "weekly_target", type: "money" }, { header: "Gross this month", key: "month_gross", type: "money" }, { header: "Monthly target", key: "monthly_target", type: "money" },
        { header: "Invoiced revenue", key: "revenue", type: "money" }, { header: "Collected", key: "collected", type: "money" }, { header: "Outstanding", key: "outstanding", type: "money" },
      ], totals: Object.fromEntries(["carriers", "pending", "discarded", "trucks", "active", "onboarded", "loads", "period_gross", "week_gross", "month_gross", "revenue", "collected", "outstanding"].map((key) => [key, r.people.reduce((total, row) => total + Number((row as never)[key] ?? 0), 0)])) },
      { name: "By carrier", title: "By carrier", rows: r.carriers as never[], columns: [
        { header: "Carrier", key: "company_name" }, { header: "MC", key: "mc_number" }, { header: "DOT", key: "dot_number" }, { header: "Agent", key: "owner" }, { header: "Status", key: "review_status", type: "status" }, { header: "Charge %", key: "charge_percent", type: "percent" },
        { header: "Trucks", key: "trucks", type: "number" }, { header: "Running", key: "running", type: "number" }, { header: "Gross", key: "gross", type: "money" }, { header: "Revenue", key: "revenue", type: "money" }, { header: "Collected", key: "collected", type: "money" }, { header: "Outstanding", key: "outstanding", type: "money" },
      ], totals: Object.fromEntries(["trucks", "running", "gross", "revenue", "collected", "outstanding"].map((key) => [key, r.carriers.reduce((total, row) => total + Number((row as never)[key] ?? 0), 0)])) },
      { name: "By truck", title: "By truck", rows: r.trucks.map((row) => ({ ...row, truck_type: truckTypeLabel[row.truck_type], status: truckStatusLabel[row.status] })) as never[], columns: [
        { header: "Truck", key: "unit_number" }, { header: "Type", key: "truck_type" }, { header: "Carrier", key: "carrier" }, { header: "Dispatcher", key: "dispatcher" }, { header: "Status", key: "status", type: "status" },
        { header: "Loads", key: "loads", type: "number" }, { header: "Gross this week", key: "week_gross", type: "money" }, { header: "Gross (period)", key: "gross", type: "money" }, { header: "Revenue", key: "revenue", type: "money" }, { header: "Outstanding", key: "outstanding", type: "money" },
      ], totals: Object.fromEntries(["loads", "week_gross", "gross", "revenue", "outstanding"].map((key) => [key, r.trucks.reduce((total, row) => total + Number((row as never)[key] ?? 0), 0)])) },
      { name: "Summary", title: "Summary", columns: [["Carriers", "carriers", "number"], ["Trucks", "trucks", "number"], ["Running", "running", "number"], ["Loads", "loads", "number"], ["Gross", "gross", "money"], ["Invoiced revenue", "revenue", "money"], ["Collected", "collected", "money"], ["Outstanding", "outstanding", "money"], ["Signed off", "signed_off", "money"]].map(([header, key, type]) => ({ header, key, type: type as "number" | "money" })), rows: [r.totals] },
    ];
    void downloadExcel(`Dispatch ${sales ? "sales" : "operations"} report ${range.from || "all-time"}${range.to ? ` to ${range.to}` : ""}`, sheets, { period: periodLabel(range.from, range.to), exportedBy: profile.full_name }).then(() => report("Report exported to Excel."), (error) => report(errorMessage(error), "error"));
  };

  return <div className="space-y-6 animate-rise">
    <PageHeader title={sales ? (r?.team_view ? "Dispatch sales performance" : "My dispatch sales") : (r?.team_view ? "Dispatch performance" : "My dispatch results")} subtitle="Gross from loads, invoiced revenue (gross × charge %), targets and collections" actions={<Button variant="ink" icon={<Download size={15} />} disabled={!r} onClick={exportExcel}>Export Excel</Button>} />
    <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
      <label className="flex flex-col text-xs font-medium text-muted">From<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      <label className="flex flex-col text-xs font-medium text-muted">To<input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      {r?.team_view && agents.length > 1 && <label className="flex flex-col text-xs font-medium text-muted">{personLabel}<select value={range.agent_id} onChange={(event) => setRange({ ...range, agent_id: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-52")}><option value="">All {sales ? "agents" : "Dispatchers"}</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>}
      {(range.from !== thisMonth().from || range.to !== thisMonth().to || range.agent_id) && <Button variant="ghost" onClick={() => setRange(thisMonth())}>This month</Button>}
      {(range.from || range.to) && <Button variant="ghost" onClick={() => setRange({ ...range, from: "", to: "" })}>All time</Button>}
    </Card>
    {data.isLoading ? <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28 rounded-card" />)}</div><Skeleton className="h-80 rounded-card" /></>
      : data.isError || !r ? <Card><EmptyState icon={BarChart3} title="Reports unavailable" body={errorMessage(data.error)} /></Card>
      : <>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {sales ? <KpiCard label="Carriers" value={r.totals.carriers} hint={`${r.totals.pending} pending`} tone="brand" /> : <KpiCard label="Trucks" value={r.totals.trucks} hint={`${r.totals.onboarded} onboarded`} tone="brand" />}
          <KpiCard label="Running trucks" value={r.totals.running} hint={`of ${r.totals.trucks}`} tone="success" />
          <KpiCard label="Gross (loads)" value={money(r.totals.gross)} hint={`${r.totals.loads} loads`} tone="aqua" />
          <KpiCard label="Invoiced revenue" value={money(r.totals.revenue)} hint={`${money(r.totals.outstanding)} outstanding`} tone="accent" />
        </div>
        <Table<PersonRow> title={sales ? "By agent" : "By dispatcher"} subtitle="Target progress uses this week and this month" rows={r.people} keyOf={(row) => row.id} columns={[
          { label: personLabel, value: (row) => row.name },
          ...(sales ? [{ label: "Carriers", right: true, value: (row: PersonRow) => row.carriers, total: sumOf<PersonRow>("carriers") }, { label: "Pending", right: true, value: (row: PersonRow) => row.pending, total: sumOf<PersonRow>("pending") }, { label: "Discarded / DNC", right: true, value: (row: PersonRow) => row.discarded, total: sumOf<PersonRow>("discarded") }] : []),
          { label: "Running", right: true, value: (row) => `${row.active} / ${row.trucks}`, total: (rows) => `${sumOf<PersonRow>("active")(rows)} / ${sumOf<PersonRow>("trucks")(rows)}` },
          { label: "Loads", right: true, value: (row) => row.loads, total: sumOf("loads") },
          { label: "Gross (period)", right: true, value: (row) => money(row.period_gross), total: moneyOf("period_gross") },
          { label: "This week vs target", right: true, value: (row) => targetCell(row.week_gross, row.weekly_target), total: moneyOf("week_gross") },
          { label: "This month vs target", right: true, value: (row) => targetCell(row.month_gross, row.monthly_target), total: moneyOf("month_gross") },
          { label: "Revenue", right: true, value: (row) => money(row.revenue), total: moneyOf("revenue") },
          { label: "Collected", right: true, value: (row) => money(row.collected), total: moneyOf("collected") },
          { label: "Outstanding", right: true, value: (row) => owed(row.outstanding), total: moneyOf("outstanding") },
        ]} />
        <Table<CarrierRow> title="By carrier" rows={r.carriers} keyOf={(row) => row.id} columns={[
          { label: "Carrier", value: (row) => <Link href={`/app/dispatch/carriers/${row.id}`} className="hover:text-brand-deep">{row.company_name}</Link> },
          { label: "MC / DOT", value: (row) => [row.mc_number, row.dot_number].filter(Boolean).join(" / ") || "—" },
          ...(sales ? [{ label: "Agent", value: (row: CarrierRow) => row.owner ?? "—" }] : []),
          { label: "Status", value: (row) => <StatusChip status={row.review_status} label={carrierStatusLabel[row.review_status]} /> },
          { label: "Charge %", right: true, value: (row) => pct(row.charge_percent) },
          { label: "Trucks", right: true, value: (row) => `${row.running} / ${row.trucks}`, total: (rows) => `${sumOf<CarrierRow>("running")(rows)} / ${sumOf<CarrierRow>("trucks")(rows)}` },
          { label: "Gross", right: true, value: (row) => money(row.gross), total: moneyOf("gross") },
          { label: "Revenue", right: true, value: (row) => money(row.revenue), total: moneyOf("revenue") },
          { label: "Collected", right: true, value: (row) => money(row.collected), total: moneyOf("collected") },
          { label: "Outstanding", right: true, value: (row) => owed(row.outstanding), total: moneyOf("outstanding") },
        ]} />
        <Table<TruckRow> title="By truck" rows={r.trucks} keyOf={(row) => row.id} columns={[
          { label: "Truck", value: (row) => <Link href={`/app/dispatch/trucks/${row.id}`} className="hover:text-brand-deep">{row.unit_number}</Link> },
          { label: "Type", value: (row) => truckTypeLabel[row.truck_type] },
          { label: "Carrier", value: (row) => row.carrier },
          { label: "Dispatcher", value: (row) => row.dispatcher ?? <span className="text-accent">Unassigned</span> },
          { label: "Status", value: (row) => <StatusChip status={row.status} label={truckStatusLabel[row.status]} /> },
          { label: "Loads", right: true, value: (row) => row.loads, total: sumOf("loads") },
          { label: "This week", right: true, value: (row) => money(row.week_gross), total: moneyOf("week_gross") },
          { label: "Gross", right: true, value: (row) => money(row.gross), total: moneyOf("gross") },
          { label: "Revenue", right: true, value: (row) => money(row.revenue), total: moneyOf("revenue") },
          { label: "Outstanding", right: true, value: (row) => owed(row.outstanding), total: moneyOf("outstanding") },
        ]} />
        <div className="grid gap-6 xl:grid-cols-3">
          <Breakdown title="Carrier status" values={r.carrier_statuses} labels={carrierStatusLabel} />
          <Breakdown title="Truck status" values={r.truck_statuses} labels={truckStatusLabel} />
          <Breakdown title="Invoice status" values={r.invoice_statuses} labels={invoiceStatusLabel} />
        </div>
      </>}
  </div>;
}
