"use client";

import Link from "next/link";
import { AlertTriangle, BadgePercent, ChevronRight, Download, Lock, LockOpen, Receipt, UsersRound, Wallet } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { dateLabel, dateTimeLabel } from "@/lib/format";
import { useAdminAction } from "@/components/admin/admin-data";
import { Avatar, Card, Chip, EmptyState, KpiCard, PageHeader, Skeleton } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { MonthPicker } from "@/components/finance/month-picker";
import { downloadExcel } from "@/lib/excel";
import { basisDescription, basisLabel, currentPeriod, periodLabel, roleLabel, usePayroll, type PayrollLine, cash } from "@/components/finance/finance-data";

export function PayrollScreen() {
  const [period, setPeriod] = useState(currentPeriod);
  const payroll = usePayroll(period);
  const { run, busy } = useAdminAction();
  const [department, setDepartment] = useState("all");
  const [open, setOpen] = useState<PayrollLine | null>(null);
  const [confirm, setConfirm] = useState<"finalize" | "reopen" | null>(null);
  const data = payroll.data;
  const finalized = data?.status === "FINALIZED";
  const lines = (data?.lines ?? []).filter((line) => department === "all" || (line.department_id ?? "none") === department);
  const unconfigured = (data?.lines ?? []).filter((line) => !line.configured).length;

  const exportExcel = () => {
    if (!data) return;
    void downloadExcel(`Payroll ${period}${finalized ? "" : " draft"}`, [{
      name: "Payroll", title: `Payroll · ${periodLabel(period)}`, note: finalized ? "Finalized." : "Draft: live figures until the month is finalized.",
      columns: [{ header: "Name", key: "full_name" }, { header: "Role", key: "role" }, { header: "Department", key: "department_name" }, { header: "Base salary", key: "base_salary", type: "money" }, { header: "Commission basis", key: "basis" }, { header: "Basis amount", key: "basis_amount", type: "money" }, { header: "Commission %", key: "commission_rate", type: "percent" }, { header: "Commission", key: "commission_amount", type: "money" }, { header: "Total", key: "total", type: "money" }],
      rows: data.lines.map((line) => ({ ...line, role: roleLabel[line.role_key], basis: basisLabel[line.commission_basis] })),
      totals: { base_salary: data.totals.base, commission_amount: data.totals.commission, total: data.totals.total },
    }]);
  };

  const confirmAction = async () => {
    const ok = confirm === "finalize"
      ? await run("finalize", `/api/v1/admin/payroll/${period}/finalize`, "POST", {}, `${periodLabel(period)} payroll finalized.`, "Unable to finalize payroll.")
      : await run("reopen", `/api/v1/admin/payroll/${period}/reopen`, "POST", {}, `${periodLabel(period)} payroll reopened.`, "Unable to reopen payroll.");
    if (ok) setConfirm(null);
  };

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Payroll" subtitle="Base salary plus commission from approved and paid work" actions={<>
      <MonthPicker value={period} onChange={(next) => { setPeriod(next); setDepartment("all"); }} />
      <Button variant="outline" icon={<Download size={15} />} onClick={exportExcel} disabled={!data?.lines.length}>Export</Button>
      {data && (finalized
        ? <Button variant="outline" icon={<LockOpen size={15} />} onClick={() => setConfirm("reopen")}>Reopen</Button>
        : <Button variant="primary" icon={<Lock size={15} />} onClick={() => setConfirm("finalize")} disabled={!data.lines.length}>Finalize month</Button>)}
    </>} />

    {payroll.isLoading ? <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-card" />)}</div><Skeleton className="h-80 rounded-card" /></>
      : payroll.isError || !data ? <Card><EmptyState icon={Wallet} title="Payroll unavailable" body={payroll.error?.message} /></Card>
      : <>
        <div className={cn("flex flex-wrap items-center gap-3 rounded-card border px-5 py-3.5 text-sm", finalized ? "border-success/30 bg-success/[.06]" : "border-line bg-white")}>
          {finalized ? <><Lock size={16} className="text-success" /><span><b>Finalized</b> {data.finalized_at ? dateTimeLabel(data.finalized_at) : ""}{data.finalized_by_name ? ` by ${data.finalized_by_name}` : ""}. Figures are frozen.</span></>
            : <><Chip tone="brand">Draft</Chip><span className="text-muted">Live figures. They update as work is approved and paid until you finalize the month.</span></>}
        </div>
        {unconfigured > 0 && <Link href="/app/admin/compensation" className="flex items-center gap-3 rounded-card border border-brand/40 bg-brand-tint px-5 py-3.5 text-sm hover:border-brand"><AlertTriangle size={16} className="shrink-0 text-brand-deep" /><span className="flex-1"><b>{unconfigured} {unconfigured === 1 ? "person has" : "people have"} no compensation set</b> and show $0.</span><span className="font-semibold text-brand-deep">Set up compensation</span><ChevronRight size={15} /></Link>}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard label="People" value={data.totals.people} icon={UsersRound} tone="accent" />
          <KpiCard label="Base salaries" value={cash(data.totals.base)} icon={Wallet} tone="info" />
          <KpiCard label="Commission" value={cash(data.totals.commission)} icon={BadgePercent} tone="aqua" />
          <KpiCard label="Total payroll" value={cash(data.totals.total)} icon={Receipt} tone="brand" />
        </div>

        <Card>
          <div className="px-5 pt-3"><Tabs value={department} onChange={setDepartment} className="border-b-0" items={[
            { value: "all", label: "All departments", count: data.lines.length },
            ...data.departments.map((row) => ({ value: row.department_id ?? "none", label: row.name, count: row.people })),
          ]} /></div>
          <div className="border-t border-line">
            {lines.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Person</th><th className="px-3 py-2.5 font-medium">Commission basis</th><th className="px-3 py-2.5 text-right font-medium">Rate</th><th className="px-3 py-2.5 text-right font-medium">Commission</th><th className="px-3 py-2.5 text-right font-medium">Base</th><th className="px-3 py-2.5 text-right font-medium">Total</th><th className="w-10" /></tr></thead>
              <tbody>{lines.map((line) => <tr key={line.user_id} onClick={() => setOpen(line)} className="group cursor-pointer border-t border-line-soft hover:bg-[#FAF8F4]">
                <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={line.full_name} /><div className="min-w-0"><p className="truncate font-semibold">{line.full_name}</p><p className="truncate text-xs text-muted">{roleLabel[line.role_key]}{!line.configured && <span className="ml-1.5 font-medium text-brand-deep">· not set</span>}</p></div></div></td>
                <td className="px-3 py-3"><p className="font-medium tabular-nums">{cash(line.basis_amount)}</p><p className="text-xs text-muted">{basisLabel[line.commission_basis]} · {line.items.length} record{line.items.length === 1 ? "" : "s"}</p></td>
                <td className="px-3 py-3 text-right tabular-nums">{line.commission_rate}%</td>
                <td className="px-3 py-3 text-right tabular-nums">{cash(line.commission_amount)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{cash(line.base_salary)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums">{cash(line.total)}</td>
                <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
              </tr>)}</tbody>
            </table></div> : <EmptyState icon={UsersRound} title="No one on payroll" body="Brokerage agents and managers appear here." />}
          </div>
        </Card>
      </>}

    {open && <LineDrawer line={open} period={period} onClose={() => setOpen(null)} />}

    <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} dismissible={!busy()} title={confirm === "finalize" ? `Finalize ${periodLabel(period)}?` : `Reopen ${periodLabel(period)}?`}
      footer={<><Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy()}>Cancel</Button><Button variant={confirm === "finalize" ? "primary" : "danger"} icon={confirm === "finalize" ? <Lock size={15} /> : <LockOpen size={15} />} pending={busy("finalize") || busy("reopen")} pendingLabel={confirm === "finalize" ? "Finalizing…" : "Reopening…"} onClick={() => void confirmAction()}>{confirm === "finalize" ? "Finalize" : "Reopen"}</Button></>}>
      <p className="text-sm text-muted">{confirm === "finalize"
        ? <>This freezes the figures for <b className="text-ink">{data?.totals.people} people · {cash(data?.totals.total)}</b>. Everyone can then see their final earnings for the month.</>
        : <>The frozen figures are discarded and the month goes back to live draft numbers.</>}</p>
    </Modal>
  </div>;
}

