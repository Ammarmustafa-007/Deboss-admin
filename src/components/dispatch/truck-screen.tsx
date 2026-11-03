"use client";

import Link from "next/link";
import { Ban, CheckCircle2, Hourglass, PauseCircle, Pencil, PlayCircle, Plus, ReceiptText, ShieldAlert, Trash2 } from "lucide-react";
import { use, useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, money } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, CardHeader, Chip, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { Stepper, Tabs } from "@/components/ui/navigation";
import { CommentFeed, Composer } from "@/components/sales/feed";
import {
  addDays, invoiceStatusLabel, loadStatusLabel, paymentLabel, pct, truckPosition, truckStatusLabel, truckSteps, truckTypeLabel, useDispatchDirectory, useTruck, weekLabel, weekStart,
  type Load, type TruckDetail,
} from "@/components/dispatch/model";

type TabKey = "loads" | "invoices" | "comments";

export function TruckScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useTruck(id);
  if (detail.isLoading) return <div className="space-y-4"><Skeleton className="h-16 w-80" /><Skeleton className="h-32" /><Skeleton className="h-80" /></div>;
  if (detail.isError || !detail.data) return <EmptyState icon={ShieldAlert} title="Truck unavailable" body={errorMessage(detail.error)} className="mt-10" />;
  return <TruckView key={id} data={detail.data} />;
}

function TruckView({ data }: { data: TruckDetail }) {
  const { truck, carrier, loads, rights } = data;
  const [tab, setTab] = useState<TabKey>("loads");
  const { run, busy } = useBrokerageAction();
  const [dnc, setDnc] = useState(false);
  const thisWeek = weekStart();
  const live = loads.filter((load) => load.status !== "CANCELLED");
  // Gross is what the company was paid: paid invoices, by the day they were paid (client feedback).
  const paid = data.invoices.filter((invoice) => invoice.status === "PAID" && invoice.paid_at);
  const paidSince = (day: string) => paid.filter((invoice) => String(invoice.paid_at).slice(0, 10) >= day).reduce((sum, invoice) => sum + Number(invoice.amount_paid), 0);
  const weekGross = paidSince(thisWeek);
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const monthGross = paidSince(monthStart);
  const weeklyTarget = Number(data.targets.find((target) => target.period_type === "WEEKLY")?.amount ?? 0);
  const status = (next: string, success: string, extra: Record<string, unknown> = {}) => void run("status", `/api/v1/dispatch/trucks/${truck.id}`, "PATCH", { status: next, ...extra }, success);
  const closed = ["DNC", "DISCARDED"].includes(truck.status);

  return <div className="space-y-6 animate-rise">
    <PageHeader crumbs={[{ label: rights.sales_side ? "Carriers" : "Trucks", href: rights.sales_side ? `/app/dispatch/carriers/${carrier.id}` : "/app/dispatch/trucks" }, { label: `${truck.unit_number}` }]}
      title={<span className="flex flex-wrap items-center gap-3">{truck.unit_number}<StatusChip status={truck.status} label={truckStatusLabel[truck.status]} className="text-[13px]" /></span>}
      subtitle={<span><Link href={`/app/dispatch/carriers/${carrier.id}`} className="font-medium hover:text-ink">{carrier.company_name}</Link> · {truckTypeLabel[truck.truck_type]} · Dispatcher: {truck.assigned_name ?? "not assigned"}</span>}
      actions={rights.update && !closed && <div className="flex flex-wrap gap-2">
        {["ONBOARDED", "INACTIVE"].includes(truck.status) && truck.assigned_to && <Button variant="primary" icon={<PlayCircle size={15} />} pending={busy("status")} onClick={() => status("RUNNING", "Truck is running.")}>Mark running</Button>}
        {["ONBOARDED", "RUNNING"].includes(truck.status) && <Button variant="outline" icon={<PauseCircle size={15} />} disabled={busy("status")} onClick={() => status("INACTIVE", "Truck marked inactive.")}>Mark inactive</Button>}
        {["ONBOARDED", "RUNNING", "INACTIVE"].includes(truck.status) && <Button variant="danger" icon={<Ban size={15} />} disabled={busy("status")} onClick={() => setDnc(true)}>Do not call</Button>}
      </div>} />

    <Card className="px-4 py-5 sm:px-6">
      {closed ? <p className="flex items-center gap-3 text-sm"><Ban size={18} className="text-danger" /><span><b>{truckStatusLabel[truck.status]}.</b> {truck.dnc_reason ?? "This truck is closed."}</span></p>
        : <div className="overflow-x-auto"><Stepper steps={truckSteps.map((label) => ({ label }))} current={truckPosition(truck.status)} tone={truck.status === "INACTIVE" ? "danger" : "brand"} className="min-w-[420px]" /></div>}
    </Card>

    {rights.assign && !closed && <AssignCard data={data} />}

    {rights.money_hidden ? <ActiveSaleCard since={truck.sale_active_since} /> : <><div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Gross this week (paid)" value={money(weekGross)} hint={weeklyTarget ? `Target ${money(weeklyTarget)} · ${Math.round((weekGross / weeklyTarget) * 100)}%` : weekLabel(thisWeek)} tone="brand" />
      <KpiCard label="Gross this month (paid)" value={money(monthGross)} tone="aqua" />
      <KpiCard label="Charge %" value={pct(carrier.charge_percent)} hint={carrier.payment_method ? paymentLabel[carrier.payment_method] : "Payment method not set"} tone="accent" />
      <KpiCard label="Loads logged" value={live.length} tone="success" />
    </div></>}

    <Tabs<TabKey> value={rights.money_hidden ? "comments" : tab} onChange={setTab} items={[{ value: "loads", label: "Loads", count: loads.length, hidden: rights.money_hidden }, { value: "invoices", label: "Invoices", count: data.invoices.length, hidden: rights.money_hidden }, { value: "comments", label: "Comments", count: data.comments.length }]} />
    <div key={tab} className="animate-fade">
      {tab === "loads" && !rights.money_hidden && <LoadsTab data={data} />}
      {tab === "invoices" && !rights.money_hidden && <InvoicesTab data={data} />}
      {(tab === "comments" || rights.money_hidden) && <Card className="max-w-3xl"><CardHeader title="Comments" /><div className="space-y-6 p-5">
        <Composer placeholder="Add a comment on this truck" pending={busy("comment")} onSubmit={async (body) => (await run("comment", "/api/v1/dispatch/comments", "POST", { entity_type: "TRUCK", entity_id: truck.id, body }, "Comment added.")) !== undefined} />
        <CommentFeed rows={data.comments} empty="No comments yet." busy={busy} onDelete={(row) => void run(`delete-comment:${row.id}`, `/api/v1/brokerage/comments/${row.id}`, "DELETE", undefined, "Comment deleted.")} />
      </div></Card>}
    </div>
    <DncModal open={dnc} onClose={() => setDnc(false)} onConfirm={(reason) => { setDnc(false); status("DNC", "Truck moved to the Do-Not-Call list.", { dnc_reason: reason }); }} />
  </div>;
}

