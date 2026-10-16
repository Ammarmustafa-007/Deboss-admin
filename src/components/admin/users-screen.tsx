"use client";

import { useState, type FormEvent } from "react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Field, Select, Submit, UserEditor, UserList, type Profile } from "@/components/admin/parts";
import { useAdminRefresh, useDepartments, useUsers } from "@/components/admin/admin-data";

const blank = { full_name: "", email: "", password: "", role: "AGENT", department_id: "" };

export function UsersScreen() {
  const api = useApi();
  const notify = useToast();
  const departments = useDepartments();
  const users = useUsers();
  const refresh = useAdminRefresh();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const departmentList = departments.data ?? [];

  async function addUser(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!form.department_id && form.role !== "SUPER_ADMIN") return notify("Select a department before creating this user.", "error");
    setBusy(true);
    try {
      const response = await api("/api/v1/users", { method: "POST", body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) notify(payload.error ?? "Unable to create user.", "error");
      else { setForm(blank); notify("User account created and ready to sign in."); void refresh(); }
    } catch { notify("The Users API could not be reached.", "error"); } finally { setBusy(false); }
  }

  async function updateUser(event: FormEvent) {
    event.preventDefault();
    if (!editingUser || userActionId) return;
    const departmentId = editingUser.departments?.id;
    if (editingUser.role !== "SUPER_ADMIN" && !departmentId) return notify("Choose a department for this user.", "error");
    setUserActionId(editingUser.id);
    try {
      const response = await api(`/api/v1/users/${editingUser.id}`, { method: "PATCH", body: JSON.stringify({ full_name: editingUser.full_name, role: editingUser.role, department_id: editingUser.role === "SUPER_ADMIN" ? null : departmentId }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) notify(payload?.error ?? "Unable to update this user.", "error");
      else { setEditingUser(null); notify("User access updated."); void refresh(); }
    } catch { notify("The Users API could not be reached.", "error"); } finally { setUserActionId(null); }
  }

  async function toggleUserStatus(user: Profile) {
    if (userActionId) return;
    setUserActionId(user.id);
    try {
      const response = await api(`/api/v1/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !user.is_active }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) notify(payload?.error ?? "Unable to update user status.", "error");
      else { notify(user.is_active ? "User deactivated. Their login is now blocked." : "User reactivated."); void refresh(); }
    } catch { notify("The Users API could not be reached.", "error"); } finally { setUserActionId(null); }
  }

  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
    <form onSubmit={addUser} className="rounded-lg bg-ink-soft p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-brand">New user</p><h2 className="mt-2 text-xl font-semibold">Provision access.</h2><fieldset disabled={busy} className="mt-6 space-y-4 disabled:opacity-50"><Field label="Full name" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} /><Field label="Work email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><Field label="Temporary password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} /><div className={`grid gap-3 ${form.role === "SUPER_ADMIN" ? "grid-cols-1" : "grid-cols-2"}`}><Select label="Role" value={form.role} options={["SUPER_ADMIN", "MANAGER", "AGENT"]} onChange={(role) => setForm({ ...form, role, department_id: role === "SUPER_ADMIN" ? "" : form.department_id })} />{form.role !== "SUPER_ADMIN" && <Select label="Department" value={form.department_id} options={departmentList.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))} onChange={(department_id) => setForm({ ...form, department_id })} />}</div><Submit busy={busy} label="Create user" loadingLabel="Creating user..." /></fieldset></form>
    {users.isError ? <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{users.error.message}</p> : <UserList users={users.data ?? []} actionId={userActionId} onEdit={setEditingUser} onToggleStatus={toggleUserStatus} />}
    {editingUser && <UserEditor user={editingUser} departments={departmentList} busy={userActionId === editingUser.id} onChange={setEditingUser} onClose={() => setEditingUser(null)} onSubmit={updateUser} />}
  </div>;
}
