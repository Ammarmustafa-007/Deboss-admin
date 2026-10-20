"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { dateLabel, money } from "@/lib/format";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, CardHeader, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip, humanize, type Tone } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { downloadExcel, periodLabel, type ExcelColumn, type ExcelSheet } from "@/lib/excel";

type Row = Record<string, string | number | null | undefined> & { id: string };
type Counts = Record<string, number>;
type RollupRow = { name: string; shipments: number; delivered: number; invoiced: number; collected: number; outstanding: number };
type OpsAgentRow = { agent_id: string | null; name: string; shipments: number; in_progress: number; delivered: number; exceptions: number; invoiced: number; collected: number; outstanding: number };
type Workload = { agents: { agent_id: string; name: string; active: number; exceptions: number }[]; unassigned: number };
type OutcomeRow = { agent_id: string | null; agent: string; customer: string; opportunities: number; statuses: Record<string, number>; gross_generated: number };
type AgentRow = { agent_id: string; name: string; leads: number; customers: number; shipments: number; gross_generated: number };
type ReportData = {
  sales: { totals: Record<string, number>; agent_breakdown?: AgentRow[]; agents?: { id: string; full_name: string }[]; shipment_rows: Row[]; lead_stages: Counts; quote_stages: Counts; shipment_statuses: Counts; customer_outcomes: Counts; agent_outcomes?: OutcomeRow[]; by_agent: Counts; by_team: Counts };
  operations: { totals: Record<string, number>; agent_breakdown?: OpsAgentRow[]; team_breakdown?: RollupRow[]; customer_breakdown?: RollupRow[]; rows: OpsRow[]; shipment_statuses: Counts; invoice_statuses: Counts; workload: Workload | null; by_customer: Counts };
};

const barTones: Tone[] = ["brand", "aqua", "accent", "info", "success", "danger"];
const barColor: Record<Tone, string> = { brand: "bg-brand", aqua: "bg-aqua", accent: "bg-accent", info: "bg-info", success: "bg-success", danger: "bg-danger", neutral: "bg-ink/30" };

/** Reports open on the current month (local dates), matching the monthly reporting cycle. */
function thisMonth() {
  const now = new Date();
  const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now), agent_id: "" };
}

