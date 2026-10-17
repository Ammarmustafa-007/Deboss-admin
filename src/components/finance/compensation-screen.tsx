"use client";

import { BadgePercent, Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { useAdminAction } from "@/components/admin/admin-data";
import { Avatar, Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { SelectField, TextField } from "@/components/ui/field";
import { basisDescription, basisLabel, roleLabel, useCompensation, type Basis, type RoleKey, type Setting, type StaffMember, cash } from "@/components/finance/finance-data";

type Editing = { kind: "role"; roleKey: RoleKey; setting: Setting | null } | { kind: "person"; person?: StaffMember; setting: Setting | null };

export function CompensationScreen() {
  const data = useCompensation();
  const { run, busy } = useAdminAction();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);

  if (data.isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 rounded-card" /><Skeleton className="h-48 rounded-card" /></div>;
  if (data.isError || !data.data) return <Card><EmptyState icon={BadgePercent} title="Compensation unavailable" body={data.error?.message} /></Card>;

  const { roles, overrides, people } = data.data;
  const personById = new Map(people.map((person) => [person.id, person]));
  const roleSetting = (key: RoleKey) => roles.find((role) => role.role_key === key)?.setting ?? null;
  const unset = roles.filter((role) => !role.setting && role.people > 0);

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Compensation" subtitle="Base salary and commission per role. A personal override replaces the role default." />

    {unset.length > 0 && <p className="rounded-card border border-brand/40 bg-brand-tint px-5 py-3.5 text-sm"><b>{unset.length} role{unset.length === 1 ? "" : "s"} not set yet</b> · payroll shows $0 for {unset.reduce((sum, role) => sum + role.people, 0)} people until they are.</p>}

    <Card>
      <CardHeader title="Role defaults" />
      <ul className="divide-y divide-line-soft">{roles.map((role) => <li key={role.role_key} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <div className="min-w-56 flex-1"><p className="font-semibold">{roleLabel[role.role_key]}</p><p className="text-xs text-muted">{role.people} active {role.people === 1 ? "person" : "people"}</p></div>
        {role.setting ? <SettingSummary setting={role.setting} /> : <Chip tone="brand">Not set</Chip>}
        <Button size="sm" variant="outline" icon={<Pencil size={13} />} onClick={() => setEditing({ kind: "role", roleKey: role.role_key, setting: role.setting })}>{role.setting ? "Edit" : "Set up"}</Button>
      </li>)}</ul>
    </Card>

    <Card>
      <CardHeader title="Personal overrides" subtitle="For individual deals that differ from the role" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setEditing({ kind: "person", setting: null })}>Add override</Button>} />
      {overrides.length ? <ul className="divide-y divide-line-soft">{overrides.map((override) => {
        const person = personById.get(override.user_id);
        if (!person) return null;
        return <li key={override.user_id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <div className="flex min-w-56 flex-1 items-center gap-3"><Avatar name={person.full_name} /><div className="min-w-0"><p className="truncate font-semibold">{person.full_name}</p><p className="truncate text-xs text-muted">{roleLabel[person.role_key]} · {person.department_name ?? "—"}</p></div></div>
          <SettingSummary setting={override} />
          <span className="flex gap-1.5">
            <Button size="sm" variant="outline" icon={<Pencil size={13} />} onClick={() => setEditing({ kind: "person", person, setting: override })}>Edit</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setRemoving(person)} aria-label={`Remove override for ${person.full_name}`} />
          </span>
        </li>;
      })}</ul> : <EmptyState icon={UserCog} title="No personal overrides" body="Everyone is paid on their role default." />}
    </Card>

    {editing && <SettingDrawer key={editing.kind === "role" ? editing.roleKey : editing.person?.id ?? "new"} editing={editing} people={people.filter((person) => person.is_active && !overrides.some((override) => override.user_id === person.id))} roleSetting={roleSetting} onClose={() => setEditing(null)} />}

    <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} dismissible={!busy()} title="Remove override?"
      footer={<><Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy()}>Cancel</Button><Button variant="danger" pending={busy("remove")} pendingLabel="Removing…" onClick={async () => { if (removing && await run("remove", `/api/v1/admin/compensation/users/${removing.id}`, "DELETE", undefined, "Override removed.", "Unable to remove the override.")) setRemoving(null); }}>Remove</Button></>}>
      <p className="text-sm text-muted"><b className="text-ink">{removing?.full_name}</b> goes back to the {removing ? roleLabel[removing.role_key] : ""} default.</p>
    </Modal>
  </div>;
}

