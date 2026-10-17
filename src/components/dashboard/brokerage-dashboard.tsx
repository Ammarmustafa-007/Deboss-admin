"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Hourglass, PackageCheck, RotateCcw, Send, ShieldCheck, Truck, UserRoundCheck, UserX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { dateLabel, isPast, money } from "@/lib/format";
import { useSession } from "@/components/app/session";
import { MyEarnings } from "@/components/finance/my-earnings";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, CardHeader, Chip, EmptyState, IconTile, KpiCard, StatusChip, type Tone } from "@/components/ui/surface";
import { LinkButton } from "@/components/ui/button";
import { nextAction, stageLabel, type Lead, type Quote } from "@/components/sales/model";
import { exceptionOpen, statusLabel, type Shipment } from "@/components/operations/model";

type Attention = { href: string; icon: LucideIcon; tone: Tone; title: string; detail: string };

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function BrokerageDashboard() {
  const { profile } = useSession();
  const { workspace, sales, unread } = useBrokerage();
  const firstName = profile.full_name.split(" ")[0];
  const permissions = (workspace.permissions ?? []) as string[];

  return <div className="space-y-6 animate-rise">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[28px]">{greeting()}, {firstName}</h1>
      </div>
      <LinkButton href={sales ? "/app/sales" : "/app/operations"} variant="ink" icon={sales ? <ClipboardList size={16} /> : <Truck size={16} />}>{sales ? "Open pipeline" : "Open shipments"}<ArrowRight size={15} /></LinkButton>
    </header>

    {sales ? <SalesDashboard unread={unread} /> : <OperationsDashboard unread={unread} />}

    <MyEarnings />

    {permissions.length > 0 && <Card className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-brand" />Delegated rights</span>
      {permissions.map((permission) => <Chip key={permission}>{permission.split(".").slice(1).join(" ").replaceAll("_", " ")}</Chip>)}
    </Card>}
  </div>;
}

function SalesDashboard({ unread }: { unread: number }) {
  const { workspace, manager } = useBrokerage();
  const leads = (workspace.leads ?? []) as Lead[];
  const quotes = (workspace.quotes ?? []) as Quote[];
  const quotesFor = (lead: Lead) => quotes.filter((quote) => quote.lead_id === lead.id);
  const open = leads.filter((lead) => !["CUSTOMER", "LOST"].includes(lead.stage));
  const overdue = open.filter((lead) => isPast(lead.next_follow_up_at));
  const review = leads.filter((lead) => nextAction(quotesFor(lead), manager).key === "review");
  const handoff = leads.filter((lead) => nextAction(quotesFor(lead), manager).key === "handoff");
  const rework = leads.filter((lead) => nextAction(quotesFor(lead), manager).key === "rework");

  const attention: Attention[] = [
    ...(manager ? review : []).map((lead) => ({ href: `/app/sales/leads/${lead.id}`, icon: Hourglass, tone: "brand" as Tone, title: lead.company_name, detail: "Quote waiting for your decision" })),
    ...(manager ? handoff : []).map((lead) => ({ href: `/app/sales/leads/${lead.id}`, icon: Send, tone: "success" as Tone, title: lead.company_name, detail: "Approved, ready to hand off" })),
    ...(!manager ? rework : []).map((lead) => ({ href: `/app/sales/leads/${lead.id}`, icon: RotateCcw, tone: "danger" as Tone, title: lead.company_name, detail: "Quote returned for rework" })),
    ...overdue.map((lead) => ({ href: `/app/sales/leads/${lead.id}`, icon: CalendarClock, tone: "danger" as Tone, title: lead.company_name, detail: `Follow-up overdue since ${dateLabel(lead.next_follow_up_at)}` })),
  ];

  return <>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label={manager ? "Department leads" : "Open leads"} value={manager ? leads.length : open.length} icon={ClipboardList} tone="brand" />
      <KpiCard label="Customers" value={leads.filter((lead) => lead.stage === "CUSTOMER").length} icon={UserRoundCheck} tone="success" />
      <KpiCard label={manager ? "Review required" : "Awaiting approval"} value={review.length} icon={Hourglass} tone="accent" />
      <KpiCard label="Follow-ups overdue" value={overdue.length} icon={CalendarClock} tone={overdue.length ? "danger" : "info"} />
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <AttentionCard items={attention} unread={unread} />
      <Card>
        <CardHeader title="Recently updated leads" actions={<Link href="/app/sales" className="text-xs font-semibold text-brand-deep hover:underline">View all</Link>} />
        {leads.length ? <ul className="divide-y divide-line-soft">{leads.slice(0, 6).map((lead) => {
          const action = nextAction(quotesFor(lead), manager);
          return <li key={lead.id}><Link href={`/app/sales/leads/${lead.id}`} className="group flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F4]">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{lead.company_name}</p><p className="truncate text-xs text-muted">{lead.contact_name || "No contact"} · {money(lead.estimated_monthly_value)}</p></div>
            <span className="hidden gap-1.5 sm:flex"><StatusChip status={lead.stage} label={stageLabel[lead.stage]} />{action.key !== "none" && <Chip tone={action.tone}>{action.label}</Chip>}</span>
            <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
          </Link></li>;
        })}</ul> : <EmptyState icon={ClipboardList} title="No leads yet" action={!manager && <LinkButton href="/app/sales/new" variant="primary">Create a lead</LinkButton>} />}
      </Card>
    </div>
  </>;
}