function LineDrawer({ line, period, onClose }: { line: PayrollLine; period: string; onClose: () => void }) {
  return <Drawer open onClose={onClose} title={line.full_name} subtitle={`${roleLabel[line.role_key]} · ${line.department_name ?? "—"} · ${periodLabel(period)}`}>
    <dl className="grid grid-cols-2 gap-3">
      <Figure label="Base salary" value={cash(line.base_salary)} />
      <Figure label={`Commission (${line.commission_rate}%)`} value={cash(line.commission_amount)} />
      <Figure label={basisLabel[line.commission_basis]} value={cash(line.basis_amount)} />
      <Figure label="Total" value={cash(line.total)} strong />
    </dl>
    <p className="mt-3 text-xs text-muted">{basisDescription(line.commission_basis, line.role_key)}</p>
    <h3 className="mb-2 mt-6 text-sm font-semibold">Counted records · {line.items.length}</h3>
    {line.items.length ? <ul className="divide-y divide-line-soft rounded-control border border-line">{line.items.map((item, index) => <li key={`${item.reference}-${index}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.reference}</p><p className="truncate text-xs text-muted">{item.customer ?? "—"}{item.date ? ` · ${dateLabel(item.date)}` : ""}</p></div>
      <span className="font-semibold tabular-nums">{cash(item.amount)}</span>
    </li>)}</ul> : <p className="rounded-control bg-canvas px-4 py-6 text-center text-sm text-muted">Nothing approved or paid in this month yet.</p>}
  </Drawer>;
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={cn("rounded-control border px-4 py-3", strong ? "border-brand/40 bg-brand-tint/60" : "border-line")}><dt className="text-xs text-muted">{label}</dt><dd className={cn("mt-0.5 tabular-nums", strong ? "text-xl font-bold" : "font-semibold")}>{value}</dd></div>;
}