export function ReportsScreen() {
  const { profile } = useSession();
  const { api, report, sales, manager } = useBrokerage();
  const canViewTeamPerformance = manager || profile.role === "SUPER_ADMIN";
  const [range, setRange] = useState(thisMonth);
  const reports = useQuery({ queryKey: ["brokerage", "reports", range], queryFn: async () => responseData<ReportData>(await api(`/api/v1/brokerage/reports?${new URLSearchParams(Object.entries(range).filter(([, value]) => value) as string[][]).toString()}`)), staleTime: 30_000 });

  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    if (!reports.data) return;
    setExporting(true);
    try {
      const sheets = sales ? salesSheets(reports.data, canViewTeamPerformance) : opsSheets(reports.data, canViewTeamPerformance);
      await downloadExcel(`${title} ${range.from || "all-time"}${range.to ? ` to ${range.to}` : ""}`, sheets, { period: periodLabel(range.from, range.to), exportedBy: profile.full_name });
      report(`${title} exported to Excel.`);
    } catch (error) { report(errorMessage(error, "The Excel file could not be created."), "error"); }
    finally { setExporting(false); }
  };


  const data = reports.data;
  const title = sales ? canViewTeamPerformance ? "Sales performance" : "My sales results" : "Operations & revenue";

  return <div className="space-y-6 animate-rise">
    <PageHeader title={title} subtitle="Filter by date range and export the report to Excel" actions={<Button variant="ink" icon={<Download size={15} />} disabled={!data} pending={exporting} pendingLabel="Preparing…" onClick={() => void exportExcel()}>Export Excel</Button>} />

    <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
      <label className="flex flex-col text-xs font-medium text-muted">From<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      <label className="flex flex-col text-xs font-medium text-muted">To<input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      {sales && canViewTeamPerformance && (data?.sales.agents ?? []).length > 1 && <label className="flex flex-col text-xs font-medium text-muted">Agent<select value={range.agent_id} onChange={(event) => setRange({ ...range, agent_id: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-52")}><option value="">All permitted agents</option>{data!.sales.agents!.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>}
      {(range.from !== thisMonth().from || range.to !== thisMonth().to || range.agent_id) && <Button variant="ghost" onClick={() => setRange(thisMonth())}>This month</Button>}
      {(range.from || range.to) && <Button variant="ghost" onClick={() => setRange({ ...range, from: "", to: "" })}>All time</Button>}
    </Card>

    {reports.isLoading ? <><div className="grid grid-cols-2 gap-4 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-card" />)}</div><Skeleton className="h-80 rounded-card" /></>
      : reports.isError || !data ? <Card><EmptyState icon={BarChart3} title="Reports unavailable" body={errorMessage(reports.error)} /></Card>
      : <>
        <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", sales ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
          {sales ? canViewTeamPerformance ? <>
            <KpiCard label="Leads" value={data.sales.totals.leads} tone="brand" />
            <KpiCard label="Customers" value={data.sales.totals.customers} tone="success" />
            <KpiCard label="Shipments" value={data.sales.totals.shipments} tone="aqua" />
            <KpiCard label="Gross generated" value={money(data.sales.totals.gross_generated)} tone="accent" />
            <KpiCard label="Quoted value" value={money(data.sales.totals.quoted_value)} tone="info" />
          </> : <>
            <KpiCard label="Customers onboarded" value={data.sales.totals.customers} tone="success" />
            <KpiCard label="Shipments created" value={data.sales.totals.shipments} tone="aqua" />
            <KpiCard label="Gross generated" value={money(data.sales.totals.gross_generated)} tone="accent" />
            <KpiCard label="Quoted value" value={money(data.sales.totals.quoted_value)} tone="info" />
            <KpiCard label="Agreed value" value={money(data.sales.totals.agreed_value)} tone="brand" />
          </> : <>
            <KpiCard label="Shipments" value={data.operations.totals.shipments} tone="brand" />
            <KpiCard label="In progress" value={data.operations.totals.in_progress ?? 0} tone="aqua" />
            <KpiCard label="Delivered" value={data.operations.totals.delivered ?? 0} tone="success" />
            <KpiCard label="Open exceptions" value={data.operations.totals.exceptions ?? 0} tone={data.operations.totals.exceptions ? "danger" : "info"} />
            <KpiCard label="Invoiced" value={money(data.operations.totals.invoiced)} tone="accent" />
            <KpiCard label="Collected" value={money(data.operations.totals.paid)} tone="success" />
            <KpiCard label="Outstanding" value={money(data.operations.totals.outstanding)} tone="danger" />
            <KpiCard label="Overdue invoices" value={data.operations.totals.overdue ?? 0} tone={data.operations.totals.overdue ? "danger" : "info"} />
          </>}
        </div>

        {sales && !canViewTeamPerformance ? <div className="space-y-6">
          <ShipmentTable rows={data.sales.shipment_rows} />
          <Breakdown title="Shipment status" values={data.sales.shipment_statuses} />
        </div> : <>{!sales && canViewTeamPerformance && (data.operations.agent_breakdown?.length ?? 0) > 0 && <OpsAgentTable rows={data.operations.agent_breakdown!} />}{!sales && canViewTeamPerformance && (data.operations.team_breakdown?.length ?? 0) > 0 && <RollupTable title="By team" label="Team" rows={data.operations.team_breakdown!} />}{!sales && (data.operations.customer_breakdown?.length ?? 0) > 0 && <RollupTable title="By customer" label="Customer" rows={data.operations.customer_breakdown!} />}{!sales && <OpsShipmentTable rows={data.operations.rows} manager={canViewTeamPerformance} />}{sales && (data.sales.agent_breakdown?.length ?? 0) > 0 && <AgentTable rows={data.sales.agent_breakdown!} onPick={(id) => setRange({ ...range, agent_id: id })} />}{sales && (data.sales.agent_outcomes?.length ?? 0) > 0 && <OutcomeTable rows={data.sales.agent_outcomes!} />}<div className="grid gap-6 xl:grid-cols-2">
          {sales ? <>
            <Breakdown title="Pipeline by stage" values={data.sales.lead_stages} />
            <Breakdown title="Quote outcomes" values={data.sales.quote_stages} />
            <Breakdown title="Shipment status" values={data.sales.shipment_statuses} />
            <Breakdown title="Opportunities by agent" values={data.sales.by_agent} />
            <Breakdown title="Team performance" values={data.sales.by_team} />
          </> : <>
            <Breakdown title="Shipment status" values={data.operations.shipment_statuses} />
            <Breakdown title="Invoice status" values={data.operations.invoice_statuses} />
            {canViewTeamPerformance && data.operations.workload && <WorkloadCard workload={data.operations.workload} />}
          </>}
        </div></>}
      </>}
  </div>;
}

/** Operations workbook: summary, every shipment, then the agent, team and customer roll-ups (BO-5 to BO-7, IN-6). */
function opsSheets(data: ReportData, manager: boolean): ExcelSheet[] {
  const totals = data.operations.totals;
  const rollup = (label: string): ExcelColumn[] => [{ header: label, key: "name" }, { header: "Shipments", key: "shipments", type: "number" }, { header: "Delivered", key: "delivered", type: "number" }, { header: "Invoiced", key: "invoiced", type: "money" }, { header: "Collected", key: "collected", type: "money" }, { header: "Outstanding", key: "outstanding", type: "money" }];
  const sumRows = <T extends Record<string, unknown>>(rows: T[], keys: string[]) => Object.fromEntries(keys.map((key) => [key, rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)]));
  const sheets: ExcelSheet[] = [
    summarySheet("Operations summary", [["Shipments", totals.shipments, "number"], ["In progress", totals.in_progress, "number"], ["Delivered", totals.delivered, "number"], ["Open exceptions", totals.exceptions, "number"], ["Invoiced", totals.invoiced, "money"], ["Collected", totals.paid, "money"], ["Outstanding", totals.outstanding, "money"], ["Overdue invoices", totals.overdue, "number"]]),
    {
      name: manager ? "Shipments" : "My shipments", title: manager ? "Shipments" : "My shipments",
      columns: [
        { header: "Shipment reference", key: "reference_number" }, { header: "Customer", key: "customer_name" }, { header: "Pickup", key: "pickup_location" }, { header: "Delivery", key: "delivery_location" },
        ...(manager ? [{ header: "Agent", key: "agent" }, { header: "Team", key: "team" }] : []),
        { header: "Status", key: "status", type: "status" }, { header: "Exception", key: "exception", type: "status" }, { header: "Carrier", key: "carrier_name" }, { header: "Equipment", key: "equipment_type" },
        { header: "Pickup date", key: "pickup_date", type: "date" }, { header: "Delivery date", key: "delivery_date", type: "date" }, { header: "Quoted amount", key: "amount_quoted", type: "money" }, { header: "Agreed amount", key: "amount_agreed", type: "money" },
        { header: "Invoice number", key: "invoice_number" }, { header: "Invoice status", key: "invoice_state", type: "status" }, { header: "Due date", key: "invoice_due", type: "date" },
        { header: "Invoiced", key: "invoiced", type: "money" }, { header: "Collected", key: "collected", type: "money" }, { header: "Outstanding", key: "outstanding", type: "money" }, { header: "Created", key: "created_at", type: "date" }, { header: "Last updated", key: "updated_at", type: "date" },
      ],
      rows: data.operations.rows.map((row) => ({ ...row, invoice_state: row.overdue ? "Overdue" : row.invoice_status ?? "Not invoiced" })),
      totals: sumRows(data.operations.rows, ["amount_quoted", "amount_agreed", "invoiced", "collected", "outstanding"]),
    },
  ];
  if (manager && data.operations.agent_breakdown?.length) sheets.push({ name: "By agent", title: "By agent", rows: data.operations.agent_breakdown, totals: sumRows(data.operations.agent_breakdown, ["shipments", "in_progress", "delivered", "exceptions", "invoiced", "collected", "outstanding"]), columns: [{ header: "Agent", key: "name" }, { header: "Shipments", key: "shipments", type: "number" }, { header: "In progress", key: "in_progress", type: "number" }, { header: "Delivered", key: "delivered", type: "number" }, { header: "Open exceptions", key: "exceptions", type: "number" }, { header: "Invoiced", key: "invoiced", type: "money" }, { header: "Collected", key: "collected", type: "money" }, { header: "Outstanding", key: "outstanding", type: "money" }] });
  if (manager && data.operations.team_breakdown?.length) sheets.push({ name: "By team", title: "By team", columns: rollup("Team"), rows: data.operations.team_breakdown, totals: sumRows(data.operations.team_breakdown, ["shipments", "delivered", "invoiced", "collected", "outstanding"]) });
  if (data.operations.customer_breakdown?.length) sheets.push({ name: "By customer", title: "By customer", columns: rollup("Customer"), rows: data.operations.customer_breakdown, totals: sumRows(data.operations.customer_breakdown, ["shipments", "delivered", "invoiced", "collected", "outstanding"]) });
  return sheets;
}