/** What a Dispatch Sales Agent sees instead of gross: whether the truck has become an active sale. */
function ActiveSaleCard({ since }: { since?: string | null }) {
  return <Card className="flex items-center gap-4 px-5 py-4">
    {since ? <CheckCircle2 size={22} className="text-success" /> : <Hourglass size={22} className="text-accent" />}
    <div><p className="font-semibold">{since ? "Active sale" : "Not active yet"}</p><p className="text-sm text-muted">{since ? `The truck paid its first invoice on ${dateLabel(since)}.` : "It becomes an active sale when it pays its first invoice."}</p></div>
  </Card>;
}

function DncModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <Modal open={open} onClose={onClose} title="Mark as do-not-call" subtitle="The truck moves to the Do-Not-Call list. It is kept, never deleted."
    footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Mark do-not-call</Button></>}>
    <TextAreaField label="Reason" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
  </Modal>;
}

function AssignCard({ data }: { data: TruckDetail }) {
  const { truck } = data;
  const directory = useDispatchDirectory();
  const { run, busy } = useBrokerageAction();
  const pending = busy("assign");
  return <Card><div className="grid gap-4 p-5 sm:grid-cols-2">
    <SelectField label="Dispatcher" value={truck.assigned_to ?? ""} placeholder="Needs a dispatcher" disabled={pending || !directory.data} onChange={(event) => void run("assign", `/api/v1/dispatch/trucks/${truck.id}`, "PATCH", { assigned_to: event.target.value || null }, "Truck assignment updated.")} options={[...(directory.data?.users ?? []).map((user) => ({ value: user.id, label: user.full_name })), ...(directory.data?.managers ?? []).map((user) => ({ value: user.id, label: `${user.full_name} (Manager)` }))]} />
    <SelectField label="Team" value={truck.team_id ?? ""} placeholder="No team" disabled={pending || !directory.data} onChange={(event) => void run("assign", `/api/v1/dispatch/trucks/${truck.id}`, "PATCH", { team_id: event.target.value || null }, "Truck team updated.")} options={(directory.data?.teams ?? []).map((team) => ({ value: team.id, label: team.name }))} />
  </div></Card>;
}

