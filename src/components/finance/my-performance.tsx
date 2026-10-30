"use client";

import { Gauge } from "lucide-react";
import { useState } from "react";
import { Card, IconTile, Skeleton } from "@/components/ui/surface";
import { MonthPicker } from "@/components/finance/month-picker";
import { cash, currentPeriod, useMyPerformance, type Progress } from "@/components/finance/finance-data";

/** Fronter Managers are paid as Brokerage Sales Agents, so they follow commission levels like any agent. */
const paidOnProfit = (progress: Progress) => progress.role_key.endsWith("MANAGER") && progress.role_key !== "BROKERAGE_FRONTER_MANAGER";

/** One line on where someone stands against their commission levels. Progress only: no pay figures. */
export function progressNote(progress: Progress) {
  if (progress.role_key === "BROKERAGE_FRONTER_AGENT") return "Paid for each lead qualified this month.";
  if (paidOnProfit(progress)) return "Your department's income this month.";
  if (progress.role_key === "DISPATCH_SALES_AGENT") return progress.reached ? `Target met: ${progress.rate}% commission level.` : `${progress.sales_to_target} more active sale${progress.sales_to_target === 1 ? "" : "s"} to reach the ${progress.next_rate}% level.`;
  if (!progress.reached) return `${cash((progress.target ?? 0) - progress.gross)} to the first target of ${cash(progress.target)}.`;
  return progress.next_level ? `At the ${progress.rate}% level. ${cash(progress.to_next)} to reach ${progress.next_rate}%.` : `At the top level, ${progress.rate}%.`;
}

export function grossLabel(progress: Progress) {
  if (progress.role_key === "DISPATCH_SALES_AGENT") return "Paid from your sales";
  return paidOnProfit(progress) ? "Department income" : "Gross";
}

/** The signed-in person's own progress for a month. Payslips stay with the Super Admin. */
export function MyPerformance() {
  const [period, setPeriod] = useState(currentPeriod);
  const performance = useMyPerformance(period);
  const progress = performance.data?.progress;
  const fronter = progress?.role_key === "BROKERAGE_FRONTER_AGENT";
  return <Card className="p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><IconTile icon={Gauge} tone="success" /><div><h2 className="text-[15px] font-semibold">My performance</h2><p className="text-xs text-muted">Your progress this month</p></div></div>
      <MonthPicker value={period} onChange={setPeriod} />
    </div>
    {performance.isLoading ? <Skeleton className="mt-5 h-20" />
      : performance.isError ? <p className="mt-5 text-sm text-muted">{performance.error.message}</p>
      : !progress ? <p className="mt-5 text-sm text-muted">Nothing to show for this month.</p>
      : <>
        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div><p className="text-xs text-muted">{fronter ? "Qualified leads" : grossLabel(progress)}</p><p className="text-3xl font-bold tracking-tight tabular-nums">{fronter ? progress.qualified_leads : cash(progress.gross)}</p></div>
          {progress.active_sales != null && <div><p className="text-xs text-muted">Active sales</p><p className="font-semibold tabular-nums">{progress.active_sales} of {progress.active_sales_target}</p></div>}
        </div>
        <p className="mt-3 text-sm text-muted">{progressNote(progress)}</p>
      </>}
  </Card>;
}
