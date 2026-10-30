"use client";

import { Landmark, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { useAdminAction } from "@/components/admin/admin-data";
import { Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { SelectField, TextField } from "@/components/ui/field";
import { MonthPicker } from "@/components/finance/month-picker";
import { cash, costTypeLabel, currentPeriod, periodLabel, pkr, useCosts, type Cost, type CostsData, type CostType } from "@/components/finance/finance-data";

const costHelp: Record<CostType, string> = {
  COMPANY_SHARED: "Rent, meals. Split across all departments by number of employees.",
  ONE_DEPARTMENT: "Load boards. Charged fully to that department.",
  TWO_DEPARTMENTS: "Dialers. Split between the two by number of employees.",
  COMPANY_ONLY: "This CRM, equipment, legal fees. Not charged to any department.",
};

export function CostsScreen() {
  const [period, setPeriod] = useState(currentPeriod);
  const costs = useCosts(period);
  const { run, busy } = useAdminAction();
  const [editing, setEditing] = useState<Cost | "new" | null>(null);
  const data = costs.data;
  const names = new Map((data?.departments ?? []).map((department) => [department.id, department.name]));

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Costs and P&L" subtitle="Monthly costs and each department's net profit, in USD" actions={<>
      <MonthPicker value={period} onChange={setPeriod} />
      <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing("new")} disabled={!data || data.locked}>Add cost</Button>
    </>} />
    {costs.isLoading ? <Skeleton className="h-80 rounded-card" />
      : costs.isError || !data ? <Card><EmptyState icon={Landmark} title="Costs unavailable" body={costs.error?.message} /></Card>
      : <>
        {data.locked && <p className="flex items-center gap-2 rounded-card border border-success/30 bg-success/[.06] px-5 py-3.5 text-sm"><Lock size={15} className="text-success" />Payroll for this month is finalized, so these figures are frozen.</p>}
        {!data.usd_to_pkr && <p className="rounded-card border border-brand/40 bg-brand-tint px-5 py-3.5 text-sm"><b>No USD to PKR rate for this month.</b> Salaries and PKR costs show as 0 until it is entered on the Payroll page.</p>}

        <Card>
          <CardHeader title="Department P&L" subtitle={periodLabel(period)} />
          {data.department_pl.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Department</th><th className="px-3 py-2.5 text-right font-medium">Income</th><th className="px-3 py-2.5 text-right font-medium">Salaries</th><th className="px-3 py-2.5 text-right font-medium">Commission</th><th className="px-3 py-2.5 text-right font-medium">Other costs</th><th className="px-3 py-2.5 text-right font-medium">Net profit</th><th className="px-5 py-2.5 text-right font-medium">Manager share</th></tr></thead>
            <tbody>{data.department_pl.map((row) => <tr key={`${row.department_id}-${row.manager_id ?? row.unassigned}`} className="border-t border-line-soft">
              <td className="px-5 py-3"><p className="font-semibold">{row.name}</p><p className="text-xs text-muted">{row.people} {row.people === 1 ? "person" : "people"}{row.unassigned ? " · choose their manager under Compensation" : ""}</p></td>
              <td className="px-3 py-3 text-right tabular-nums">{cash(row.income)}</td><td className="px-3 py-3 text-right tabular-nums">{cash(row.salaries)}</td><td className="px-3 py-3 text-right tabular-nums">{cash(row.commissions)}</td><td className="px-3 py-3 text-right tabular-nums">{cash(row.other_costs)}</td>
              <td className={cn("px-3 py-3 text-right font-bold tabular-nums", row.net_profit < 0 && "text-danger")}>{cash(row.net_profit)}</td>
              <td className="px-5 py-3 text-right tabular-nums">{row.manager_share_percent ? <>{cash(row.manager_share)} <span className="text-xs text-muted">({row.manager_share_percent}%)</span></> : "—"}</td>
            </tr>)}</tbody>
          </table></div> : <EmptyState icon={Landmark} title="Nothing this month" body="Departments appear once they have people or income." />}
        </Card>

        <Card>
          <CardHeader title="Costs" subtitle="Entered for each month" />
          {data.costs.length ? <ul className="divide-y divide-line-soft">{data.costs.map((cost) => <li key={cost.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
            <div className="min-w-48 flex-1"><p className="font-semibold">{cost.name}</p><p className="text-xs text-muted">{cost.department_ids.map((id) => names.get(id) ?? "Department").join(" and ") || (cost.cost_type === "COMPANY_ONLY" ? "Not charged to departments" : "All departments")}</p></div>
            <Chip tone={cost.cost_type === "COMPANY_ONLY" ? "neutral" : "accent"}>{costTypeLabel[cost.cost_type]}</Chip>
            <p className="font-semibold tabular-nums">{cost.currency === "PKR" ? pkr(cost.amount) : cash(cost.amount)}</p>
            {!data.locked && <span className="flex gap-1.5"><Button size="sm" variant="outline" icon={<Pencil size={13} />} onClick={() => setEditing(cost)}>Edit</Button><Button size="sm" variant="ghost" icon={<Trash2 size={13} />} aria-label={`Remove ${cost.name}`} disabled={busy()} onClick={() => run("remove", `/api/v1/admin/costs/${cost.id}`, "DELETE", {}, "Cost removed.", "Unable to remove the cost.")} /></span>}
          </li>)}</ul> : <EmptyState icon={Landmark} title="No costs for this month" body="Add rent, software and other costs to work out net profit." />}
        </Card>
      </>}
    {editing && data && <CostDrawer key={editing === "new" ? "new" : editing.id} cost={editing === "new" ? null : editing} period={period} departments={data.departments} onClose={() => setEditing(null)} />}
  </div>;
}

function CostDrawer({ cost, period, departments, onClose }: { cost: Cost | null; period: string; departments: CostsData["departments"]; onClose: () => void }) {
  const { run, busy } = useAdminAction();
  const [form, setForm] = useState({ name: cost?.name ?? "", amount: cost ? String(cost.amount) : "", currency: cost?.currency ?? "USD", cost_type: cost?.cost_type ?? "COMPANY_SHARED" as CostType, first: cost?.department_ids[0] ?? "", second: cost?.department_ids[1] ?? "" });
  const needed = form.cost_type === "ONE_DEPARTMENT" ? 1 : form.cost_type === "TWO_DEPARTMENTS" ? 2 : 0;
  const options = departments.map((department) => ({ value: department.id, label: department.name }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const body = { period, name: form.name, amount: Number(form.amount), currency: form.currency, cost_type: form.cost_type, department_ids: [form.first, form.second].slice(0, needed) };
    if (await run("save", cost ? `/api/v1/admin/costs/${cost.id}` : "/api/v1/admin/costs", cost ? "PUT" : "POST", body, "Cost saved.", "Unable to save the cost.")) onClose();
  };
  return <Drawer open onClose={onClose} dismissible={!busy()} title={cost ? "Edit cost" : "Add cost"} subtitle={periodLabel(period)}
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy()}>Cancel</Button><Button type="submit" form="cost-form" variant="primary" pending={busy("save")} pendingLabel="Saving…">Save</Button></>}>
    <form id="cost-form" onSubmit={save} className="space-y-5">
      <TextField label="Name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Amount" required type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <SelectField label="Currency" value={form.currency} options={[{ value: "USD", label: "USD" }, { value: "PKR", label: "PKR" }]} onChange={(event) => setForm({ ...form, currency: event.target.value as "USD" | "PKR" })} />
      </div>
      <SelectField label="Cost type" hint={costHelp[form.cost_type]} value={form.cost_type} options={(Object.keys(costTypeLabel) as CostType[]).map((value) => ({ value, label: costTypeLabel[value] }))} onChange={(event) => setForm({ ...form, cost_type: event.target.value as CostType })} />
      {needed >= 1 && <SelectField label={needed === 2 ? "First department" : "Department"} required placeholder="Select a department" value={form.first} options={options} onChange={(event) => setForm({ ...form, first: event.target.value })} />}
      {needed === 2 && <SelectField label="Second department" required placeholder="Select a department" value={form.second} options={options.filter((option) => option.value !== form.first)} onChange={(event) => setForm({ ...form, second: event.target.value })} />}
    </form>
  </Drawer>;
}
