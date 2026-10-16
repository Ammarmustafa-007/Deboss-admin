"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, ChevronRight, ReceiptText, Search, Wallet } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { dateLabel, isPast, money } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip, humanize } from "@/components/ui/surface";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { SelectField, TextField, controlClass } from "@/components/ui/field";
import { paymentStatuses } from "@/components/operations/model";

type Invoice = {
  id: string;
  invoice_number: string;
  amount?: number | string | null;
  amount_paid?: number | string | null;
  due_date?: string | null;
  status: string;
  shipment_id?: string | null;
  brokerage_shipments?: { reference_number?: string; customer_name?: string } | null;
};

const open = (invoice: Invoice) => ["DRAFT", "SENT", "PENDING"].includes(invoice.status);
const outstanding = (invoice: Invoice) => Math.max(0, Number(invoice.amount ?? 0) - Number(invoice.amount_paid ?? 0));

export function InvoicesScreen() {
  const { api } = useBrokerage();
  const invoices = useQuery({ queryKey: ["brokerage", "invoices"], queryFn: async () => responseData<{ invoices: Invoice[] }>(await api("/api/v1/brokerage/invoices")), staleTime: 20_000 });
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const editing = list.find((invoice) => invoice.id === editingId);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const overdue = list.filter((invoice) => invoice.status === "OVERDUE" || (open(invoice) && isPast(invoice.due_date)));

  const tabs: TabItem<string>[] = [{ value: "all", label: "All", count: list.length }, ...paymentStatuses.map((status) => ({ value: status, label: humanize(status), count: list.filter((invoice) => invoice.status === status).length, hidden: !list.some((invoice) => invoice.status === status) }))];
  const term = search.trim().toLowerCase();
  const visible = list.filter((invoice) => (filter === "all" || invoice.status === filter) && (!term || `${invoice.invoice_number} ${invoice.brokerage_shipments?.reference_number ?? ""} ${invoice.brokerage_shipments?.customer_name ?? ""}`.toLowerCase().includes(term)));

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Invoices" subtitle="Billing for delivered shipments" />

    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Invoiced" value={money(sum(list.map((invoice) => Number(invoice.amount ?? 0))))} icon={ReceiptText} tone="brand" />
      <KpiCard label="Collected" value={money(sum(list.map((invoice) => Number(invoice.amount_paid ?? 0))))} icon={Wallet} tone="success" />
      <KpiCard label="Outstanding" value={money(sum(list.filter((invoice) => invoice.status !== "CANCELLED").map(outstanding)))} icon={Banknote} tone="accent" />
      <KpiCard label="Overdue" value={overdue.length} icon={AlertTriangle} tone={overdue.length ? "danger" : "info"} />
    </div>

    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={filter} onChange={setFilter} className="-mb-px border-b-0 lg:flex-1" />
        <label className="relative mb-3 block lg:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoices" aria-label="Search invoices" className={cn(controlClass, "h-10 pl-9")} />
        </label>
      </div>
      <div className="border-t border-line">
        {invoices.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
          : invoices.isError ? <EmptyState title="Invoices unavailable" body={errorMessage(invoices.error, "Unable to load invoices.")} />
          : visible.length ? <>
            <table className="hidden w-full text-sm md:table">
              <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Invoice</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Due</th><th className="px-3 py-2.5 text-right font-medium">Amount</th><th className="px-3 py-2.5 text-right font-medium">Paid</th><th className="w-10" /></tr></thead>
              <tbody>{visible.map((invoice) => {
                const late = open(invoice) && isPast(invoice.due_date);
                return <tr key={invoice.id} onClick={() => setEditingId(invoice.id)} className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-[#FAF8F4]">
                  <td className="px-5 py-3.5"><p className="font-semibold">{invoice.invoice_number}</p><p className="mt-0.5 text-xs text-muted">{invoice.brokerage_shipments?.reference_number ?? "—"} · {invoice.brokerage_shipments?.customer_name ?? "—"}</p></td>
                  <td className="px-3 py-3.5"><StatusChip status={late ? "OVERDUE" : invoice.status} label={late ? "Past due" : undefined} /></td>
                  <td className={cn("px-3 py-3.5 text-[13px]", late && "font-medium text-[#C4254B]")}>{dateLabel(invoice.due_date)}</td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{money(invoice.amount)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-ink/75">{money(invoice.amount_paid)}</td>
                  <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
                </tr>;
              })}</tbody>
            </table>
            <ul className="divide-y divide-line-soft md:hidden">{visible.map((invoice) => <li key={invoice.id}><button type="button" onClick={() => setEditingId(invoice.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{invoice.invoice_number} <span className="font-normal text-muted">· {money(invoice.amount)}</span></p><p className="truncate text-xs text-muted">{invoice.brokerage_shipments?.customer_name ?? "—"} · Due {dateLabel(invoice.due_date)}</p><div className="mt-2"><StatusChip status={invoice.status} /></div></div>
              <ChevronRight size={16} className="text-muted" />
            </button></li>)}</ul>
          </> : <EmptyState icon={term ? Search : ReceiptText} title={term ? "No invoices match your search" : list.length ? "Nothing in this view" : "No invoices yet"} body={!list.length ? "Delivered shipments with generated invoices appear here." : undefined} />}
      </div>
    </Card>

    {editing && <InvoiceDrawer key={editing.id} invoice={editing} onClose={() => setEditingId(null)} />}
  </div>;
}

function InvoiceDrawer({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { run, busy } = useBrokerageAction();
  const initial = { amount: invoice.amount == null ? "" : String(invoice.amount), amount_paid: invoice.amount_paid == null ? "" : String(invoice.amount_paid), due_date: invoice.due_date ?? "", status: invoice.status ?? "DRAFT" };
  const [form, setForm] = useState(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => form[key] !== initial[key]);
  const pending = busy(`invoice:${invoice.id}`);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run(`invoice:${invoice.id}`, `/api/v1/brokerage/invoices/${invoice.id}`, "PATCH", {
      amount: form.amount === "" ? 0 : Number(form.amount),
      amount_paid: form.amount_paid === "" ? 0 : Number(form.amount_paid),
      due_date: form.due_date || null,
      status: form.status,
    }, "Invoice updated.");
    if (saved !== undefined) onClose();
  };

  return <Drawer open onClose={onClose} dismissible={!pending} title={invoice.invoice_number} subtitle={`${invoice.brokerage_shipments?.reference_number ?? "—"} · ${invoice.brokerage_shipments?.customer_name ?? "—"}`}
    footer={<><Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button><Button variant="ink" type="submit" form="invoice-form" pending={pending} pendingLabel="Saving…" disabled={!dirty}>Save invoice</Button></>}>
    <form id="invoice-form" onSubmit={save}>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <TextField label="Amount" type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} hint={money(form.amount)} />
        <TextField label="Paid" type="number" min="0" value={form.amount_paid} onChange={(event) => setForm({ ...form, amount_paid: event.target.value })} hint={form.amount ? `Outstanding ${money(Math.max(0, Number(form.amount || 0) - Number(form.amount_paid || 0)))}` : undefined} />
        <TextField label="Due date" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
        <SelectField label="Status" required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={paymentStatuses.map((status) => ({ value: status, label: humanize(status) }))} />
      </fieldset>
    </form>
    {invoice.shipment_id && <Link href={`/app/operations/${invoice.shipment_id}`} className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:underline">Open shipment<ChevronRight size={15} /></Link>}
  </Drawer>;
}
