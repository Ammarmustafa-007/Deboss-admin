"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, LockKeyhole, Plus, Search, Unlock, UserPlus, UsersRound } from "lucide-react";
import { use, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { Avatar, Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton, StatusChip, type Tone } from "@/components/ui/surface";
import { Stepper, Tabs } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { PasswordInput, SelectField, TextField, controlClass } from "@/components/ui/field";
import { roleLabel, roles, useAdminAction, useDepartments, useUsers, type AdminUser, type Department } from "@/components/admin/admin-data";

const roleTone: Record<string, Tone> = { SUPER_ADMIN: "brand", MANAGER: "accent", AGENT: "info" };
type Filter = "all" | "SUPER_ADMIN" | "MANAGER" | "AGENT" | "inactive";

export function UsersScreen() {
  const router = useRouter();
  const users = useUsers();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const list = users.data ?? [];
  const term = search.trim().toLowerCase();
  const visible = list.filter((user) => (filter === "all" || (filter === "inactive" ? !user.is_active : user.role === filter)) && (!term || `${user.full_name} ${user.email} ${user.departments?.name ?? ""}`.toLowerCase().includes(term)));

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Users" subtitle="Staff accounts and their access" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New user</Button>} />
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs<Filter> value={filter} onChange={setFilter} className="-mb-px border-b-0" items={[
          { value: "all", label: "All", count: list.length },
          ...roles.map((role) => ({ value: role as Filter, label: `${roleLabel[role]}s`, count: list.filter((user) => user.role === role).length })),
          { value: "inactive", label: "Inactive", count: list.filter((user) => !user.is_active).length, hidden: !list.some((user) => !user.is_active) },
        ]} />
        <label className="relative mb-3 block lg:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" aria-label="Search users" className={cn(controlClass, "h-10 pl-9")} />
        </label>
      </div>
      <div className="border-t border-line">
        {users.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
          : users.isError ? <EmptyState title="Users unavailable" body={users.error.message} />
          : visible.length ? <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Name</th><th className="hidden px-3 py-2.5 font-medium md:table-cell">Department</th><th className="hidden px-3 py-2.5 font-medium sm:table-cell">Role</th><th className="px-3 py-2.5 font-medium">Status</th><th className="w-10" /></tr></thead>
            <tbody>{visible.map((user) => <tr key={user.id} onClick={() => router.push(`/app/admin/users/${user.id}`)} className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-[#FAF8F4]">
              <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={user.full_name} className={cn(!user.is_active && "bg-black/[.06] text-ink/50")} /><div className="min-w-0"><Link href={`/app/admin/users/${user.id}`} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold hover:text-brand-deep">{user.full_name}</Link><p className="truncate text-xs text-muted">{user.email}</p></div></div></td>
              <td className="hidden px-3 py-3 text-[13px] text-ink/75 md:table-cell">{user.departments?.name ?? "Organization-wide"}</td>
              <td className="hidden px-3 py-3 sm:table-cell"><Chip tone={roleTone[user.role]}>{roleLabel[user.role] ?? user.role}</Chip></td>
              <td className="px-3 py-3"><StatusChip status={user.is_active ? "ACTIVE" : "INACTIVE"} /></td>
              <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
            </tr>)}</tbody>
          </table>
          : <EmptyState icon={term ? Search : UsersRound} title={term ? "No users match your search" : list.length ? "Nothing in this view" : "No user accounts yet"} />}
      </div>
    </Card>
    {creating && <NewUser onClose={() => setCreating(false)} />}
  </div>;
}

const blank = { full_name: "", email: "", password: "", role: "AGENT", department_id: "" };

function NewUser({ onClose }: { onClose: () => void }) {
  const departments = useDepartments();
  const notify = useToast();
  const { run, busy } = useAdminAction();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blank);
  const pending = busy("create");
  const active = (departments.data ?? []).filter((department) => department.is_active);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 0) return setStep(1);
    if (form.role !== "SUPER_ADMIN" && !form.department_id) return notify("Select a department before creating this user.", "error");
    if (await run("create", "/api/v1/users", "POST", form, "User account created and ready to sign in.", "Unable to create user.")) onClose();
  };

  return <Modal open onClose={onClose} dismissible={!pending} title="New user" subtitle={step === 0 ? "Step 1 of 2 · Identity" : "Step 2 of 2 · Access"}
    footer={step === 0
      ? <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="user-form" variant="ink">Continue<ArrowRight size={16} /></Button></>
      : <><Button variant="ghost" onClick={() => setStep(0)} disabled={pending}><ArrowLeft size={16} />Back</Button><Button type="submit" form="user-form" variant="primary" icon={<UserPlus size={16} />} pending={pending} pendingLabel="Creating user…">Create user</Button></>}>
    <Stepper steps={[{ label: "Identity" }, { label: "Access" }]} current={step} className="mx-auto mb-6 max-w-xs" />
    <form id="user-form" onSubmit={submit}>
      <fieldset disabled={pending} className="space-y-4">
        {step === 0 ? <>
          <TextField label="Full name" required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          <TextField label="Work email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <PasswordInput label="Temporary password" required minLength={8} autoComplete="new-password" hint="At least 8 characters. Share it with the user securely." value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </> : <>
          <SelectField label="Role" required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, department_id: event.target.value === "SUPER_ADMIN" ? "" : form.department_id })} options={roles.map((role) => ({ value: role, label: roleLabel[role] }))} />
          {form.role === "SUPER_ADMIN" ? <p className="rounded-control bg-brand-tint px-4 py-3 text-sm text-[#7C4400]">Organization-wide access, not tied to a department.</p>
            : <SelectField label="Department" required value={form.department_id} placeholder="Select department" onChange={(event) => setForm({ ...form, department_id: event.target.value })} options={active.map((department) => ({ value: department.id, label: department.name }))} />}
        </>}
      </fieldset>
    </form>
  </Modal>;
}

