"use client";

import { Gauge } from "lucide-react";
import { useState } from "react";
import { Avatar, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { MonthPicker } from "@/components/finance/month-picker";
import { grossLabel, progressNote } from "@/components/finance/my-performance";
import { cash, currentPeriod, roleLabel, useTeamPerformance } from "@/components/finance/finance-data";

/** Managers see their department's agents; the Super Admin sees everyone. Progress only, no pay. */
export function TeamPerformanceScreen() {
  const [period, setPeriod] = useState(currentPeriod);
  const team = useTeamPerformance(period);
  const people = team.data?.people ?? [];
  return <div className="space-y-6 animate-rise">
    <PageHeader title="Performance" subtitle="Progress towards this month's commission levels" actions={<MonthPicker value={period} onChange={setPeriod} />} />
    {team.isLoading ? <Skeleton className="h-80 rounded-card" />
      : team.isError ? <Card><EmptyState icon={Gauge} title="Performance unavailable" body={team.error.message} /></Card>
      : <Card>{people.length ? <ul className="divide-y divide-line-soft">{people.map((person) => <li key={person.user_id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <div className="flex min-w-56 flex-1 items-center gap-3"><Avatar name={person.full_name} /><div className="min-w-0"><p className="truncate font-semibold">{person.full_name}</p><p className="truncate text-xs text-muted">{roleLabel[person.role_key]} · {person.department_name ?? "—"}</p></div></div>
        <div className="min-w-32"><p className="text-xs text-muted">{person.role_key === "BROKERAGE_FRONTER_AGENT" ? "Qualified leads" : grossLabel(person)}</p><p className="font-semibold tabular-nums">{person.role_key === "BROKERAGE_FRONTER_AGENT" ? person.qualified_leads : cash(person.gross)}{person.active_sales != null ? ` · ${person.active_sales} active` : ""}</p></div>
        <p className="min-w-64 flex-1 text-sm text-muted">{progressNote(person)}</p>
      </li>)}</ul> : <EmptyState icon={Gauge} title="No one to show" body="People appear here once they are in a department." />}</Card>}
  </div>;
}