const blankLoad = { load_number: "", broker_name: "", pickup_city: "", pickup_zip: "", pickup_date: "", delivery_city: "", delivery_zip: "", delivery_date: "", rate: "", miles: "", status: "BOOKED", notes: "" };

/** DP-4, DP-5, answer 3: every load is logged; weekly gross is their total. */
function LoadsTab({ data }: { data: TruckDetail }) {
  const { truck, loads, rights } = data;
  const [editing, setEditing] = useState<Load | "new" | null>(null);
  const { run, busy } = useBrokerageAction();
  const canLog = rights.update && ["ONBOARDED", "RUNNING", "INACTIVE"].includes(truck.status) && Boolean(truck.assigned_to);
  const weeks = useMemo(() => {
    const groups = new Map<string, Load[]>();
    loads.forEach((load) => groups.set(load.week_start ?? weekStart(load.pickup_date), [...(groups.get(load.week_start ?? weekStart(load.pickup_date)) ?? []), load]));
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [loads]);
  // A load on a submitted invoice is locked for the Dispatcher; managers can still change it.
  const invoiceOf = new Map(data.invoices.map((invoice) => [invoice.id, invoice]));
  const locked = (load: Load) => { const invoice = load.invoice_id ? invoiceOf.get(load.invoice_id) : undefined; return Boolean(invoice && invoice.status !== "DRAFT" && !rights.assign); };
  return <div className="space-y-4">
    {canLog && <div className="flex justify-end"><Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing("new")}>Log a load</Button></div>}
    {weeks.length ? weeks.map(([week, rows]) => { const gross = rows.filter((load) => load.status !== "CANCELLED").reduce((sum, load) => sum + Number(load.rate), 0); return <Card key={week}>
      <CardHeader title={`Week ${weekLabel(week)}`} subtitle={`${rows.filter((load) => load.status !== "CANCELLED").length} loads · loads total ${money(gross)}`} />
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2 font-medium">Load</th><th className="px-3 py-2 font-medium">Pickup</th><th className="px-3 py-2 font-medium">Delivery</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Miles</th><th className="px-3 py-2 text-right font-medium">Rate</th><th className="w-20" /></tr></thead>
        <tbody>{rows.map((load) => <tr key={load.id} className={cn("border-t border-line-soft", load.status === "CANCELLED" && "text-muted line-through decoration-ink/30")}>
          <td className="px-5 py-2.5"><p className="font-medium">{load.load_number || "—"}{load.invoice_id && <Link href={`/app/dispatch/invoices?open=${load.invoice_id}`} className="ml-2 no-underline"><Chip tone="info">{invoiceOf.get(load.invoice_id)?.invoice_number ? "Invoiced" : "On an invoice"}</Chip></Link>}</p><p className="text-xs text-muted no-underline">{load.broker_name || "No broker"}</p></td>
          <td className="px-3 py-2.5 text-[13px]">{[load.pickup_city, load.pickup_zip].filter(Boolean).join(" ") || "—"}<p className="text-xs text-muted">{dateLabel(load.pickup_date)}</p></td>
          <td className="px-3 py-2.5 text-[13px]">{[load.delivery_city, load.delivery_zip].filter(Boolean).join(" ") || "—"}<p className="text-xs text-muted">{dateLabel(load.delivery_date)}</p></td>
          <td className="px-3 py-2.5"><StatusChip status={load.status === "BOOKED" ? "PENDING" : load.status} label={loadStatusLabel[load.status]} /></td>
          <td className="px-3 py-2.5 text-right tabular-nums">{load.miles ?? "—"}</td>
          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(load.rate)}</td>
          <td className="px-3 py-2.5 text-right">{rights.update && !locked(load) && <span className="inline-flex gap-1">
            <Button size="sm" variant="ghost" aria-label="Edit load" onClick={() => setEditing(load)}><Pencil size={13} /></Button>
            <Button size="sm" variant="ghost" aria-label="Delete load" disabled={busy(`delete-load:${load.id}`)} onClick={() => void run(`delete-load:${load.id}`, `/api/v1/dispatch/loads/${load.id}`, "DELETE", undefined, "Load deleted.")} className="text-[#C4254B]"><Trash2 size={13} /></Button>
          </span>}</td>
        </tr>)}</tbody>
      </table></div>
    </Card>; }) : <Card><EmptyState icon={ReceiptText} title="No loads yet" body={canLog ? "Log each load as it's booked, then bill the loads you choose on an invoice." : "Loads appear once the Dispatcher logs them."} /></Card>}
    {editing && <LoadModal truckId={truck.id} load={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
  </div>;
}

function LoadModal({ truckId, load, onClose }: { truckId: string; load?: Load; onClose: () => void }) {
  const { run, busy } = useBrokerageAction();
  const [form, setForm] = useState(load ? { load_number: load.load_number ?? "", broker_name: load.broker_name ?? "", pickup_city: load.pickup_city ?? "", pickup_zip: load.pickup_zip ?? "", pickup_date: load.pickup_date, delivery_city: load.delivery_city ?? "", delivery_zip: load.delivery_zip ?? "", delivery_date: load.delivery_date ?? "", rate: String(load.rate), miles: load.miles == null ? "" : String(load.miles), status: load.status, notes: load.notes ?? "" } : { ...blankLoad, pickup_date: new Date().toISOString().slice(0, 10) });
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const rate = Number(form.rate);
  const rateError = form.rate === "" ? undefined : !Number.isFinite(rate) ? "Enter a number." : rate < 0 ? "Cannot be negative." : undefined;
  const dateError = form.delivery_date && form.pickup_date && form.delivery_date < form.pickup_date ? "Delivery can't be before pickup." : undefined;
  const saving = busy("save-load");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (rateError || dateError || form.rate === "") return;
    const body = { ...form, rate, miles: form.miles === "" ? null : Math.round(Number(form.miles)), delivery_date: form.delivery_date || null };
    const saved = await run("save-load", load ? `/api/v1/dispatch/loads/${load.id}` : `/api/v1/dispatch/trucks/${truckId}/loads`, load ? "PATCH" : "POST", body, load ? "Load updated." : "Load logged.");
    if (saved !== undefined) onClose();
  };
  return <Modal open onClose={onClose} dismissible={!saving} title={load ? "Edit load" : "Log a load"} className="max-w-2xl"
    footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="load-form" variant="primary" pending={saving} pendingLabel="Saving…" disabled={form.rate === "" || Boolean(rateError || dateError)}>{load ? "Save load" : "Log load"}</Button></>}>
    <form id="load-form" onSubmit={save}><fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Load #" maxLength={60} value={form.load_number} onChange={(event) => set("load_number")(event.target.value)} />
      <TextField label="Broker / customer" maxLength={160} value={form.broker_name} onChange={(event) => set("broker_name")(event.target.value)} />
      <TextField label="Pickup city" maxLength={120} value={form.pickup_city} onChange={(event) => set("pickup_city")(event.target.value)} />
      <div className="grid grid-cols-2 gap-3"><TextField label="Pickup zip" maxLength={10} value={form.pickup_zip} onChange={(event) => set("pickup_zip")(event.target.value)} /><TextField label="Pickup date" type="date" required value={form.pickup_date} onChange={(event) => set("pickup_date")(event.target.value)} /></div>
      <TextField label="Delivery city" maxLength={120} value={form.delivery_city} onChange={(event) => set("delivery_city")(event.target.value)} />
      <div className="grid grid-cols-2 gap-3"><TextField label="Delivery zip" maxLength={10} value={form.delivery_zip} onChange={(event) => set("delivery_zip")(event.target.value)} /><TextField label="Delivery date" type="date" error={dateError} value={form.delivery_date} onChange={(event) => set("delivery_date")(event.target.value)} /></div>
      <TextField label="Rate" type="number" required min="0" step="0.01" inputMode="decimal" error={rateError} value={form.rate} onChange={(event) => set("rate")(event.target.value)} />
      <div className="grid grid-cols-2 gap-3"><TextField label="Miles" type="number" min="0" step="1" value={form.miles} onChange={(event) => set("miles")(event.target.value)} /><SelectField label="Status" required value={form.status} onChange={(event) => set("status")(event.target.value)} options={Object.entries(loadStatusLabel).map(([value, label]) => ({ value, label }))} /></div>
      <TextAreaField label="Notes" maxLength={1000} value={form.notes} onChange={(event) => set("notes")(event.target.value)} wrapperClassName="sm:col-span-2" />
    </fieldset></form>
  </Modal>;
}

