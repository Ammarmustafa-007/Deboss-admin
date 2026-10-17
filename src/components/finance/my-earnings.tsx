"use client";

import { ChevronDown, Wallet } from "lucide-react";
import { useState } from "react";
import { dateLabel } from "@/lib/format";
import { Card, Chip, IconTile, Skeleton } from "@/components/ui/surface";
import { MonthPicker } from "@/components/finance/month-picker";
import { basisDescription, basisLabel, currentPeriod, useMyEarnings, cash } from "@/components/finance/finance-data";

/** The signed-in person's own base + commission for a month (PY-4). Nobody else's figures are ever requested. */
export function MyEarnings() {
  const [period, setPeriod] = useState(currentPeriod);
  const earnings = useMyEarnings(period);
  const line = earnings.data?.line;
  const final = earnings.data?.status === "FINALIZED";

  return <Card className="p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><IconTile icon={Wallet} tone="success" /><div><h2 className="text-[15px] font-semibold">My earnings</h2><p className="text-xs text-muted">Only you can see this</p></div></div>
      <MonthPicker value={period} onChange={setPeriod} />
    </div>

    {earnings.isLoading ? <Skeleton className="mt-5 h-20" />
      : earnings.isError ? <p className="mt-5 text-sm text-muted">{earnings.error.message}</p>
      : !line ? <p className="mt-5 text-sm text-muted">You weren&apos;t on payroll for this month.</p>
      : <>
        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div><p className="text-xs text-muted">Total</p><p className="text-3xl font-bold tracking-tight tabular-nums">{cash(line.total)}</p></div>
          <div><p className="text-xs text-muted">Base salary</p><p className="font-semibold tabular-nums">{cash(line.base_salary)}</p></div>
          <div><p className="text-xs text-muted">Commission · {line.commission_rate}% of {cash(line.basis_amount)}</p><p className="font-semibold tabular-nums">{cash(line.commission_amount)}</p></div>
          <Chip tone={final ? "success" : "brand"} className="mb-1">{final ? "Final" : "Estimate"}</Chip>
        </div>
        {!line.configured && <p className="mt-3 text-xs text-brand-deep">Your compensation hasn&apos;t been set up yet. Ask your Director.</p>}
        <details className="group mt-4 rounded-control border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium">{basisLabel[line.commission_basis]} · {line.items.length} record{line.items.length === 1 ? "" : "s"}<ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" /></summary>
          <div className="border-t border-line-soft px-4 py-3">
            <p className="mb-2 text-xs text-muted">{basisDescription(line.commission_basis, line.role_key)}</p>
            {line.items.length ? <ul className="max-h-56 divide-y divide-line-soft overflow-y-auto">{line.items.map((item, index) => <li key={`${item.reference}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{item.reference} <span className="text-muted">· {item.customer ?? "—"}{item.date ? ` · ${dateLabel(item.date)}` : ""}</span></span><span className="font-semibold tabular-nums">{cash(item.amount)}</span></li>)}</ul> : <p className="text-sm text-muted">Nothing counted yet this month.</p>}
          </div>
        </details>
      </>}
  </Card>;
}
