"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, ClipboardCheck, PackageCheck, Search, Truck, UserX } from "lucide-react";
import { useMemo, useState, type SyntheticEvent } from "react";
import { cn } from "@/lib/cn";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, Chip, EmptyState, KpiCard, PageHeader, StatusChip } from "@/components/ui/surface";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { controlClass } from "@/components/ui/field";
import { exceptionOpen, statusLabel, useOperationsDirectory, type Shipment } from "@/components/operations/model";

type Filter = "all" | "unassigned" | "exceptions" | "active" | "DELIVERED" | "COMPLETED";

export function ShipmentsScreen() {
  const router = useRouter();
  const { workspace, manager } = useBrokerage();
  const shipments = useMemo(() => (workspace.shipments ?? []) as Shipment[], [workspace.shipments]);
  const directory = useOperationsDirectory(manager);
  const { run, busy } = useBrokerageAction();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const users = directory.data?.users ?? [];
  const teams = directory.data?.teams ?? [];
  const nameOf = (id?: string | null) => users.find((user) => user.id === id)?.full_name;

  const active = (shipment: Shipment) => !["DELIVERED", "COMPLETED"].includes(shipment.status);
  const counts = {
    unassigned: shipments.filter((shipment) => !shipment.assigned_to).length,
    exceptions: shipments.filter(exceptionOpen).length,
    active: shipments.filter(active).length,
    DELIVERED: shipments.filter((shipment) => shipment.status === "DELIVERED").length,
    COMPLETED: shipments.filter((shipment) => shipment.status === "COMPLETED").length,
  };
  const tabs: TabItem<Filter>[] = [
    { value: "all", label: "All", count: shipments.length },
    { value: "unassigned", label: "Needs assignment", count: counts.unassigned, hidden: !manager || !counts.unassigned },
    { value: "exceptions", label: "Exceptions", count: counts.exceptions, hidden: !counts.exceptions },
    { value: "active", label: "In progress", count: counts.active },
    { value: "DELIVERED", label: "Delivered", count: counts.DELIVERED },
    { value: "COMPLETED", label: "Completed", count: counts.COMPLETED },
  ];

  const term = search.trim().toLowerCase();
  const visible = shipments.filter((shipment) => {
    if (filter === "unassigned" && shipment.assigned_to) return false;
    if (filter === "exceptions" && !exceptionOpen(shipment)) return false;
    if (filter === "active" && !active(shipment)) return false;
    if ((filter === "DELIVERED" || filter === "COMPLETED") && shipment.status !== filter) return false;
    return !term || `${shipment.reference_number} ${shipment.customer_name ?? ""} ${shipment.pickup_location ?? ""} ${shipment.delivery_location ?? ""}`.toLowerCase().includes(term);
  });

  const assign = (shipment: Shipment, patch: { assigned_to?: string | null; team_id?: string | null }) => void run(`assign:${shipment.id}`, `/api/v1/brokerage/shipments/${shipment.id}`, "PATCH", patch, "Shipment assignment updated.");
  const stop = (event: SyntheticEvent) => event.stopPropagation();

  return <div className="space-y-6 animate-rise">
    <PageHeader title={manager ? "Operations board" : "My shipments"} subtitle={manager ? "Assign, track and close every handed-off shipment" : "Shipments assigned to you or your team"} />

    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="In progress" value={counts.active} icon={Truck} tone="brand" />
      {manager ? <KpiCard label="Needs assignment" value={counts.unassigned} icon={UserX} tone={counts.unassigned ? "accent" : "info"} /> : <KpiCard label="Delivered" value={counts.DELIVERED} icon={PackageCheck} tone="info" />}
      <KpiCard label="Open exceptions" value={counts.exceptions} icon={AlertTriangle} tone={counts.exceptions ? "danger" : "success"} />
      <KpiCard label="Invoice-ready" value={shipments.filter((shipment) => shipment.invoice_ready).length} icon={ClipboardCheck} tone="success" />
    </div>

    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={filter} onChange={setFilter} className="-mb-px border-b-0 lg:flex-1" />
        <label className="relative mb-3 block lg:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shipments" aria-label="Search shipments" className={cn(controlClass, "h-10 pl-9")} />
        </label>
      </div>
      <div className="border-t border-line">
        {visible.length ? <>
          <table className="hidden w-full text-sm lg:table">
            <thead><tr className="text-left text-xs text-muted">
              <th className="px-5 py-2.5 font-medium">Shipment</th>
              <th className="px-3 py-2.5 font-medium">Lane</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              {manager && <th className="px-3 py-2.5 font-medium">Assignment</th>}
              <th className="w-10" />
            </tr></thead>
            <tbody>
              {visible.map((shipment) => {
                const pending = busy(`assign:${shipment.id}`);
                return <tr key={shipment.id} onClick={() => router.push(`/app/operations/${shipment.id}`)} className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-[#FAF8F4]">
                  <td className="px-5 py-3.5"><Link href={`/app/operations/${shipment.id}`} onClick={stop} className="font-semibold hover:text-brand-deep">{shipment.reference_number}</Link><p className="mt-0.5 text-xs text-muted">{shipment.customer_name || "—"}</p></td>
                  <td className="px-3 py-3.5 text-[13px]">{shipment.pickup_location || "—"} <span className="text-brand">→</span> {shipment.delivery_location || "—"}</td>
                  <td className="px-3 py-3.5"><span className="flex flex-wrap gap-1.5"><StatusChip status={shipment.status} label={statusLabel[shipment.status]} />{exceptionOpen(shipment) && shipment.status !== "EXCEPTION" && <Chip tone="danger">Exception</Chip>}{shipment.invoice_ready && <Chip tone="success">Invoice-ready</Chip>}</span></td>
                  {manager && <td className="px-3 py-2.5" onClick={stop}>
                    <div className={cn("flex flex-wrap gap-2", pending && "opacity-60")}>
                      <select aria-label={`Assign agent for ${shipment.reference_number}`} disabled={pending || busy()} value={shipment.assigned_to ?? ""} onChange={(event) => assign(shipment, { assigned_to: event.target.value || null })} className={cn(controlClass, "h-9 w-40 text-xs", !shipment.assigned_to && "border-accent/50 text-accent")}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>
                      <select aria-label={`Assign team for ${shipment.reference_number}`} disabled={pending || busy()} value={shipment.team_id ?? ""} onChange={(event) => assign(shipment, { team_id: event.target.value || null })} className={cn(controlClass, "h-9 w-36 text-xs")}><option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
                    </div>
                  </td>}
                  <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
                </tr>;
              })}
            </tbody>
          </table>
          <ul className="divide-y divide-line-soft lg:hidden">
            {visible.map((shipment) => <li key={shipment.id}><Link href={`/app/operations/${shipment.id}`} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{shipment.reference_number} <span className="font-normal text-muted">· {shipment.customer_name}</span></p>
                <p className="truncate text-xs text-muted">{shipment.pickup_location} → {shipment.delivery_location}{manager ? ` · ${nameOf(shipment.assigned_to) ?? "Unassigned"}` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><StatusChip status={shipment.status} label={statusLabel[shipment.status]} />{exceptionOpen(shipment) && shipment.status !== "EXCEPTION" && <Chip tone="danger">Exception</Chip>}</div>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Link></li>)}
          </ul>
        </> : <EmptyState icon={term ? Search : Truck} title={term ? "No shipments match your search" : shipments.length ? "Nothing in this view" : manager ? "No shipments to assign yet" : "No shipments assigned to you yet"} body={!shipments.length ? (manager ? "Approved Sales quotes appear here once they're handed to Operations." : "Shipments appear here when your manager assigns them to you or your team.") : undefined} />}
      </div>
    </Card>
  </div>;
}