function SettingSummary({ setting }: { setting: Setting }) {
  return <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
    <div><dt className="text-xs text-muted">Base / month</dt><dd className="font-semibold tabular-nums">{cash(setting.base_salary)}</dd></div>
    <div><dt className="text-xs text-muted">Commission</dt><dd className="font-semibold tabular-nums">{setting.commission_rate}%</dd></div>
    <div><dt className="text-xs text-muted">Basis</dt><dd className="font-semibold">{basisLabel[setting.commission_basis]}</dd></div>
  </dl>;
}

function SettingDrawer({ editing, people, roleSetting, onClose }: { editing: Editing; people: StaffMember[]; roleSetting: (key: RoleKey) => Setting | null; onClose: () => void }) {
  const { run, busy } = useAdminAction();
  const [personId, setPersonId] = useState(editing.kind === "person" ? editing.person?.id ?? "" : "");
  const person = editing.kind === "person" ? editing.person ?? people.find((candidate) => candidate.id === personId) : undefined;
  const roleKey = editing.kind === "role" ? editing.roleKey : person?.role_key;
  const start = editing.setting ?? (roleKey ? roleSetting(roleKey) : null);
  const [form, setForm] = useState({ base_salary: start ? String(start.base_salary) : "", commission_rate: start ? String(start.commission_rate) : "", commission_basis: (start?.commission_basis ?? "APPROVED_GROSS") as Basis });
  const pending = busy("save");
  const rate = Number(form.commission_rate || 0);

  // Pick a person first: prefill from their role default.
  const pickPerson = (id: string) => {
    setPersonId(id);
    const picked = people.find((candidate) => candidate.id === id);
    const fallback = picked ? roleSetting(picked.role_key) : null;
    if (fallback) setForm({ base_salary: String(fallback.base_salary), commission_rate: String(fallback.commission_rate), commission_basis: fallback.commission_basis });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const body = { base_salary: Number(form.base_salary || 0), commission_rate: rate, commission_basis: form.commission_basis };
    const path = editing.kind === "role" ? `/api/v1/admin/compensation/roles/${editing.roleKey}` : `/api/v1/admin/compensation/users/${person?.id}`;
    if (await run("save", path, "PUT", body, "Compensation saved.", "Unable to save compensation.")) onClose();
  };

  return <Drawer open onClose={onClose} dismissible={!pending}
    title={editing.kind === "role" ? roleLabel[editing.roleKey] : editing.person ? editing.person.full_name : "Add personal override"}
    subtitle={editing.kind === "role" ? "Default for everyone in this role" : person ? `${roleLabel[person.role_key]} · overrides the role default` : "Choose who this applies to"}
    footer={<><Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" form="compensation-form" variant="primary" pending={pending} pendingLabel="Saving…" disabled={editing.kind === "person" && !person}>Save</Button></>}>
    <form id="compensation-form" onSubmit={save} className="space-y-5">
      {editing.kind === "person" && !editing.person && <SelectField label="Person" required value={personId} placeholder="Select a person" onChange={(event) => pickPerson(event.target.value)} options={people.map((candidate) => ({ value: candidate.id, label: `${candidate.full_name} · ${roleLabel[candidate.role_key]}` }))} />}
      <fieldset disabled={pending || (editing.kind === "person" && !person)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Base salary per month" required type="number" min="0" step="0.01" value={form.base_salary} onChange={(event) => setForm({ ...form, base_salary: event.target.value })} hint={form.base_salary ? cash(form.base_salary) : undefined} />
          <TextField label="Commission %" required type="number" min="0" max="100" step="0.01" value={form.commission_rate} onChange={(event) => setForm({ ...form, commission_rate: event.target.value })} />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink/80">Commission is paid on</p>
          <div className="grid gap-2">{(["APPROVED_GROSS", "COLLECTED"] as const).map((basis) => <label key={basis} className={cn("flex cursor-pointer gap-3 rounded-control border p-3.5 transition-colors", form.commission_basis === basis ? "border-brand bg-brand-tint/60" : "border-line hover:border-[#CFC8BA]")}>
            <input type="radio" name="basis" checked={form.commission_basis === basis} onChange={() => setForm({ ...form, commission_basis: basis })} className="mt-0.5 h-4 w-4" />
            <span><span className="block text-sm font-semibold">{basisLabel[basis]}</span><span className="block text-xs text-muted">{basisDescription(basis, roleKey)}</span></span>
          </label>)}</div>
        </div>
        <div className="rounded-control bg-canvas px-4 py-3 text-sm">Example: on <b>{cash(10000)}</b> {basisLabel[form.commission_basis].toLowerCase()}, commission is <b>{cash(10000 * rate / 100)}</b> and the month totals <b>{cash(Number(form.base_salary || 0) + 10000 * rate / 100)}</b>.</div>
      </fieldset>
    </form>
  </Drawer>;
}
