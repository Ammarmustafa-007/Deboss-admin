"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, Banknote, CheckCircle2, Clock, Download, Forward, Goal, MapPinned, ReceiptText, RotateCcw, Search, Send, ShieldCheck, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, dateTimeLabel, money } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, Chip, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip, humanize } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField, controlClass } from "@/components/ui/field";
import { Drawer } from "@/components/ui/overlay";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { CommentFeed, Composer } from "@/components/sales/feed";
import { invoiceStatusLabel, loadStatusLabel, pct, truckTypeLabel, useDispatchInvoices, weekLabel, type DispatchInvoice, type Load } from "@/components/dispatch/model";

// ---- Loads search (DP-4) ---------------------------------------------------------------------------------------
export function LoadsScreen() {
  const { api } = useBrokerage();
  const { profile } = useSession();
  const [filters, setFilters] = useState({ zip: "", lane: "", from: "", to: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const loads = useQuery({
    queryKey: ["brokerage", "dispatch", "loads", applied],
    queryFn: async () => (await responseData<{ loads: Load[] }>(await api(`/api/v1/dispatch/loads?${new URLSearchParams(Object.entries(applied).filter(([, value]) => value)).toString()}`))).loads,
    staleTime: 15_000,
  });
  const list = loads.data ?? [];
  const live = list.filter((load) => load.status !== "CANCELLED");
  const search = (event: FormEvent) => { event.preventDefault(); setApplied(filters); };
  const exportLoads = () => void downloadExcel("Loads", [{ name: "Loads", title: "Loads", columns: [
    { header: "Pickup date", key: "pickup_date", type: "date" }, { header: "Load #", key: "load_number" }, { header: "Truck", key: "truck" }, { header: "Carrier", key: "carrier" }, { header: "Dispatcher", key: "dispatcher_name" },
    { header: "Pickup city", key: "pickup_city" }, { header: "Pickup zip", key: "pickup_zip" }, { header: "Delivery city", key: "delivery_city" }, { header: "Delivery zip", key: "delivery_zip" }, { header: "Delivery date", key: "delivery_date", type: "date" },
    { header: "Broker", key: "broker_name" }, { header: "Status", key: "status", type: "status" }, { header: "Miles", key: "miles", type: "number" }, { header: "Rate", key: "rate", type: "money" },
  ], rows: list.map((load) => ({ ...load, truck: load.truck?.unit_number, carrier: load.carrier?.company_name })), totals: { rate: live.reduce((sum, load) => sum + Number(load.rate), 0) } }], { exportedBy: profile.full_name });

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Loads" subtitle="Search every load by zip code, city, lane, broker or date" actions={<Button variant="outline" icon={<Download size={15} />} disabled={!list.length} onClick={exportLoads}>Export Excel</Button>} />
    <Card className="p-5"><form onSubmit={search} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_1fr_1fr_auto] xl:items-end">
      <TextField label="Zip code" maxLength={10} placeholder="Pickup or delivery" value={filters.zip} onChange={(event) => setFilters({ ...filters, zip: event.target.value })} />
      <TextField label="City, lane, broker or load #" maxLength={120} value={filters.lane} onChange={(event) => setFilters({ ...filters, lane: event.target.value })} />
      <TextField label="From" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
      <TextField label="To" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink/80">Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className={cn(controlClass, "h-11")}><option value="">Any</option>{Object.entries(loadStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <Button type="submit" variant="ink" icon={<Search size={15} />} className="h-11">Search</Button>
    </form></Card>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      <KpiCard label="Loads found" value={live.length} icon={MapPinned} tone="brand" />
      <KpiCard label="Gross" value={money(live.reduce((sum, load) => sum + Number(load.rate), 0))} tone="success" />
      <KpiCard label="Miles" value={live.reduce((sum, load) => sum + Number(load.miles ?? 0), 0).toLocaleString()} tone="aqua" className="col-span-2 xl:col-span-1" />
    </div>
    <Card>{loads.isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12" />)}</div>
      : loads.isError ? <EmptyState icon={AlertTriangle} title="Loads unavailable" body={errorMessage(loads.error)} />
      : list.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Pickup</th><th className="px-3 py-2.5 font-medium">Lane</th><th className="px-3 py-2.5 font-medium">Truck</th><th className="px-3 py-2.5 font-medium">Dispatcher</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-5 py-2.5 text-right font-medium">Rate</th></tr></thead>
        <tbody>{list.map((load) => <tr key={load.id} className="border-t border-line-soft">
          <td className="px-5 py-3 text-[13px]">{dateLabel(load.pickup_date)}<p className="text-xs text-muted">{load.load_number || "—"}</p></td>
          <td className="px-3 py-3 text-[13px]">{[load.pickup_city, load.pickup_zip].filter(Boolean).join(" ") || "—"} <span className="text-brand">→</span> {[load.delivery_city, load.delivery_zip].filter(Boolean).join(" ") || "—"}<p className="text-xs text-muted">{load.broker_name || ""}</p></td>
          <td className="px-3 py-3 text-[13px]">{load.truck ? <Link href={`/app/dispatch/trucks/${load.truck.id}`} className="font-medium hover:text-brand-deep">{load.truck.unit_number}</Link> : "—"}<p className="text-xs text-muted">{load.carrier?.company_name}</p></td>
          <td className="px-3 py-3 text-[13px]">{load.dispatcher_name ?? "—"}</td>
          <td className="px-3 py-3"><StatusChip status={load.status === "BOOKED" ? "PENDING" : load.status} label={loadStatusLabel[load.status]} /></td>
          <td className="px-5 py-3 text-right font-semibold tabular-nums">{money(load.rate)}</td>
        </tr>)}</tbody>
      </table></div> : <EmptyState icon={MapPinned} title="No loads match" body="Loads appear here as Dispatchers log them on their trucks." />}
    </Card>
  </div>;
}

// ---- Weekly invoices (DP-8, DP-9, DS-12, answer 2) ---------------------------------------------------------------
type InvoiceFilter = "all" | "DRAFT" | "SUBMITTED" | "FORWARDED" | "PAID" | "signoff" | "overdue";

export function DispatchInvoicesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("open");
  const { sales, manager, workspace } = useBrokerage();
  const invoices = useDispatchInvoices();
  const list = invoices.data ?? [];
  const reviewer = !sales && (manager || Boolean(workspace.capabilities?.canReviewInvoices));
  const signer = sales && (manager || Boolean(workspace.capabilities?.canSignOffInvoices));
  const count = (predicate: (invoice: DispatchInvoice) => boolean) => list.filter(predicate).length;
  const awaitingSignoff = (invoice: DispatchInvoice) => invoice.status === "PAID" && !invoice.signed_off_at;
  const [filter, setFilter] = useState<InvoiceFilter>(reviewer && count((invoice) => invoice.status === "SUBMITTED") ? "SUBMITTED" : signer && count(awaitingSignoff) ? "signoff" : "all");
  const tabs: TabItem<InvoiceFilter>[] = [
    { value: "all", label: "All", count: list.length },
    { value: "DRAFT", label: "Draft", count: count((invoice) => invoice.status === "DRAFT"), hidden: sales },
    { value: "SUBMITTED", label: reviewer ? "To review" : "Submitted", count: count((invoice) => invoice.status === "SUBMITTED") },
    { value: "FORWARDED", label: "Forwarded", count: count((invoice) => invoice.status === "FORWARDED") },
    { value: "PAID", label: "Paid", count: count((invoice) => invoice.status === "PAID") },
    { value: "signoff", label: "Awaiting sign-off", count: count(awaitingSignoff), hidden: !count(awaitingSignoff) },
    { value: "overdue", label: "Overdue", count: count((invoice) => Boolean(invoice.overdue)), hidden: !count((invoice) => Boolean(invoice.overdue)) },
  ];
  const visible = list.filter((invoice) => filter === "all" ? true : filter === "signoff" ? awaitingSignoff(invoice) : filter === "overdue" ? invoice.overdue : invoice.status === filter);
  const sum = (rows: DispatchInvoice[], key: "amount" | "amount_paid" | "outstanding") => rows.filter((invoice) => invoice.status !== "CANCELLED").reduce((total, invoice) => total + Number(invoice[key] ?? 0), 0);
  const open = (id: string | null) => router.replace(id ? `/app/dispatch/invoices?open=${id}` : "/app/dispatch/invoices", { scroll: false });

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Weekly invoices" subtitle={sales ? "Invoices for your carriers' trucks · sign off paid sales" : reviewer ? "Review the Dispatchers' weekly invoices and forward them to accounting" : "Create, submit and track your trucks' weekly invoices"} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Invoiced" value={money(sum(list, "amount"))} icon={ReceiptText} tone="brand" />
      <KpiCard label="Collected" value={money(sum(list, "amount_paid"))} icon={Banknote} tone="success" />
      <KpiCard label="Outstanding" value={money(sum(list, "outstanding"))} icon={Clock} tone="accent" />
      <KpiCard label="Overdue" value={count((invoice) => Boolean(invoice.overdue))} icon={AlertTriangle} tone={count((invoice) => Boolean(invoice.overdue)) ? "danger" : "info"} />
    </div>
    <Card>
      <div className="px-5 pt-4"><Tabs items={tabs} value={filter} onChange={setFilter} /></div>
      {invoices.isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14" />)}</div>
        : invoices.isError ? <EmptyState icon={AlertTriangle} title="Invoices unavailable" body={errorMessage(invoices.error)} />
        : visible.length ? <ul className="divide-y divide-line-soft">{visible.map((invoice) => <li key={invoice.id}><button type="button" onClick={() => open(invoice.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-[#FAF8F4]">
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{invoice.invoice_number}</p><p className="truncate text-xs text-muted">{invoice.carrier?.company_name} · {invoice.truck?.unit_number} · week {weekLabel(invoice.week_start)} · {invoice.dispatcher_name}</p></div>
          <span className="hidden text-right text-xs text-muted sm:block">gross {money(invoice.gross_amount)}<br />× {pct(invoice.charge_percent)}</span>
          <b className="w-24 text-right tabular-nums">{money(invoice.amount)}</b>
          <StatusChip status={invoice.overdue ? "OVERDUE" : invoice.status} label={invoice.overdue ? "Overdue" : invoiceStatusLabel[invoice.status]} />
          {invoice.signed_off_at && <Chip tone="success">Signed off</Chip>}
        </button></li>)}</ul>
        : <EmptyState icon={ReceiptText} title={list.length ? "Nothing in this view" : "No weekly invoices yet"} body={!list.length && !sales ? "Dispatchers create them from a truck's Weekly invoices tab." : undefined} />}
    </Card>
    {openId && <InvoiceDrawer id={openId} onClose={() => open(null)} />}
  </div>;
}

type InvoiceDetail = { invoice: DispatchInvoice; loads: Load[]; comments: { id: string; body: string; author_name?: string; created_at: string; can_delete?: boolean }[]; history: { id: string; action: string; actor_name?: string | null; created_at: string; detail?: { from_status?: string; to_status?: string } }[]; rights: { dispatcher: boolean; reviewer: boolean; sign_off: boolean } };

function InvoiceDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { api } = useBrokerage();
  const detail = useQuery({ queryKey: ["brokerage", "dispatch", "invoice", id], queryFn: async () => responseData<InvoiceDetail>(await api(`/api/v1/dispatch/invoices/${id}/detail`)) });
  const { run, busy } = useBrokerageAction();
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState("");
  const data = detail.data;
  const invoice = data?.invoice;
  const pending = busy("invoice-action");
  const act = (action: string, success: string, extra: Record<string, unknown> = {}) => void run("invoice-action", `/api/v1/dispatch/invoices/${id}/actions`, "POST", { action, note: note || undefined, ...extra }, success).then((result) => { if (result !== undefined) { setNote(""); setPaid(""); } });
  const paidAmount = paid === "" ? undefined : Number(paid);
  const paidError = paid !== "" && (!Number.isFinite(paidAmount) || (paidAmount ?? 0) < 0) ? "Enter an amount of 0 or more." : undefined;

  return <Drawer open onClose={onClose} dismissible={!pending} title={invoice?.invoice_number ?? "Weekly invoice"} subtitle={invoice ? `${invoice.carrier?.company_name} · ${invoice.truck?.unit_number} · week ${weekLabel(invoice.week_start)}` : undefined} className="max-w-2xl">
    {detail.isLoading || !data || !invoice ? (detail.isError ? <EmptyState icon={AlertTriangle} title="Invoice unavailable" body={errorMessage(detail.error)} /> : <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>) : <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2"><StatusChip status={invoice.overdue ? "OVERDUE" : invoice.status} label={invoice.overdue ? "Overdue" : invoiceStatusLabel[invoice.status]} />{invoice.signed_off_at && <Chip tone="success">Signed off {dateLabel(invoice.signed_off_at)}</Chip>}</div>
      {invoice.review_note && invoice.status === "DRAFT" && <p className="rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm text-[#A5183F]"><b>Returned:</b> {invoice.review_note}</p>}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[14px] border border-line-soft bg-[#FBFAF7] p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted">Gross (loads)</dt><dd className="font-semibold tabular-nums">{money(invoice.gross_amount)}</dd></div>
        <div><dt className="text-xs text-muted">Charge %</dt><dd className="font-semibold">{pct(invoice.charge_percent)}</dd></div>
        <div><dt className="text-xs text-muted">Invoice amount</dt><dd className="text-base font-bold tabular-nums">{money(invoice.amount)}</dd></div>
        <div><dt className="text-xs text-muted">Paid</dt><dd className="tabular-nums">{money(invoice.amount_paid)}</dd></div>
        <div><dt className="text-xs text-muted">Outstanding</dt><dd className={cn("tabular-nums", Number(invoice.outstanding) > 0 && "font-semibold text-[#A5183F]")}>{money(invoice.outstanding)}</dd></div>
        <div><dt className="text-xs text-muted">Due</dt><dd>{dateLabel(invoice.due_date)}</dd></div>
        <div><dt className="text-xs text-muted">Dispatcher</dt><dd>{invoice.dispatcher_name ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted">Sales agent</dt><dd>{invoice.sales_agent_name ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted">Truck</dt><dd>{invoice.truck ? <Link href={`/app/dispatch/trucks/${invoice.truck.id}`} className="font-medium text-brand-deep hover:underline">{invoice.truck.unit_number}</Link> : "—"}{invoice.truck ? ` · ${truckTypeLabel[invoice.truck.truck_type]}` : ""}</dd></div>
      </dl>

      <div className="space-y-3">
        {data.rights.dispatcher && invoice.status === "DRAFT" && <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Send size={15} />} pending={pending} pendingLabel="Submitting…" onClick={() => act("SUBMIT", "Invoice submitted to the Dispatch Manager.")}>Submit for review</Button>
          <Button variant="outline" icon={<RotateCcw size={15} />} disabled={pending} onClick={() => act("RECALCULATE", "Invoice recalculated from the week's loads.")}>Recalculate</Button>
          <Button variant="ghost" icon={<XCircle size={15} />} disabled={pending} onClick={() => act("CANCEL", "Invoice cancelled.")} className="text-[#C4254B]">Cancel</Button>
        </div>}
        {data.rights.reviewer && ["SUBMITTED", "FORWARDED"].includes(invoice.status) && <div className="space-y-3 rounded-[14px] border border-brand/40 p-4">
          <p className="text-sm font-semibold">{invoice.status === "SUBMITTED" ? "Review this invoice" : "Forwarded to accounting"}</p>
          <TextAreaField label="Note" hint={invoice.status === "SUBMITTED" ? "Required to return it to the Dispatcher" : "Required to return it"} maxLength={1000} value={note} disabled={pending} onChange={(event) => setNote(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {invoice.status === "SUBMITTED" && <Button variant="success" icon={<Forward size={15} />} pending={pending} pendingLabel="Forwarding…" onClick={() => act("FORWARD", "Invoice forwarded to accounting.")}>Forward to accounting</Button>}
            <Button variant="outline" icon={<RotateCcw size={15} />} disabled={pending || !note.trim()} onClick={() => act("RETURN", "Invoice returned to the Dispatcher.")}>Return to Dispatcher</Button>
            {invoice.status === "SUBMITTED" && <Button variant="ghost" icon={<XCircle size={15} />} disabled={pending} onClick={() => act("CANCEL", "Invoice cancelled.")} className="text-[#C4254B]">Cancel</Button>}
          </div>
        </div>}
        {(data.rights.dispatcher || data.rights.reviewer) && invoice.status === "FORWARDED" && <div className="grid items-end gap-3 rounded-[14px] border border-line-soft p-4 sm:grid-cols-[1fr_auto]">
          <TextField label="Amount received" type="number" min="0" step="0.01" inputMode="decimal" placeholder={String(invoice.amount)} hint="Leave blank for the full amount. A partial amount keeps it pending." error={paidError} value={paid} onChange={(event) => setPaid(event.target.value)} />
          <Button variant="success" icon={<Banknote size={15} />} pending={pending} pendingLabel="Saving…" disabled={Boolean(paidError)} onClick={() => act("PAY", paidAmount !== undefined && paidAmount < Number(invoice.amount) ? "Partial payment recorded. Still pending." : "Invoice marked paid.", paidAmount !== undefined ? { amount_paid: paidAmount } : {})} className="h-11">Record payment</Button>
        </div>}
        {data.rights.sign_off && invoice.status === "PAID" && !invoice.signed_off_at && <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-success/40 bg-success/[.05] p-4">
          <p className="text-sm"><b>Paid.</b> Sign off this sale so it counts in payroll.</p>
          <Button variant="success" icon={<ShieldCheck size={15} />} pending={pending} pendingLabel="Signing off…" onClick={() => act("SIGN_OFF", "Sale signed off.")}>Sign off</Button>
        </div>}
      </div>

      <section><h3 className="mb-2 text-sm font-semibold">Loads in this week</h3>{data.loads.length ? <ul className="divide-y divide-line-soft rounded-[12px] border border-line-soft">{data.loads.map((load) => <li key={load.id} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", load.status === "CANCELLED" && "text-muted line-through")}>
        <span className="w-20 shrink-0 text-xs text-muted">{dateLabel(load.pickup_date)}</span><span className="min-w-0 flex-1 truncate">{[load.pickup_city, load.pickup_zip].filter(Boolean).join(" ") || "—"} → {[load.delivery_city, load.delivery_zip].filter(Boolean).join(" ") || "—"}</span><b className="tabular-nums">{money(load.rate)}</b>
      </li>)}</ul> : <p className="text-sm text-muted">No loads.</p>}</section>

      <section className="space-y-3"><h3 className="text-sm font-semibold">Comments</h3>
        <Composer placeholder="Add a comment" pending={busy("invoice-comment")} onSubmit={async (body) => (await run("invoice-comment", "/api/v1/dispatch/comments", "POST", { entity_type: "DISPATCH_INVOICE", entity_id: invoice.id, body }, "Comment added.")) !== undefined} />
        <CommentFeed rows={data.comments} empty="No comments." busy={busy} />
      </section>

      <section><h3 className="mb-2 text-sm font-semibold">History</h3><ol className="space-y-2 text-sm">{data.history.map((row) => <li key={row.id} className="flex gap-3"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" /><span className="min-w-0 flex-1">{humanize(row.action.replace("DISPATCH_INVOICE_", ""))}{row.detail?.to_status ? ` → ${invoiceStatusLabel[row.detail.to_status] ?? row.detail.to_status}` : ""}<span className="block text-xs text-muted">{row.actor_name ?? "System"} · {dateTimeLabel(row.created_at)}</span></span></li>)}</ol></section>
    </div>}
  </Drawer>;
}

// ---- Do-Not-Call list (Figure 5 note) ----------------------------------------------------------------------------
type DncEntry = { id: string; unit_number: string; truck_type: string; dnc_reason?: string | null; updated_at: string; carrier?: { id: string; company_name: string; mc_number?: string | null; dot_number?: string | null; phone?: string | null } };

export function DncScreen() {
  const { api } = useBrokerage();
  const entries = useQuery({ queryKey: ["brokerage", "dispatch", "dnc"], queryFn: async () => (await responseData<{ entries: DncEntry[] }>(await api("/api/v1/dispatch/dnc"))).entries, staleTime: 30_000 });
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const list = (entries.data ?? []).filter((entry) => !term || [entry.carrier?.company_name, entry.carrier?.mc_number, entry.carrier?.dot_number, entry.unit_number, entry.carrier?.phone].some((value) => value?.toLowerCase().includes(term)));
  return <div className="space-y-6 animate-rise">
    <PageHeader title="Do-not-call list" subtitle="Carriers and trucks marked do-not-call. Kept permanently so nobody re-onboards them." />
    <Card>
      <div className="flex justify-end px-5 pt-4"><div className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, MC, DOT, phone or unit" aria-label="Search the do-not-call list" className={cn(controlClass, "h-10 pl-9")} /></div></div>
      {entries.isLoading ? <div className="space-y-2 p-5">{[0, 1].map((index) => <Skeleton key={index} className="h-12" />)}</div>
        : list.length ? <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">{list.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-danger/10 text-danger"><Ban size={16} /></span>
          <div className="min-w-0 flex-1"><p className="font-semibold">{entry.carrier ? <Link href={`/app/dispatch/carriers/${entry.carrier.id}`} className="hover:text-brand-deep">{entry.carrier.company_name}</Link> : "Unknown carrier"} <span className="font-normal text-muted">· {entry.unit_number} · {truckTypeLabel[entry.truck_type]}</span></p><p className="text-xs text-muted">{[entry.carrier?.mc_number && `MC ${entry.carrier.mc_number}`, entry.carrier?.dot_number && `DOT ${entry.carrier.dot_number}`, entry.carrier?.phone].filter(Boolean).join(" · ")}{entry.dnc_reason ? ` · ${entry.dnc_reason}` : ""}</p></div>
          <span className="text-xs text-muted">{dateLabel(entry.updated_at)}</span>
        </li>)}</ul>
        : <EmptyState icon={Ban} title={term ? "No matches" : "The do-not-call list is empty"} />}
    </Card>
  </div>;
}

// ---- Targets (DS-11, DP-5) -------------------------------------------------------------------------------------
type TargetPerson = { id: string; full_name: string; weekly: number | null; monthly: number | null };

export function TargetsScreen() {
  const { api, sales } = useBrokerage();
  const targets = useQuery({ queryKey: ["brokerage", "dispatch", "targets"], queryFn: async () => responseData<{ can_edit: boolean; people: TargetPerson[] }>(await api("/api/v1/dispatch/targets")), staleTime: 30_000 });
  return <div className="space-y-6 animate-rise">
    <PageHeader title="Targets" subtitle={`Weekly and monthly gross targets for each ${sales ? "agent" : "Dispatcher"}. Progress shows on dashboards and reports.`} />
    <Card>{targets.isLoading ? <div className="space-y-2 p-5">{[0, 1].map((index) => <Skeleton key={index} className="h-12" />)}</div>
      : targets.data?.people.length ? <ul className="divide-y divide-line-soft">{targets.data.people.map((person) => <TargetRow key={person.id} person={person} editable={targets.data!.can_edit} />)}</ul>
      : <EmptyState icon={Goal} title={`No ${sales ? "agents" : "Dispatchers"} yet`} />}
    </Card>
  </div>;
}

function TargetRow({ person, editable }: { person: TargetPerson; editable: boolean }) {
  const { run, busy } = useBrokerageAction();
  const [weekly, setWeekly] = useState(person.weekly == null ? "" : String(person.weekly));
  const [monthly, setMonthly] = useState(person.monthly == null ? "" : String(person.monthly));
  const save = (period_type: "WEEKLY" | "MONTHLY", value: string, original: number | null) => {
    if (value === "" || Number(value) === Number(original) || !Number.isFinite(Number(value)) || Number(value) < 0) return;
    void run(`target:${person.id}:${period_type}`, `/api/v1/dispatch/targets/${person.id}`, "PUT", { period_type, amount: Number(value) }, `${person.full_name}'s ${period_type.toLowerCase()} target saved.`);
  };
  return <li className="grid items-end gap-3 px-5 py-4 sm:grid-cols-[1fr_180px_180px]">
    <p className="self-center font-semibold">{person.full_name}</p>
    <TextField label="Weekly target" type="number" min="0" step="1" disabled={!editable || busy(`target:${person.id}:WEEKLY`)} value={weekly} onChange={(event) => setWeekly(event.target.value)} onBlur={() => save("WEEKLY", weekly, person.weekly)} />
    <TextField label="Monthly target" type="number" min="0" step="1" disabled={!editable || busy(`target:${person.id}:MONTHLY`)} value={monthly} onChange={(event) => setMonthly(event.target.value)} onBlur={() => save("MONTHLY", monthly, person.monthly)} />
  </li>;
}