/** Sales workbook: summary, shipments, then per-agent results and outcomes for managers (BS-5 to BS-7). */
function salesSheets(data: ReportData, manager: boolean): ExcelSheet[] {
  const totals = data.sales.totals;
  const rows = data.sales.shipment_rows;
  const sheets: ExcelSheet[] = [
    summarySheet(manager ? "Sales summary" : "My sales summary", [...(manager ? [["Leads", totals.leads, "number"] as SummaryLine] : []), ["Customers onboarded", totals.customers, "number"], ["Shipments", totals.shipments, "number"], ["Gross generated", totals.gross_generated, "money"], ["Quoted value", totals.quoted_value, "money"], ["Agreed value", totals.agreed_value, "money"], ...(manager ? [["Pipeline value", totals.pipeline_value, "money"] as SummaryLine] : [])]),
    {
      name: manager ? "Shipments" : "My shipments", title: manager ? "Shipments" : "My shipments",
      columns: [{ header: "Shipment reference", key: "reference_number" }, { header: "Customer", key: "customer_name" }, { header: "Pickup", key: "pickup_location" }, { header: "Delivery", key: "delivery_location" }, { header: "Equipment", key: "equipment_type" }, { header: "Quoted rate", key: "amount_quoted", type: "money" }, { header: "Agreed rate", key: "amount_agreed", type: "money" }, { header: "Commercial status", key: "sales_status", type: "status" }, { header: "Pickup date", key: "pickup_date", type: "date" }, { header: "Delivery date", key: "delivery_date", type: "date" }, { header: "Created date", key: "created_at", type: "date" }, { header: "Last updated", key: "updated_at", type: "date" }],
      rows: rows.map((row) => ({ ...row, customer_name: row.customer_name ?? row.company_name, amount_quoted: row.amount_quoted ?? row.quoted_rate, sales_status: row.sales_status ?? row.status, updated_at: row.updated_at ?? row.created_at })),
      totals: { amount_quoted: rows.reduce((total, row) => total + Number(row.amount_quoted ?? row.quoted_rate ?? 0), 0), amount_agreed: rows.reduce((total, row) => total + Number(row.amount_agreed ?? 0), 0) },
    },
  ];
  const agents = data.sales.agent_breakdown ?? [];
  if (manager && agents.length) sheets.push({ name: "By agent", title: "By agent", columns: [{ header: "Agent", key: "name" }, { header: "Leads", key: "leads", type: "number" }, { header: "Customers", key: "customers", type: "number" }, { header: "Shipments", key: "shipments", type: "number" }, { header: "Gross generated", key: "gross_generated", type: "money" }], rows: agents, totals: { leads: agents.reduce((t, r) => t + r.leads, 0), customers: agents.reduce((t, r) => t + r.customers, 0), shipments: agents.reduce((t, r) => t + r.shipments, 0), gross_generated: agents.reduce((t, r) => t + r.gross_generated, 0) } });
  if (manager && data.sales.agent_outcomes?.length) sheets.push(outcomeSheet(data.sales.agent_outcomes));
  return sheets;
}

