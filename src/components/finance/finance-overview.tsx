"use client";

import Link from "next/link";
import { BadgeDollarSign, Banknote, ChevronRight, Hourglass, Landmark, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { Card, CardHeader, Chip, EmptyState, KpiCard, Skeleton } from "@/components/ui/surface";
import { MonthPicker } from "@/components/finance/month-picker";
import { currentPeriod, periodLabel, useFinance, type FinanceData } from "@/components/finance/finance-data";

/** Company-wide revenue, gross and profit for the Director (RP-1). */
export function FinanceOverview() {
  const [period, setPeriod] = useState(currentPeriod);
  const finance = useFinance(period);
  const data = finance.data;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">Finance</h2><p className="text-sm text-muted">Company-wide revenue, payroll and profit</p></div>
      <MonthPicker value={period} onChange={setPeriod} />
    </div>

    {finance.isLoading ? <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-card" />)}</div>
      : finance.isError || !data ? <Card><EmptyState icon={Landmark} title="Finance unavailable" body={finance.error?.message} /></Card>
      : <>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard label="Invoiced" value={money(data.invoiced)} icon={ReceiptText} tone="info" />
          <KpiCard label="Collected" value={money(data.collected)} icon={Banknote} tone="success" />
          <KpiCard label="Outstanding (all open)" value={money(data.outstanding)} icon={Hourglass} tone="accent" />
          <KpiCard label="Approved sales gross" value={money(data.approved_gross)} icon={TrendingUp} tone="aqua" />
          <KpiCard label="Payroll" value={money(data.payroll)} icon={Wallet} tone="brand" hint={data.payroll_status === "FINALIZED" ? "Finalized" : "Draft"} />
          <KpiCard label="Operating profit" value={money(data.operating_profit)} icon={BadgeDollarSign} tone={data.operating_profit < 0 ? "danger" : "success"} hint="Collected − payroll" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <TrendChart trend={data.trend} />
          <Card>
            <CardHeader title="By department" subtitle={periodLabel(period)} actions={<Link href="/app/admin/payroll" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:underline">Payroll<ChevronRight size={14} /></Link>} />
            {data.departments.length ? <ul className="divide-y divide-line-soft">{data.departments.map((department) => <li key={department.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3"><p className="truncate font-semibold">{department.name}</p><Chip tone={department.function === "SALES" ? "aqua" : "accent"}>{department.function === "SALES" ? "Sales" : "Operations"}</Chip></div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted">{department.function === "SALES" ? "Approved gross" : "Invoiced"}</dt><dd className="font-semibold tabular-nums">{money(department.revenue)}</dd></div>
                <div><dt className="text-xs text-muted">Collected</dt><dd className="font-semibold tabular-nums">{department.collected == null ? "—" : money(department.collected)}</dd></div>
                <div><dt className="text-xs text-muted">Payroll · {department.people}</dt><dd className="font-semibold tabular-nums">{money(department.payroll)}</dd></div>
              </dl>
            </li>)}</ul> : <EmptyState icon={Landmark} title="No Brokerage departments yet" />}
          </Card>
        </div>
        <p className="text-xs text-muted">Operating profit is collected revenue minus payroll. Carrier costs are not recorded in the system yet, so they are not deducted.</p>
      </>}
  </section>;
}

const series = [
  { key: "collected", label: "Collected", className: "bg-success" },
  { key: "invoiced", label: "Invoiced", className: "bg-info/70" },
  { key: "payroll", label: "Payroll", className: "bg-brand" },
] as const;

function TrendChart({ trend }: { trend: FinanceData["trend"] }) {
  const max = Math.max(1, ...trend.flatMap((point) => [point.collected, point.invoiced, point.payroll]));
  return <Card>
    <CardHeader title="Last 6 months" actions={<span className="flex flex-wrap gap-3 text-xs text-muted">{series.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", item.className)} />{item.label}</span>)}</span>} />
    <div className="flex h-64 items-end gap-3 px-5 pb-4 pt-6 sm:gap-5">
      {trend.map((point) => <div key={point.period} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
        <span className={cn("text-[11px] font-semibold tabular-nums", point.profit < 0 ? "text-[#C4254B]" : "text-[#14693A]")} title="Operating profit">{money(point.profit)}</span>
        <div className="flex w-full flex-1 items-end justify-center gap-1">
          {series.map((item) => <div key={item.key} title={`${item.label}: ${money(point[item.key])}`} className={cn("w-full max-w-4 rounded-t-[4px] transition-[height] duration-700", item.className)} style={{ height: `${Math.max(2, (point[item.key] / max) * 100)}%` }} />)}
        </div>
        <span className="text-xs text-muted">{periodLabel(point.period, true)}</span>
      </div>)}
    </div>
  </Card>;
}