export function UserRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserScreen userId={id} />;
}

export function UserScreen({ userId }: { userId: string }) {
  const users = useUsers();
  const departments = useDepartments();
  const user = users.data?.find((item) => item.id === userId);
  if (users.isLoading || departments.isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-16 w-80" /><Skeleton className="h-72 rounded-card" /></div>;
  if (users.isError || !user) return <EmptyState title="User not found" body={users.error?.message} action={<LinkButton href="/app/admin/users" variant="ink">Back to users</LinkButton>} className="mt-10" />;
  return <UserView key={user.id} user={user} departments={departments.data ?? []} />;
}

function UserView({ user, departments }: { user: AdminUser; departments: Department[] }) {
  const notify = useToast();
  const { run, busy } = useAdminAction();
  const initial = { full_name: user.full_name, role: user.role, department_id: user.departments?.id ?? "" };
  const [form, setForm] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const dirty = form.full_name !== initial.full_name || form.role !== initial.role || form.department_id !== initial.department_id;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (form.role !== "SUPER_ADMIN" && !form.department_id) return notify("Choose a department for this user.", "error");
    void run("update", `/api/v1/users/${user.id}`, "PATCH", { full_name: form.full_name, role: form.role, department_id: form.role === "SUPER_ADMIN" ? null : form.department_id }, "User access updated.", "Unable to update this user.");
  };
  const setActive = async (is_active: boolean) => {
    if (await run("status", `/api/v1/users/${user.id}`, "PATCH", { is_active }, is_active ? "User reactivated." : "User deactivated. Their login is now blocked.", "Unable to update user status.")) setConfirming(false);
  };

  return <div className="mx-auto max-w-3xl space-y-6 animate-rise">
    <PageHeader crumbs={[{ label: "Users", href: "/app/admin/users" }, { label: user.full_name }]}
      title={<span className="flex flex-wrap items-center gap-3"><Avatar name={user.full_name} className="h-11 w-11 text-sm" />{user.full_name}<StatusChip status={user.is_active ? "ACTIVE" : "INACTIVE"} className="text-[13px]" /></span>}
      subtitle={user.email} />

    <Card>
      <CardHeader title="Access" />
      <form onSubmit={save} className="p-5">
        <fieldset disabled={busy("update")} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} wrapperClassName="sm:col-span-2" />
          <SelectField label="Role" required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, department_id: event.target.value === "SUPER_ADMIN" ? "" : form.department_id })} options={roles.map((role) => ({ value: role, label: roleLabel[role] }))} />
          {form.role === "SUPER_ADMIN" ? <p className="self-end rounded-control bg-brand-tint px-4 py-3 text-sm text-[#7C4400]">Organization-wide access.</p>
            : <SelectField label="Department" required value={form.department_id} placeholder="Select department" onChange={(event) => setForm({ ...form, department_id: event.target.value })} options={departments.filter((department) => department.is_active || department.id === form.department_id).map((department) => ({ value: department.id, label: department.name }))} />}
        </fieldset>
        <div className="mt-6 flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm(initial)} disabled={busy("update")}>Discard</Button>}
          <Button type="submit" variant="ink" pending={busy("update")} pendingLabel="Saving…" disabled={!dirty}>Save changes</Button>
        </div>
      </form>
    </Card>

    <Card>
      <CardHeader title="Account status" />
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm text-muted">{user.is_active ? "This user can sign in." : "Sign-in is blocked for this user."}</p>
        {user.is_active
          ? <Button variant="danger" icon={<LockKeyhole size={15} />} onClick={() => setConfirming(true)} disabled={busy()}>Deactivate user</Button>
          : <Button variant="success" icon={<Unlock size={15} />} pending={busy("status")} pendingLabel="Restoring…" onClick={() => void setActive(true)} disabled={busy() && !busy("status")}>Restore access</Button>}
      </div>
    </Card>

    <Modal open={confirming} onClose={() => setConfirming(false)} dismissible={!busy("status")} title="Deactivate user?"
      footer={<><Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy("status")}>Cancel</Button><Button variant="danger" icon={<LockKeyhole size={15} />} pending={busy("status")} pendingLabel="Deactivating…" onClick={() => void setActive(false)}>Deactivate</Button></>}>
      <p className="text-sm text-muted"><b className="text-ink">{user.full_name}</b> won&apos;t be able to sign in until you restore their access.</p>
    </Modal>
  </div>;
}