type SummaryLine = [string, number | undefined, "number" | "money"];
function summarySheet(title: string, lines: SummaryLine[]): ExcelSheet {
  return { name: "Summary", title, columns: [{ header: "Measure", key: "label", width: 28 }, { header: "Value", key: "value", type: (row) => row.format as "number" | "money", width: 20 }], rows: lines.map(([label, value, format]) => ({ label, value: value ?? 0, format })) };
}

function outcomeSheet(rows: OutcomeRow[]): ExcelSheet {
  const total = (key: string) => rows.reduce((sum, row) => sum + (row.statuses[key] ?? 0), 0);
  return {
    name: "Outcomes by agent", title: "Outcomes by agent", note: "Each customer's opportunities and outcomes under the agent who owns it.",
    columns: [{ header: "Agent", key: "agent" }, { header: "Customer", key: "customer" }, { header: "Opportunities", key: "opportunities", type: "number" }, ...outcomeStatuses.map((key) => ({ header: humanize(key), key, type: "number" as const })), { header: "Gross generated", key: "gross_generated", type: "money" }],
    rows: rows.map((row) => ({ ...row, ...Object.fromEntries(outcomeStatuses.map((key) => [key, row.statuses[key] ?? 0])) })),
    totals: { opportunities: rows.reduce((sum, row) => sum + row.opportunities, 0), ...Object.fromEntries(outcomeStatuses.map((key) => [key, total(key)])), gross_generated: rows.reduce((sum, row) => sum + row.gross_generated, 0) },
  };
}

