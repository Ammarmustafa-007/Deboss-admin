"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Card, Chip, EmptyState, IconTile, PageHeader, Skeleton, StatusChip, humanize } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextField } from "@/components/ui/field";
import { useDepartments } from "@/components/admin/admin-data";

const blank = { name: "", business_unit: "BROKERAGE", function: "SALES" };

export function DepartmentsScreen() {
  const departments = useDepartments();
  const [creating, setCreating] = useState(false);
  const list = departments.data ?? [];

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Departments" subtitle="Operating lanes that users and teams belong to" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New department</Button>} />
    <Card>
      {departments.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
        : departments.isError ? <EmptyState title="Departments unavailable" body={departments.error.message} />
        : list.length ? <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-3 font-medium">Department</th><th className="hidden px-3 py-3 font-medium sm:table-cell">Business unit</th><th className="hidden px-3 py-3 font-medium sm:table-cell">Function</th><th className="px-5 py-3 text-right font-medium">Status</th></tr></thead>
          <tbody>{list.map((department) => <tr key={department.id} className="border-t border-line-soft">
            <td className="px-5 py-3.5"><div className="flex items-center gap-3"><IconTile icon={Building2} tone={department.function === "SALES" ? "aqua" : "accent"} /><div className="min-w-0"><p className="font-semibold">{department.name}</p><p className="text-xs text-muted sm:hidden">{humanize(department.business_unit)} · {humanize(department.function)}</p></div></div></td>
            <td className="hidden px-3 py-3.5 sm:table-cell"><Chip>{humanize(department.business_unit)}</Chip></td>
            <td className="hidden px-3 py-3.5 sm:table-cell"><Chip tone={department.function === "SALES" ? "aqua" : "accent"}>{humanize(department.function)}</Chip></td>
            <td className="px-5 py-3.5 text-right"><StatusChip status={department.is_active ? "ACTIVE" : "INACTIVE"} /></td>
          </tr>)}</tbody>
        </table>
        : <EmptyState icon={Building2} title="No departments yet" body="Create a department before adding managers and agents." action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New department</Button>} />}
    </Card>
    {creating && <NewDepartment onClose={() => setCreating(false)} />}
  </div>;
}

function NewDepartment({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const notify = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").insert(form);
      if (error) notify(error.message, "error");
      else { notify("Department created."); void queryClient.invalidateQueries({ queryKey: ["admin"] }); onClose(); }
    } finally { setBusy(false); }
  }

  return <Modal open onClose={onClose} dismissible={!busy} title="New department"
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="department-form" variant="primary" pending={busy} pendingLabel="Creating…">Create department</Button></>}>
    <form id="department-form" onSubmit={create}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <TextField label="Department name" required placeholder="Brokerage Sales - East" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} wrapperClassName="sm:col-span-2" />
        <SelectField label="Business unit" required value={form.business_unit} onChange={(event) => setForm({ ...form, business_unit: event.target.value })} options={[{ value: "BROKERAGE", label: "Brokerage" }, { value: "DISPATCH", label: "Dispatch" }]} />
        <SelectField label="Function" required value={form.function} onChange={(event) => setForm({ ...form, function: event.target.value })} options={[{ value: "SALES", label: "Sales" }, { value: "OPERATIONS", label: "Operations" }]} />
      </fieldset>
    </form>
  </Modal>;
}
