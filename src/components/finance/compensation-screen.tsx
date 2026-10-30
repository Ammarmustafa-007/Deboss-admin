"use client";

import { BadgePercent, Pencil, Plus, Save, Trash2, UserRoundX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { dateLabel } from "@/lib/format";
import { useAdminAction } from "@/components/admin/admin-data";
import { Avatar, Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { SelectField, TextField } from "@/components/ui/field";
import { exitLabel, pkr, roleLabel, useEmployees, useHrRules, type Employee, type ExitType, type HrRules, type Tier } from "@/components/finance/finance-data";

/** Each person's base salary and joining date, and the amounts, percentages and targets everyone is paid on. */
export function CompensationScreen() {
  const [tab, setTab] = useState<"employees" | "rules">("employees");
  return <div className="space-y-6 animate-rise">
    <PageHeader title="Compensation" subtitle="Only the Super Admin can see or change these. Every change is logged." />
    <Tabs value={tab} onChange={setTab} items={[{ value: "employees", label: "Employees" }, { value: "rules", label: "Commission rules" }]} />
    {tab === "employees" ? <Employees /> : <Rules />}
  </div>;
}

function Employees() {
  const data = useEmployees();
  const [editing, setEditing] = useState<Employee | null>(null);
  if (data.isLoading) return <Skeleton className="h-80 rounded-card" />;
  if (data.isError || !data.data) return <Card><EmptyState icon={BadgePercent} title="Employees unavailable" body={data.error?.message} /></Card>;
  const { employees } = data.data;
  const missing = employees.filter((person) => person.is_active && !person.configured).length;
  return <>
    {missing > 0 && <p className="rounded-card border border-brand/40 bg-brand-tint px-5 py-3.5 text-sm"><b>{missing} {missing === 1 ? "person has" : "people have"} no base salary yet.</b> Payroll counts them at 0 until it is entered.</p>}
    <Card>{employees.length ? <ul className="divide-y divide-line-soft">{employees.map((person) => <li key={person.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
      <div className="flex min-w-56 flex-1 items-center gap-3"><Avatar name={person.full_name} /><div className="min-w-0"><p className="truncate font-semibold">{person.full_name}</p><p className="truncate text-xs text-muted">{roleLabel[person.role_key]} · {person.department_name ?? "—"}</p></div></div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><div><dt className="text-xs text-muted">Base / month</dt><dd className="font-semibold tabular-nums">{person.configured ? pkr(person.base_salary_pkr) : "Not set"}</dd></div><div><dt className="text-xs text-muted">Joined</dt><dd className="font-semibold">{dateLabel(person.joined_on)}</dd></div></dl>
      {person.exit_type ? <Chip tone="danger">Last day {dateLabel(person.last_working_day!)}</Chip> : !person.is_active ? <Chip>Inactive</Chip> : null}
      <Button size="sm" variant="outline" icon={<Pencil size={13} />} onClick={() => setEditing(person)}>Edit</Button>
    </li>)}</ul> : <EmptyState icon={BadgePercent} title="No employees yet" body="People appear here once they are added under Users." />}</Card>
    {editing && <EmployeeDrawer key={editing.id} person={editing} colleagues={employees.filter((other) => other.is_active && other.id !== editing.id && other.department_id === editing.department_id)} managers={editing.role_key.endsWith("MANAGER") ? [] : employees.filter((other) => other.is_active && other.department_id === editing.department_id && other.role_key.endsWith("MANAGER"))} onClose={() => setEditing(null)} />}
  </>;
}

function EmployeeDrawer({ person, colleagues, managers, onClose }: { person: Employee; colleagues: Employee[]; managers: Employee[]; onClose: () => void }) {
  const { run, busy } = useAdminAction();
  const [form, setForm] = useState({ base: person.base_salary_pkr ? String(person.base_salary_pkr) : "", joined: person.joined_on, manager: person.manager_id ?? "" });
  const [leaving, setLeaving] = useState({ day: "", type: "NOTICE_SERVED" as ExitType, reassign: "" });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (await run("save", `/api/v1/admin/hr/employees/${person.id}`, "PUT", { base_salary_pkr: Number(form.base || 0), joined_on: form.joined, manager_id: form.manager || null }, "Employee saved.", "Unable to save.")) onClose();
  };
  const recordExit = async () => {
    if (await run("exit", `/api/v1/admin/hr/employees/${person.id}/exit`, "POST", { last_working_day: leaving.day, exit_type: leaving.type, reassign_to: leaving.reassign || null }, "Exit recorded.", "Unable to record the exit.")) onClose();
  };
  const cancelExit = async () => { if (await run("cancel", `/api/v1/admin/hr/employees/${person.id}/exit`, "DELETE", {}, "Exit cancelled.", "Unable to cancel the exit.")) onClose(); };
  return <Drawer open onClose={onClose} dismissible={!busy()} title={person.full_name} subtitle={`${roleLabel[person.role_key]} · ${person.department_name ?? "—"}`}
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy()}>Cancel</Button><Button type="submit" form="employee-form" variant="primary" pending={busy("save")} pendingLabel="Saving…">Save</Button></>}>
    <form id="employee-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Base salary per month (PKR)" required type="number" min="0" step="1" value={form.base} onChange={(event) => setForm({ ...form, base: event.target.value })} />
      <TextField label="Joining date" required type="date" value={form.joined} onChange={(event) => setForm({ ...form, joined: event.target.value })} />
      {managers.length > 1 && <SelectField label="Manager" hint="This department has two managers, so each team has its own profit and loss." wrapperClassName="sm:col-span-2" placeholder="Choose a manager" value={form.manager} options={managers.map((manager) => ({ value: manager.id, label: manager.full_name }))} onChange={(event) => setForm({ ...form, manager: event.target.value })} />}
    </form>
    <div className="mt-8 border-t border-line pt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><UserRoundX size={15} />Leaving the company</h3>
      {person.exit_type ? <div className="mt-3 space-y-3 text-sm">
        <p>Last working day <b>{dateLabel(person.last_working_day!)}</b> · {exitLabel[person.exit_type]}</p>
        <Button size="sm" variant="outline" onClick={cancelExit} pending={busy("cancel")} pendingLabel="Cancelling…">Cancel this exit</Button>
      </div> : <div className="mt-3 space-y-4">
        <p className="text-xs text-muted">The login is removed after the last working day. Nothing is deleted. Without notice or when fired, only base salary for days worked is paid.</p>
        <TextField label="Last working day" type="date" value={leaving.day} onChange={(event) => setLeaving({ ...leaving, day: event.target.value })} />
        <SelectField label="Reason" value={leaving.type} options={(Object.keys(exitLabel) as ExitType[]).map((value) => ({ value, label: exitLabel[value] }))} onChange={(event) => setLeaving({ ...leaving, type: event.target.value as ExitType })} />
        <SelectField label="Hand their clients and leads to" placeholder="Decide later" value={leaving.reassign} options={colleagues.map((colleague) => ({ value: colleague.id, label: colleague.full_name }))} onChange={(event) => setLeaving({ ...leaving, reassign: event.target.value })} />
        <Button variant="danger" disabled={!leaving.day} pending={busy("exit")} pendingLabel="Saving…" onClick={recordExit}>Record exit</Button>
      </div>}
    </div>
  </Drawer>;
}