type Column<T> = { label: string; value: (row: T) => ReactNode; total?: (rows: T[]) => ReactNode; align?: "right"; wide?: boolean };

/** A report table with an optional totals row; every column comes from the same row data as the Excel export. */
function ReportTable<T>({ title, subtitle, rows, columns, keyOf, empty = "No records match this reporting period.", actions }: { title: string; subtitle?: string; rows: T[]; columns: Column<T>[]; keyOf: (row: T, index: number) => string; empty?: string; actions?: ReactNode }) {
  const totals = columns.some((column) => column.total);
  return <Card>
    <CardHeader title={title} subtitle={subtitle} actions={actions} />
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full text-sm" style={{ minWidth: Math.max(620, columns.length * 120) }}>
        <thead className="sticky top-0 z-[1] bg-white"><tr className="text-left text-xs text-muted">{columns.map((column, index) => <th key={column.label} className={cn("whitespace-nowrap py-2.5 font-medium", index === 0 ? "px-5" : "px-3", column.align === "right" && "text-right")}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => <tr key={keyOf(row, rowIndex)} className="border-t border-line-soft">{columns.map((column, index) => <td key={column.label} className={cn("py-3 align-top", index === 0 ? "px-5 font-semibold" : "px-3", column.align === "right" && "text-right tabular-nums", column.wide ? "min-w-48" : "whitespace-nowrap")}>{column.value(row)}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-muted">{empty}</td></tr>}
          {totals && rows.length > 0 && <tr className="border-t-2 border-line bg-[#FBFAF7] font-semibold">{columns.map((column, index) => <td key={column.label} className={cn("whitespace-nowrap py-3", index === 0 ? "px-5" : "px-3", column.align === "right" && "text-right tabular-nums")}>{index === 0 ? "Total" : column.total?.(rows) ?? ""}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  </Card>;
}

const sumOf = <T,>(key: keyof T) => (rows: T[]) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
const moneySum = <T,>(key: keyof T) => (rows: T[]) => money(sumOf<T>(key)(rows));
const owedCell = (value: number) => <span className={cn(value > 0 && "font-semibold text-[#A5183F]")}>{money(value)}</span>;

/** Paid and outstanding rolled up by team or customer (BO-7, IN-6). */
function RollupTable({ title, label, rows }: { title: string; label: string; rows: RollupRow[] }) {
  return <ReportTable title={title} subtitle="Shipments, delivery and billing" rows={rows} keyOf={(row) => row.name} columns={[
    { label, value: (row) => row.name },
    { label: "Shipments", align: "right", value: (row) => row.shipments, total: sumOf("shipments") },
    { label: "Delivered", align: "right", value: (row) => row.delivered, total: sumOf("delivered") },
    { label: "Invoiced", align: "right", value: (row) => money(row.invoiced), total: moneySum("invoiced") },
    { label: "Collected", align: "right", value: (row) => money(row.collected), total: moneySum("collected") },
    { label: "Outstanding", align: "right", value: (row) => owedCell(row.outstanding), total: moneySum("outstanding") },
  ]} />;
}

/** Every agent's progress and revenue (BO-5, BO-7). */
function OpsAgentTable({ rows }: { rows: OpsAgentRow[] }) {
  return <ReportTable title="By agent" subtitle="Shipment progress and revenue per agent" rows={rows} keyOf={(row) => row.agent_id ?? "unassigned"} columns={[
    { label: "Agent", value: (row) => <span className={cn(!row.agent_id && "text-muted")}>{row.name}</span> },
    { label: "Shipments", align: "right", value: (row) => row.shipments, total: sumOf("shipments") },
    { label: "In progress", align: "right", value: (row) => row.in_progress, total: sumOf("in_progress") },
    { label: "Delivered", align: "right", value: (row) => row.delivered, total: sumOf("delivered") },
    { label: "Open exceptions", align: "right", value: (row) => row.exceptions ? <span className="font-semibold text-[#A5183F]">{row.exceptions}</span> : 0, total: sumOf("exceptions") },
    { label: "Invoiced", align: "right", value: (row) => money(row.invoiced), total: moneySum("invoiced") },
    { label: "Collected", align: "right", value: (row) => money(row.collected), total: moneySum("collected") },
    { label: "Outstanding", align: "right", value: (row) => owedCell(row.outstanding), total: moneySum("outstanding") },
  ]} />;
}

type OpsRow = { id: string; reference_number: string; customer_name: string | null; pickup_location: string; delivery_location: string; equipment_type: string | null; agent: string; team: string | null; status: string; carrier_name: string | null; pickup_date: string | null; delivery_date: string | null; amount_quoted: number | null; amount_agreed: number | null; invoice_number: string | null; invoice_status: string | null; invoice_due: string | null; invoiced: number | null; collected: number | null; outstanding: number | null; overdue: boolean; exception: string | null; created_at: string; updated_at: string };

/** One complete line per shipment, the same rows as the Excel export (BO-1 to BO-6). */
function OpsShipmentTable({ rows, manager }: { rows: OpsRow[]; manager: boolean }) {
  const dash = (value: ReactNode) => value === null || value === undefined || value === "" ? <span className="text-muted">—</span> : value;
  return <ReportTable title={manager ? "Shipments" : "My shipments"} subtitle="Every shipment in this period, the same rows as the Excel export" rows={rows} keyOf={(row) => row.id} empty="No shipments match this reporting period." columns={[
    { label: "Reference", value: (row) => row.reference_number },
    { label: "Customer", value: (row) => dash(row.customer_name) },
    { label: "Lane", wide: true, value: (row) => <span className="text-[13px]">{row.pickup_location} <span className="text-brand">→</span> {row.delivery_location}</span> },
    ...(manager ? [{ label: "Agent", value: (row: OpsRow) => <span className={cn(row.agent === "Unassigned" && "text-accent")}>{row.agent}</span> }, { label: "Team", value: (row: OpsRow) => dash(row.team) }] : []),
    { label: "Status", value: (row) => <StatusChip status={row.status} /> },
    { label: "Exception", value: (row) => row.exception ? <StatusChip status={row.exception === "Open" ? "EXCEPTION" : "RESOLVED"} label={row.exception} /> : dash(null) },
    { label: "Carrier", value: (row) => dash(row.carrier_name) },
    { label: "Equipment", value: (row) => dash(row.equipment_type) },
    { label: "Pickup", value: (row) => dash(row.pickup_date && dateLabel(row.pickup_date)) },
    { label: "Delivery", value: (row) => dash(row.delivery_date && dateLabel(row.delivery_date)) },
    { label: "Quoted", align: "right", value: (row) => dash(row.amount_quoted == null ? null : money(row.amount_quoted)), total: moneySum("amount_quoted") },
    { label: "Invoice", value: (row) => row.invoice_number ? <span className="text-[13px]">{row.invoice_number}<br /><StatusChip status={row.overdue ? "OVERDUE" : row.invoice_status ?? ""} /></span> : <span className="text-muted">Not invoiced</span> },
    { label: "Due", value: (row) => dash(row.invoice_due && <span className={cn(row.overdue && "font-semibold text-[#A5183F]")}>{dateLabel(row.invoice_due)}</span>) },
    { label: "Invoiced", align: "right", value: (row) => dash(row.invoiced == null ? null : money(row.invoiced)), total: moneySum("invoiced") },
    { label: "Collected", align: "right", value: (row) => dash(row.collected == null ? null : money(row.collected)), total: moneySum("collected") },
    { label: "Outstanding", align: "right", value: (row) => row.outstanding == null ? dash(null) : owedCell(row.outstanding), total: moneySum("outstanding") },
  ]} />;
}

function AgentTable({ rows, onPick }: { rows: AgentRow[]; onPick: (id: string) => void }) {
  const total = rows.reduce((sum, row) => ({ leads: sum.leads + row.leads, customers: sum.customers + row.customers, shipments: sum.shipments + row.shipments, gross: sum.gross + row.gross_generated }), { leads: 0, customers: 0, shipments: 0, gross: 0 });
  return <Card>
    <CardHeader title="By agent" subtitle="Click an agent to open their individual report" />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Agent</th><th className="px-3 py-2.5 text-right font-medium">Leads</th><th className="px-3 py-2.5 text-right font-medium">Customers</th><th className="px-3 py-2.5 text-right font-medium">Shipments</th><th className="px-5 py-2.5 text-right font-medium">Gross generated</th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.agent_id} onClick={() => onPick(row.agent_id)} className="cursor-pointer border-t border-line-soft hover:bg-[#FAF8F4]">
            <td className="px-5 py-3 font-semibold">{row.name}</td>
            <td className="px-3 py-3 text-right tabular-nums">{row.leads}</td>
            <td className="px-3 py-3 text-right tabular-nums">{row.customers}</td>
            <td className="px-3 py-3 text-right tabular-nums">{row.shipments}</td>
            <td className="px-5 py-3 text-right font-semibold tabular-nums">{money(row.gross_generated)}</td>
          </tr>)}
          <tr className="border-t-2 border-line bg-[#FBFAF7] font-semibold"><td className="px-5 py-3">Total</td><td className="px-3 py-3 text-right tabular-nums">{total.leads}</td><td className="px-3 py-3 text-right tabular-nums">{total.customers}</td><td className="px-3 py-3 text-right tabular-nums">{total.shipments}</td><td className="px-5 py-3 text-right tabular-nums">{money(total.gross)}</td></tr>
        </tbody>
      </table>
    </div>
  </Card>;
}

const outcomeStatuses = ["QUOTED", "BOOKED", "DELIVERED", "PAID"];

/** Outcome per customer, grouped under the agent who owns the customer (BS-7). */
function OutcomeTable({ rows }: { rows: OutcomeRow[] }) {
  const groups = rows.reduce((map, row) => map.set(row.agent, [...(map.get(row.agent) ?? []), row]), new Map<string, OutcomeRow[]>());
  const totalOf = (list: OutcomeRow[]) => ({ opportunities: list.reduce((sum, row) => sum + row.opportunities, 0), gross: list.reduce((sum, row) => sum + row.gross_generated, 0), status: (key: string) => list.reduce((sum, row) => sum + (row.statuses[key] ?? 0), 0) });
  const grand = totalOf(rows);
  const { profile } = useSession();
  const download = () => void downloadExcel("Outcomes by agent", [outcomeSheet(rows)], { exportedBy: profile.full_name });
  const cells = (opportunities: number, status: (key: string) => number, gross: number) => <>
    <td className="px-3 py-3 text-right tabular-nums">{opportunities}</td>
    {outcomeStatuses.map((key) => <td key={key} className="px-3 py-3 text-right tabular-nums">{status(key) || "–"}</td>)}
    <td className="px-5 py-3 text-right tabular-nums">{money(gross)}</td>
  </>;
  return <Card>
    <CardHeader title="Outcomes by agent" subtitle="Each customer's opportunities and outcomes under the agent who owns it" actions={<Button variant="outline" size="sm" icon={<Download size={14} />} onClick={download}>Export</Button>} />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Agent</th><th className="px-3 py-2.5 font-medium">Customer</th><th className="px-3 py-2.5 text-right font-medium">Opportunities</th>{outcomeStatuses.map((key) => <th key={key} className="px-3 py-2.5 text-right font-medium">{humanize(key)}</th>)}<th className="px-5 py-2.5 text-right font-medium">Gross</th></tr></thead>
        {[...groups.entries()].map(([agent, list]) => { const total = totalOf(list); return <tbody key={agent} className="border-t-2 border-line">
          {list.map((row, index) => <tr key={`${row.customer}-${index}`} className="border-t border-line-soft first:border-t-0">
            <td className="px-5 py-3 font-semibold">{index === 0 ? agent : ""}</td>
            <td className="px-3 py-3">{row.customer}</td>
            {cells(row.opportunities, (key) => row.statuses[key] ?? 0, row.gross_generated)}
          </tr>)}
          <tr className="border-t border-line-soft bg-[#FBFAF7] font-semibold text-ink/80"><td className="px-5 py-2.5">{agent} total</td><td />{cells(total.opportunities, total.status, total.gross)}</tr>
        </tbody>; })}
        <tbody className="border-t-2 border-line"><tr className="bg-[#FBFAF7] font-semibold"><td className="px-5 py-3">Total</td><td />{cells(grand.opportunities, grand.status, grand.gross)}</tr></tbody>
      </table>
    </div>
  </Card>;
}

/** Open shipments each agent is handling right now (BO-5). Unassigned work is a call to action, not an agent. */
function WorkloadCard({ workload }: { workload: Workload }) {
  const max = Math.max(1, ...workload.agents.map((agent) => agent.active));
  const total = workload.agents.reduce((sum, agent) => sum + agent.active, 0);
  return <Card>
    <CardHeader title="Workload by agent" subtitle={`Open shipments right now · ${total} assigned across ${workload.agents.length} agent${workload.agents.length === 1 ? "" : "s"}`} />
    {workload.agents.length ? <ul className="space-y-3.5 p-5">{workload.agents.map((agent) => <li key={agent.agent_id}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-ink/75">{agent.name}{agent.exceptions > 0 && <span className="ml-2 text-xs font-semibold text-[#A5183F]">{agent.exceptions} exception{agent.exceptions === 1 ? "" : "s"}</span>}</span>
        <b className="tabular-nums">{agent.active}<span className="ml-1 text-xs font-normal text-muted">open</span></b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${(agent.active / max) * 100}%` }} /></div>
    </li>)}</ul> : <p className="p-6 text-center text-sm text-muted">No active agents in this department.</p>}
    {workload.unassigned > 0 && <Link href="/app/operations" className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3.5 text-sm hover:bg-[#FAF8F4]">
      <span className="font-medium text-accent">{workload.unassigned} open shipment{workload.unassigned === 1 ? "" : "s"} waiting for an agent</span>
      <span className="text-xs font-semibold text-brand-deep">Assign →</span>
    </Link>}
  </Card>;
}

/** A count breakdown shown as proportional bars. */
function Breakdown({ title, values }: { title: string; values: Counts }) {
  const entries = Object.entries(values ?? {});
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return <Card>
    <CardHeader title={title} />
    {entries.length ? <ul className="space-y-3.5 p-5">{entries.map(([key, value], index) => <li key={key}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm"><span className="truncate text-ink/75">{/^[A-Z_]+$/.test(key) ? humanize(key) : key}</span><b className="tabular-nums">{value}</b></div>
      <div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className={cn("h-full rounded-full", barColor[barTones[index % barTones.length]])} style={{ width: `${(value / max) * 100}%` }} /></div>
    </li>)}</ul> : <p className="p-6 text-center text-sm text-muted">No matching records.</p>}
  </Card>;
}

function ShipmentTable({ rows }: { rows: Row[] }) {
  return <Card>
    <CardHeader title="My shipments" subtitle="The same rows included in the Excel export" />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Reference</th><th className="px-3 py-2.5 font-medium">Customer</th><th className="px-3 py-2.5 font-medium">Lane</th><th className="px-3 py-2.5 font-medium">Equipment</th><th className="px-3 py-2.5 text-right font-medium">Quoted</th><th className="px-3 py-2.5 text-right font-medium">Agreed</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-5 py-2.5 font-medium">Dates</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-line-soft">
          <td className="px-5 py-3 font-semibold">{row.reference_number}</td>
          <td className="px-3 py-3">{row.customer_name}</td>
          <td className="px-3 py-3 text-[13px]">{row.pickup_location} <span className="text-brand">→</span> {row.delivery_location}</td>
          <td className="px-3 py-3 text-[13px] text-ink/75">{row.equipment_type || "—"}</td>
          <td className="px-3 py-3 text-right tabular-nums">{money(row.amount_quoted)}</td>
          <td className="px-3 py-3 text-right tabular-nums">{money(row.amount_agreed)}</td>
          <td className="px-3 py-3"><StatusChip status={String(row.sales_status ?? "")} /></td>
          <td className="px-5 py-3 text-[13px] text-ink/75">{dateLabel(row.pickup_date as string)} – {dateLabel(row.delivery_date as string)}</td>
        </tr>)}{!rows.length && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-muted">No shipments match this reporting period.</td></tr>}</tbody>
      </table>
    </div>
  </Card>;
}