/** The Dispatcher picks which loads go on an invoice, from any week. A truck can have several invoices. */
function InvoicesTab({ data }: { data: TruckDetail }) {
  const { truck, carrier, invoices, loads, rights } = data;
  const { run, busy } = useBrokerageAction();
  const free = loads.filter((load) => !load.invoice_id && load.status !== "CANCELLED").sort((left, right) => left.pickup_date.localeCompare(right.pickup_date));
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = free.filter((load) => picked.includes(load.id));
  const gross = chosen.reduce((sum, load) => sum + Number(load.rate), 0);
  const fee = carrier.charge_percent == null ? null : gross * Number(carrier.charge_percent) / 100;
  const toggle = (id: string) => setPicked((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const create = () => void run("create-invoice", `/api/v1/dispatch/trucks/${truck.id}/invoices`, "POST", { load_ids: chosen.map((load) => load.id) }, "Invoice created as a draft.").then((result) => { if (result !== undefined) setPicked([]); });
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Card>
      <CardHeader title="Invoices" subtitle="Invoice = its loads' total × the carrier's charge %" />
      {invoices.length ? <ul className="divide-y divide-line-soft">{invoices.map((invoice) => <li key={invoice.id}><Link href={`/app/dispatch/invoices?open=${invoice.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-[#FAF8F4]">
        <div className="min-w-0 flex-1"><p className="font-semibold">{invoice.invoice_number}</p><p className="text-xs text-muted">{weekLabel(invoice.week_start)} · loads {money(invoice.gross_amount)} × {pct(invoice.charge_percent)}</p></div>
        <b className="tabular-nums">{money(invoice.amount)}</b><StatusChip status={invoice.status} label={invoiceStatusLabel[invoice.status]} />
      </Link></li>)}</ul> : <p className="p-6 text-center text-sm text-muted">No invoices yet.</p>}
    </Card>
    {rights.update && <Card className="h-fit"><CardHeader title="Create an invoice" subtitle="Choose the loads to bill" /><div className="space-y-4 p-5">
      {carrier.charge_percent == null ? <p className="rounded-[12px] bg-[#FFF6E8] px-4 py-3 text-sm text-[#7C4400]">Set the carrier&apos;s charge % on the <Link href={`/app/dispatch/carriers/${carrier.id}`} className="font-semibold underline">carrier</Link> first.</p>
        : free.length ? <>
          <div className="flex items-center justify-between text-xs"><span className="text-muted">{free.length} load{free.length === 1 ? "" : "s"} not invoiced yet</span><button type="button" className="font-semibold text-brand-deep hover:underline" onClick={() => setPicked(picked.length === free.length ? [] : free.map((load) => load.id))}>{picked.length === free.length ? "Clear" : "Select all"}</button></div>
          <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto rounded-[12px] border border-line-soft">{free.map((load) => <li key={load.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-[#FAF8F4]">
            <input type="checkbox" checked={picked.includes(load.id)} onChange={() => toggle(load.id)} className="h-4 w-4 accent-[var(--color-brand)]" />
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{load.load_number || [load.pickup_city, load.delivery_city].filter(Boolean).join(" → ") || "Load"}</span><span className="block text-xs text-muted">{dateLabel(load.pickup_date)} · {weekLabel(load.week_start ?? weekStart(load.pickup_date))}</span></span>
            <b className="tabular-nums">{money(load.rate)}</b>
          </label></li>)}</ul>
          <dl className="grid grid-cols-2 gap-y-2 rounded-[12px] bg-[#FBFAF7] p-4 text-sm"><dt className="text-muted">Loads</dt><dd className="text-right">{chosen.length}</dd><dt className="text-muted">Loads total</dt><dd className="text-right font-semibold tabular-nums">{money(gross)}</dd><dt className="text-muted">Charge</dt><dd className="text-right">{pct(carrier.charge_percent)}</dd><dt className="text-muted">Invoice</dt><dd className="text-right text-base font-bold tabular-nums">{money(fee)}</dd>{chosen[0] && <><dt className="text-muted">Due</dt><dd className="text-right">{dateLabel(addDays(weekStart(chosen[0].pickup_date), 13))}</dd></>}</dl>
          <Button variant="primary" className="w-full" icon={<ReceiptText size={15} />} disabled={!chosen.length} pending={busy("create-invoice")} pendingLabel="Creating…" onClick={create}>Create invoice</Button>
        </> : <p className="text-sm text-muted">Every load is already on an invoice.</p>}
    </div></Card>}
  </div>;
}