function Rules() {
  const data = useHrRules();
  if (data.isLoading) return <Skeleton className="h-80 rounded-card" />;
  if (data.isError || !data.data) return <Card><EmptyState icon={BadgePercent} title="Rules unavailable" body={data.error?.message} /></Card>;
  return <RulesForm key={JSON.stringify(data.data.rules)} initial={data.data.rules} />;
}

const tierGroups = [{ key: "dispatcher", title: "Dispatcher" }, { key: "brokerage_sales", title: "Brokerage Sales Agent" }, { key: "brokerage_operations", title: "Brokerage Operations Agent" }] as const;
const shareLabels = { DISPATCH_SALES_MANAGER: "Dispatch Sales Manager", DISPATCH_MANAGER: "Dispatch Operations Manager", BROKERAGE_SALES_MANAGER: "Brokerage Sales Manager", BROKERAGE_OPERATIONS_MANAGER: "Brokerage Operations Manager" } as const;

function RulesForm({ initial }: { initial: HrRules }) {
  const { run, busy } = useAdminAction();
  const [rules, setRules] = useState(initial);
  const number = (value: string) => Number(value) || 0;
  const setTiers = (key: (typeof tierGroups)[number]["key"], tiers: Tier[]) => setRules({ ...rules, [key]: { tiers } });
  return <form className="space-y-6" onSubmit={async (event) => { event.preventDefault(); await run("rules", "/api/v1/admin/hr/rules", "PUT", rules, "Rules saved.", "Unable to save the rules."); }}>
    <div className="grid gap-6 xl:grid-cols-3">{tierGroups.map(({ key, title }) => <Card key={key}>
      <CardHeader title={title} subtitle="Gross needed and rate. The rate reached applies to everything above the first target." />
      <div className="space-y-3 px-5 pb-5">
        {rules[key].tiers.map((tier, index) => <div key={index} className="flex items-end gap-2">
          <TextField label={index ? "From $" : "First target $"} type="number" min="0" value={String(tier.from)} onChange={(event) => setTiers(key, rules[key].tiers.map((row, at) => at === index ? { ...row, from: number(event.target.value) } : row))} />
          <TextField label="Rate %" type="number" min="0" max="100" step="0.01" value={String(tier.rate)} onChange={(event) => setTiers(key, rules[key].tiers.map((row, at) => at === index ? { ...row, rate: number(event.target.value) } : row))} />
          <Button type="button" size="sm" variant="ghost" icon={<Trash2 size={13} />} aria-label="Remove level" disabled={rules[key].tiers.length === 1} onClick={() => setTiers(key, rules[key].tiers.filter((_, at) => at !== index))} />
        </div>)}
        <Button type="button" size="sm" variant="outline" icon={<Plus size={13} />} onClick={() => setTiers(key, [...rules[key].tiers, { from: 0, rate: 0 }])}>Add level</Button>
      </div>
    </Card>)}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader title="Sales and Fronters" /><div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <TextField label="Dispatch Sales: active sales needed" type="number" min="0" value={String(rules.dispatch_sales.min_active_sales)} onChange={(event) => setRules({ ...rules, dispatch_sales: { ...rules.dispatch_sales, min_active_sales: number(event.target.value) } })} />
        <TextField label="Dispatch Sales: rate %" type="number" min="0" max="100" step="0.01" value={String(rules.dispatch_sales.rate)} onChange={(event) => setRules({ ...rules, dispatch_sales: { ...rules.dispatch_sales, rate: number(event.target.value) } })} />
        <TextField label="Fronter: per qualified lead (PKR)" type="number" min="0" value={String(rules.fronter_per_lead_pkr)} onChange={(event) => setRules({ ...rules, fronter_per_lead_pkr: number(event.target.value) })} />
        <TextField label="Paid leaves per month" type="number" min="0" value={String(rules.paid_leaves_per_month)} onChange={(event) => setRules({ ...rules, paid_leaves_per_month: number(event.target.value) })} />
      </div></Card>
      <Card><CardHeader title="Manager share of net profit" /><div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">{(Object.keys(shareLabels) as (keyof typeof shareLabels)[]).map((key) => <TextField key={key} label={`${shareLabels[key]} %`} type="number" min="0" max="100" step="0.01" value={String(rules.manager_share[key])} onChange={(event) => setRules({ ...rules, manager_share: { ...rules.manager_share, [key]: number(event.target.value) } })} />)}</div></Card>
    </div>
    <div className="flex justify-end"><Button type="submit" variant="primary" icon={<Save size={15} />} pending={busy("rules")} pendingLabel="Saving…">Save rules</Button></div>
  </form>;
}