function OperationsDashboard({ unread }: { unread: number }) {
  const { workspace, manager } = useBrokerage();
  const shipments = (workspace.shipments ?? []) as Shipment[];
  const active = shipments.filter((shipment) => !["DELIVERED", "COMPLETED"].includes(shipment.status));
  const exceptions = shipments.filter(exceptionOpen);
  const unassigned = shipments.filter((shipment) => !shipment.assigned_to);

  const attention: Attention[] = [
    ...exceptions.map((shipment) => ({ href: `/app/operations/${shipment.id}`, icon: AlertTriangle, tone: "danger" as Tone, title: shipment.reference_number, detail: shipment.exception_note ?? "Exception needs resolution" })),
    ...(manager ? unassigned : []).map((shipment) => ({ href: `/app/operations/${shipment.id}`, icon: UserX, tone: "accent" as Tone, title: shipment.reference_number, detail: `${shipment.customer_name ?? "Shipment"} needs an agent` })),
  ];

  return <>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="In progress" value={active.length} icon={Truck} tone="brand" />
      {manager ? <KpiCard label="Needs assignment" value={unassigned.length} icon={UserX} tone={unassigned.length ? "accent" : "info"} /> : <KpiCard label="Delivered" value={shipments.filter((shipment) => shipment.status === "DELIVERED").length} icon={PackageCheck} tone="info" />}
      <KpiCard label="Open exceptions" value={exceptions.length} icon={AlertTriangle} tone={exceptions.length ? "danger" : "success"} />
      <KpiCard label="Invoice-ready" value={shipments.filter((shipment) => shipment.invoice_ready).length} icon={ClipboardCheck} tone="success" />
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <AttentionCard items={attention} unread={unread} />
      <Card>
        <CardHeader title="Recently updated shipments" actions={<Link href="/app/operations" className="text-xs font-semibold text-brand-deep hover:underline">View all</Link>} />
        {shipments.length ? <ul className="divide-y divide-line-soft">{shipments.slice(0, 6).map((shipment) => <li key={shipment.id}><Link href={`/app/operations/${shipment.id}`} className="group flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F4]">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{shipment.reference_number} <span className="font-normal text-muted">· {shipment.customer_name}</span></p><p className="truncate text-xs text-muted">{shipment.pickup_location} → {shipment.delivery_location}</p></div>
          <StatusChip status={shipment.status} label={statusLabel[shipment.status]} className="hidden sm:inline-flex" />
          <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
        </Link></li>)}</ul> : <EmptyState icon={Truck} title={manager ? "No shipments yet" : "No shipments assigned yet"} />}
      </Card>
    </div>
  </>;
}

function AttentionCard({ items, unread }: { items: Attention[]; unread: number }) {
  return <Card className="h-fit">
    <CardHeader title="Needs your attention" actions={items.length > 0 && <Chip tone="danger">{items.length}</Chip>} />
    {unread > 0 && <Link href="/app/notifications" className="flex items-center gap-3 border-b border-line-soft px-5 py-3 hover:bg-[#FAF8F4]">
      <IconTile icon={Bell} tone="info" size={34} />
      <p className="flex-1 text-sm font-medium">{unread} unread notification{unread === 1 ? "" : "s"}</p>
      <ChevronRight size={16} className="text-muted" />
    </Link>}
    {items.length ? <ul className={cn("divide-y divide-line-soft", items.length > 6 && "max-h-[420px] overflow-y-auto")}>{items.map((item, index) => <li key={`${item.href}-${index}`}><Link href={item.href} className="group flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F4]">
      <IconTile icon={item.icon} tone={item.tone} size={34} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-muted">{item.detail}</p></div>
      <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
    </Link></li>)}</ul> : !unread && <EmptyState icon={CheckCircle2} title="You're all caught up" className="py-10" />}
  </Card>;
}
