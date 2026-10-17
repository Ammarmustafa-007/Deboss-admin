"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Building2, CheckCircle2, ChevronRight, ClipboardCheck, Send, TrendingUp, Truck, UsersRound, type LucideIcon } from "lucide-react";
import { errorMessage, useApi } from "@/lib/api";
import { loadOverview, overviewKey } from "@/lib/loaders";
import { dateTimeLabel } from "@/lib/format";
import { useSession } from "@/components/app/session";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { Card, CardHeader, EmptyState, IconTile, KpiCard, Skeleton, humanize, type Tone } from "@/components/ui/surface";

type Overview = {
  departments: { id: string }[];
  leads: { id: string }[];
  shipments: { id: string; exception_note?: string | null; invoice_ready?: boolean }[];
  quotes: { id: string; stage: string }[];
  teams: { id: string; is_active: boolean }[];
  audit: { id: string; action: string; entity_type: string; created_at: string }[];
};

export function AdminDashboard() {
  const api = useApi();
  const { profile } = useSession();
  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: () => loadOverview<Overview>(api),
  });

  const header = <header>
    <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
    <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[28px]">Welcome, {profile.full_name.split(" ")[0]}</h1>
  </header>;

  if (overview.isLoading) return <div className="space-y-6">{header}<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-card" />)}</div><Skeleton className="h-80 rounded-card" /></div>;
  if (overview.isError || !overview.data) return <div className="space-y-6">{header}<Card><EmptyState title="Brokerage overview unavailable" body={errorMessage(overview.error, "Unable to load Brokerage overview.")} /></Card></div>;

  const data = overview.data;
  const exceptions = data.shipments.filter((shipment) => shipment.exception_note).length;
  const controls: { label: string; value: number; icon: LucideIcon; tone: Tone }[] = [
    { label: "Active teams", value: data.teams.filter((team) => team.is_active).length, icon: UsersRound, tone: "accent" },
    { label: "Approved quotes", value: data.quotes.filter((quote) => quote.stage === "APPROVED").length, icon: CheckCircle2, tone: "success" },
    { label: "Handed to Operations", value: data.quotes.filter((quote) => quote.stage === "HANDED_OFF").length, icon: Send, tone: "info" },
    { label: "Open exceptions", value: exceptions, icon: AlertTriangle, tone: exceptions ? "danger" : "neutral" },
  ];

  return <div className="space-y-6 animate-rise">
    {header}
    <FinanceOverview />
    <div><h2 className="text-lg font-bold">Brokerage activity</h2><p className="text-sm text-muted">Live workflow across Sales and Operations</p></div>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Brokerage departments" value={data.departments.length} icon={Building2} tone="brand" />
      <KpiCard label="Sales leads" value={data.leads.length} icon={TrendingUp} tone="aqua" />
      <KpiCard label="Operations shipments" value={data.shipments.length} icon={Truck} tone="accent" />
      <KpiCard label="Invoice-ready" value={data.shipments.filter((shipment) => shipment.invoice_ready).length} icon={ClipboardCheck} tone="success" />
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <Card className="h-fit">
        <CardHeader title="Control points" />
        <ul className="divide-y divide-line-soft">{controls.map((item) => <li key={item.label} className="flex items-center gap-3 px-5 py-3.5">
          <IconTile icon={item.icon} tone={item.tone} size={34} />
          <span className="flex-1 text-sm">{item.label}</span>
          <span className={`text-lg font-bold tabular-nums ${item.tone === "danger" ? "text-danger" : ""}`}>{item.value}</span>
        </li>)}</ul>
        <div className="grid grid-cols-2 gap-2 border-t border-line-soft p-4">
          <Link href="/app/admin/users" className="flex items-center justify-between rounded-control border border-line px-3 py-2.5 text-sm font-medium hover:border-brand">Users<ChevronRight size={15} /></Link>
          <Link href="/app/admin/departments" className="flex items-center justify-between rounded-control border border-line px-3 py-2.5 text-sm font-medium hover:border-brand">Departments<ChevronRight size={15} /></Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Audit history" subtitle="Permissions, approvals, handoffs and status changes" />
        {data.audit.length ? <ol className="max-h-[460px] divide-y divide-line-soft overflow-y-auto">{data.audit.map((event) => <li key={event.id} className="flex items-center gap-3 px-5 py-3">
          <IconTile icon={Activity} tone="neutral" size={32} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{humanize(event.action)}</p><p className="text-xs text-muted">{humanize(event.entity_type)}</p></div>
          <time className="shrink-0 text-xs text-muted">{dateTimeLabel(event.created_at)}</time>
        </li>)}</ol> : <EmptyState icon={Activity} title="No activity yet" body="Audit history appears as Brokerage work begins." />}
      </Card>
    </div>
  </div>;
}
