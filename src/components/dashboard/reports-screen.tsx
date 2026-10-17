"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { dateLabel, money } from "@/lib/format";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, CardHeader, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip, humanize, type Tone } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

type Row = Record<string, string | number | null | undefined> & { id: string };
type Counts = Record<string, number>;
type AgentRow = { agent_id: string; name: string; leads: number; customers: number; shipments: number; gross_generated: number };
type ReportData = {
  sales: { totals: Record<string, number>; agent_breakdown?: AgentRow[]; agents?: { id: string; full_name: string }[]; shipment_rows: Row[]; lead_stages: Counts; quote_stages: Counts; shipment_statuses: Counts; customer_outcomes: Counts; by_agent: Counts; by_team: Counts };
  operations: { totals: Record<string, number>; rows: Row[]; shipment_statuses: Counts; invoice_statuses: Counts; workload: Counts; by_customer: Counts };
};

const barTones: Tone[] = ["brand", "aqua", "accent", "info", "success", "danger"];
const barColor: Record<Tone, string> = { brand: "bg-brand", aqua: "bg-aqua", accent: "bg-accent", info: "bg-info", success: "bg-success", danger: "bg-danger", neutral: "bg-ink/30" };

export function ReportsScreen() {
  const { profile } = useSession();
  const { api, report, sales, manager } = useBrokerage();
  const canViewTeamPerformance = manager || profile.role === "SUPER_ADMIN";
  const [range, setRange] = useState({ from: "", to: "", agent_id: "" });
  const reports = useQuery({ queryKey: ["brokerage", "reports", range], queryFn: async () => responseData<ReportData>(await api(`/api/v1/brokerage/reports?${new URLSearchParams(Object.entries(range).filter(([, value]) => value) as string[][]).toString()}`)), staleTime: 30_000 });

  const exportCsv = (title: string, rows: Row[]) => {
    if (!rows.length) return report("There is no data in this report to export.", "error");
    const readable = rows.map((row) => ({ "Shipment reference": row.reference_number ?? "", Customer: row.customer_name ?? row.company_name ?? "", Pickup: row.pickup_location ?? "", Delivery: row.delivery_location ?? "", Equipment: row.equipment_type ?? "", "Quoted rate": row.amount_quoted ?? row.quoted_rate ?? "", "Agreed rate": row.amount_agreed ?? "", "Commercial status": row.sales_status ?? row.status ?? "", "Pickup date": row.pickup_date ?? "", "Delivery date": row.delivery_date ?? "", "Created date": row.created_at ? new Date(String(row.created_at)).toLocaleString() : "", "Last updated": row.updated_at ? new Date(String(row.updated_at)).toLocaleString() : row.created_at ? new Date(String(row.created_at)).toLocaleString() : "" }));
    const columns = Object.keys(readable[0]);
    const csv = [columns.join(","), ...readable.map((row) => columns.map((column) => JSON.stringify(row[column as keyof typeof row] ?? "")).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    report(`${title} exported as CSV without internal IDs.`);
  };

  const data = reports.data;
  const title = sales ? canViewTeamPerformance ? "Sales performance" : "My sales results" : "Operations & revenue";
  const exportRows = data ? (sales ? data.sales.shipment_rows : data.operations.rows) : [];

  return <div className="space-y-6 animate-rise">
    <PageHeader title={title} subtitle="Filter by date range and export the detail as CSV" actions={<Button variant="ink" icon={<Download size={15} />} disabled={!data} onClick={() => exportCsv(sales ? "Sales agent shipments" : "Operations report", exportRows)}>Export CSV</Button>} />

    <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
      <label className="flex flex-col text-xs font-medium text-muted">From<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      <label className="flex flex-col text-xs font-medium text-muted">To<input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-44")} /></label>
      {sales && canViewTeamPerformance && (data?.sales.agents ?? []).length > 1 && <label className="flex flex-col text-xs font-medium text-muted">Agent<select value={range.agent_id} onChange={(event) => setRange({ ...range, agent_id: event.target.value })} className={cn(controlClass, "mt-1 h-10 w-52")}><option value="">All permitted agents</option>{data!.sales.agents!.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>}
      {(range.from || range.to || range.agent_id) && <Button variant="ghost" onClick={() => setRange({ from: "", to: "", agent_id: "" })}>Clear filters</Button>}
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
            <KpiCard label="Invoiced" value={money(data.operations.totals.invoiced)} tone="accent" />
            <KpiCard label="Paid" value={money(data.operations.totals.paid)} tone="success" />
            <KpiCard label="Outstanding" value={money(data.operations.totals.outstanding)} tone="danger" />
          </>}
        </div>

        {sales && !canViewTeamPerformance ? <div className="space-y-6">
          <ShipmentTable rows={data.sales.shipment_rows} />
          <Breakdown title="Shipment status" values={data.sales.shipment_statuses} />
        </div> : <>{sales && (data.sales.agent_breakdown?.length ?? 0) > 0 && <AgentTable rows={data.sales.agent_breakdown!} onPick={(id) => setRange({ ...range, agent_id: id })} />}<div className="grid gap-6 xl:grid-cols-2">
          {sales ? <>
            <Breakdown title="Pipeline by stage" values={data.sales.lead_stages} />
            <Breakdown title="Quote outcomes" values={data.sales.quote_stages} />
            <Breakdown title="Shipment status" values={data.sales.shipment_statuses} />
            <Breakdown title="Customer outcomes" values={data.sales.customer_outcomes} />
            <Breakdown title="Opportunities by agent" values={data.sales.by_agent} />
            <Breakdown title="Team performance" values={data.sales.by_team} />
          </> : <>
            <Breakdown title="Shipment status" values={data.operations.shipment_statuses} />
            <Breakdown title="Invoice status" values={data.operations.invoice_statuses} />
            <Breakdown title="Workload by agent" values={data.operations.workload} />
            <Breakdown title="Customer volume" values={data.operations.by_customer} />
          </>}
        </div></>}
      </>}
  </div>;
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
    <CardHeader title="My shipments" subtitle="The same rows included in the CSV export" />
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
