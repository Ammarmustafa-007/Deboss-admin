"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Gauge, PlayCircle, Search, Truck as TruckIcon, UserX } from "lucide-react";
import { useMemo, useState, type SyntheticEvent } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, money } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/field";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { truckStatusLabel, truckTypeLabel, useDispatchDirectory, useTrucks, weekLabel, type Truck } from "@/components/dispatch/model";

type Filter = "all" | "unassigned" | "ONBOARDED" | "RUNNING" | "INACTIVE" | "closed";

/** Dispatch Operations board (answer 1) and the Dispatcher's own trucks (DP-1, DP-6). */
export function TrucksScreen() {
  const router = useRouter();
  const { manager, teamLead, workspace } = useBrokerage();
  const canAssign = manager || Boolean(workspace.capabilities?.canAssignTrucks);
  const showPeople = manager || teamLead;
  const directory = useDispatchDirectory(showPeople);
  const trucks = useTrucks();
  const { run, busy } = useBrokerageAction();
  const list = useMemo(() => trucks.data?.trucks ?? [], [trucks.data]);
  const [filter, setFilter] = useState<Filter>(canAssign && list.some((truck) => truck.status === "ACTIVE") ? "unassigned" : "all");
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("");
  const users = directory.data?.users ?? [];
  const teams = directory.data?.teams ?? [];
  const count = (predicate: (truck: Truck) => boolean) => list.filter(predicate).length;
  const unassigned = (truck: Truck) => truck.status === "ACTIVE" || (!truck.assigned_to && !["DNC", "DISCARDED"].includes(truck.status));
  const tabs: TabItem<Filter>[] = [
    { value: "all", label: "All", count: list.length },
    { value: "unassigned", label: "Needs a dispatcher", count: count(unassigned), hidden: !canAssign },
    { value: "ONBOARDED", label: "Onboarded", count: count((truck) => truck.status === "ONBOARDED") },
    { value: "RUNNING", label: "Running", count: count((truck) => truck.status === "RUNNING") },
    { value: "INACTIVE", label: "Inactive", count: count((truck) => truck.status === "INACTIVE") },
    { value: "closed", label: "DNC / discarded", count: count((truck) => ["DNC", "DISCARDED"].includes(truck.status)), hidden: !count((truck) => ["DNC", "DISCARDED"].includes(truck.status)) },
  ];
  const term = search.trim().toLowerCase();
  const visible = list.filter((truck) => {
    if (filter === "unassigned" && !unassigned(truck)) return false;
    if (filter === "closed" && !["DNC", "DISCARDED"].includes(truck.status)) return false;
    if (!["all", "unassigned", "closed"].includes(filter) && truck.status !== filter) return false;
    if (agent === "unassigned" ? Boolean(truck.assigned_to) : agent && truck.assigned_to !== agent) return false;
    return !term || [truck.unit_number, truck.carrier?.company_name, truck.carrier?.mc_number, truck.carrier?.dot_number, truck.assigned_name, truckTypeLabel[truck.truck_type]].some((value) => value?.toLowerCase().includes(term));
  });
  const assign = (truck: Truck, patch: { assigned_to?: string | null; team_id?: string | null }) => void run(`assign:${truck.id}`, `/api/v1/dispatch/trucks/${truck.id}`, "PATCH", patch, patch.assigned_to ? "Truck assigned. The Dispatcher is notified." : "Truck assignment updated.");
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const weekGross = list.reduce((sum, truck) => sum + Number(truck.week_gross ?? 0), 0);

  return <div className="space-y-6 animate-rise">
    <PageHeader title={manager ? "Dispatch board" : teamLead ? "Team trucks" : "My trucks"} subtitle={manager ? "Assign handed-off trucks to Dispatchers and follow their progress" : `This week: ${trucks.data ? weekLabel(trucks.data.week_start) : "…"}`} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {canAssign ? <KpiCard label="Needs a dispatcher" value={count(unassigned)} icon={UserX} tone={count(unassigned) ? "accent" : "info"} /> : <KpiCard label="Onboarded" value={count((truck) => ["ONBOARDED", "RUNNING", "INACTIVE"].includes(truck.status))} icon={TruckIcon} tone="info" />}
      <KpiCard label="Running" value={count((truck) => truck.status === "RUNNING")} icon={PlayCircle} tone="success" />
      <KpiCard label="Inactive" value={count((truck) => truck.status === "INACTIVE")} icon={AlertTriangle} tone={count((truck) => truck.status === "INACTIVE") ? "danger" : "neutral"} />
      <KpiCard label="Gross this week" value={money(weekGross)} icon={Gauge} tone="brand" />
    </div>
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={filter} onChange={setFilter} className="min-w-0 flex-1" />
        <div className="flex flex-col gap-2 pb-3 sm:flex-row">
          {showPeople && <select value={agent} onChange={(event) => setAgent(event.target.value)} aria-label="Filter by dispatcher" className={cn(controlClass, "h-10 sm:w-48")}><option value="">All dispatchers</option>{count(unassigned) > 0 && <option value="unassigned">Unassigned ({count(unassigned)})</option>}{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>}
          <div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Unit, carrier, MC/DOT or dispatcher" aria-label="Search trucks" className={cn(controlClass, "h-10 pl-9")} /></div>
        </div>
      </div>
      {trucks.isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14" />)}</div>
        : trucks.isError ? <EmptyState icon={AlertTriangle} title="Trucks unavailable" body={errorMessage(trucks.error)} />
        : visible.length ? <div className="overflow-x-auto border-t border-line-soft"><table className="w-full min-w-[820px] text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Truck</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 text-right font-medium">This week</th><th className="px-3 py-2.5 font-medium">Last load</th><th className="px-3 py-2.5 font-medium">{canAssign ? "Assignment" : "Dispatcher"}</th><th className="w-10" /></tr></thead>
          <tbody>{visible.map((truck) => { const pending = busy(`assign:${truck.id}`); return <tr key={truck.id} onClick={() => router.push(`/app/dispatch/trucks/${truck.id}`)} className="group cursor-pointer border-t border-line-soft hover:bg-[#FAF8F4]">
            <td className="px-5 py-3"><Link href={`/app/dispatch/trucks/${truck.id}`} onClick={stop} className="font-semibold hover:text-brand-deep">{truck.unit_number}</Link><p className="text-xs text-muted">{truck.carrier?.company_name} · {truckTypeLabel[truck.truck_type]}</p></td>
            <td className="px-3 py-3"><StatusChip status={truck.status} label={truckStatusLabel[truck.status]} /></td>
            <td className="px-3 py-3 text-right tabular-nums">{money(truck.week_gross)}<p className="text-xs text-muted">{truck.week_loads ?? 0} load{truck.week_loads === 1 ? "" : "s"}</p></td>
            <td className="px-3 py-3 text-[13px] text-ink/75">{dateLabel(truck.last_load_date)}</td>
            <td className="px-3 py-2.5" onClick={stop}>{canAssign && !["DNC", "DISCARDED"].includes(truck.status) ? <div className={cn("flex flex-wrap gap-2", pending && "opacity-60")}>
              <select aria-label={`Dispatcher for ${truck.unit_number}`} disabled={pending || busy()} value={truck.assigned_to ?? ""} onChange={(event) => assign(truck, { assigned_to: event.target.value || null })} className={cn(controlClass, "h-9 w-40 text-xs", !truck.assigned_to && "border-accent/50 text-accent")}><option value="">Needs a dispatcher</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>
              {teams.length > 0 && <select aria-label={`Team for ${truck.unit_number}`} disabled={pending || busy()} value={truck.team_id ?? ""} onChange={(event) => assign(truck, { team_id: event.target.value || null })} className={cn(controlClass, "h-9 w-32 text-xs")}><option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>}
            </div> : <span className={cn("text-[13px]", !truck.assigned_to && "text-accent")}>{truck.assigned_name ?? "Unassigned"}</span>}</td>
            <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
          </tr>; })}</tbody>
        </table></div>
        : <EmptyState icon={term ? Search : TruckIcon} title={term ? "No trucks match your search" : list.length ? "Nothing in this view" : manager ? "No trucks handed off yet" : "No trucks assigned to you yet"} body={!list.length ? (manager ? "Approved carriers from Dispatch Sales appear here, ready to assign." : "Your manager assigns trucks to you here.") : undefined} />}
    </Card>
  </div>;
}
