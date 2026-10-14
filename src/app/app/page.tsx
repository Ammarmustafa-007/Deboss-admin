"use client";

import { Activity, AlertCircle, BarChart3, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye, EyeOff, LoaderCircle, LogOut, Plus, Settings, TrendingUp, Truck, UsersRound, X } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrokerageCommandCenter } from "@/components/brokerage-command-center";
import { WorkspaceLoadError } from "@/components/workspace-load-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Department = { id: string; name: string; business_unit: string; function: string; is_active: boolean };
type Profile = { id: string; full_name: string; email: string; role: string; is_active: boolean; departments?: { id?: string; name: string; business_unit?: string; function?: string } | null };
type Tab = "departments" | "users" | "brokerage" | "settings";
type Busy = "department" | "user" | "password" | "signout" | null;
type Toast = { message: string; kind: "success" | "error" };

async function withTimeout<T>(promise: PromiseLike<T>, message: string, timeoutMs = 12_000): Promise<T> {
  let timeout: number | undefined;
  const expiration = new Promise<never>((_, reject) => {
    timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), expiration]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export default function AdminWorkspace() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("departments");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const loadRequest = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({ name: "", business_unit: "BROKERAGE", function: "SALES" });
  const [userForm, setUserForm] = useState({ full_name: "", email: "", password: "", role: "AGENT", department_id: "" });
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        setUsers([]);
        setLoading(false);
        router.replace("/");
        return;
      }
      if (_event === "SIGNED_IN" || _event === "USER_UPDATED") void load(false);
    });
    void load(true);
    return () => subscription.unsubscribe();
  }, [router, supabase]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), 3600); return () => window.clearTimeout(timeout); }, [toast]);
  function notify(message: string, kind: Toast["kind"] = "success") { setToast({ message, kind }); }
  async function prefetchBrokerage() { await queryClient.prefetchQuery({ queryKey: ["brokerage-overview"], queryFn: async () => { const token = (await supabase.auth.getSession()).data.session?.access_token; const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/brokerage/overview`, { headers: { Authorization: `Bearer ${token}` } }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Unable to load Brokerage overview."); return body; } }); }
  useEffect(() => { if (profile?.role === "SUPER_ADMIN") void prefetchBrokerage(); }, [profile?.role]);

  async function load(showSplash = false) {
    const requestId = ++loadRequest.current;
    if (showSplash) {
      setLoading(true);
      setLoadError("");
    }
    try {
      const { data: auth, error: authError } = await withTimeout(supabase.auth.getUser(), "Your sign-in session could not be verified. Please try again.");
      if (requestId !== loadRequest.current) return;
      if (authError) throw authError;
      if (!auth.user) {
        router.replace("/");
        return;
      }
      const [profileResult, departmentsResult] = await withTimeout(Promise.all([
        supabase.from("profiles").select("id, full_name, email, role, is_active, departments!profiles_department_id_fkey(id, name, business_unit, function)").eq("id", auth.user.id).single(),
        supabase.from("departments").select("*").order("name"),
      ]), "Your workspace details took too long to load. Please try again.");
      if (requestId !== loadRequest.current) return;
      const { data: me, error: profileError } = profileResult;
      const { data: dept, error: departmentsError } = departmentsResult;
      if (profileError || !me) throw new Error(profileError?.message ?? "Your account profile is incomplete.");
      if (!me.is_active) throw new Error("This account is inactive. Ask a Super Admin to restore access.");
      if (departmentsError) throw new Error(departmentsError.message);
      setProfile(me as unknown as Profile);
      setDepartments((dept ?? []) as Department[]);
      setLoadError("");
      if (me.role !== "SUPER_ADMIN") return;
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const response = await withTimeout(fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/users`, { headers: { Authorization: `Bearer ${token}` } }), "The Users API did not respond.");
        if (requestId !== loadRequest.current) return;
        if (response.ok) setUsers((await response.json()).users);
        else notify((await response.json().catch(() => null))?.error ?? "User management API is unavailable.", "error");
      } catch { notify("User management API is offline.", "error"); }
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      setProfile(null);
      setUsers([]);
      setDepartments([]);
      setLoadError(error instanceof Error ? error.message : "Your workspace could not be loaded.");
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }

  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("department");
    try {
      const { error } = await supabase.from("departments").insert(departmentForm);
      if (error) notify(error.message, "error");
      else { setDepartmentForm({ name: "", business_unit: "BROKERAGE", function: "SALES" }); notify("Department created."); void load(); }
    } finally { setBusy(null); }
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!userForm.department_id) return notify("Select a department before creating this user.", "error");
    setBusy("user");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(userForm) });
      const payload = await response.json();
      if (!response.ok) notify(payload.error ?? "Unable to create user.", "error");
      else { setUserForm({ full_name: "", email: "", password: "", role: "AGENT", department_id: "" }); notify("User account created and ready to sign in."); void load(); }
    } catch { notify("The Users API could not be reached.", "error"); } finally { setBusy(null); }
  }

  async function updateUser(event: FormEvent) {
    event.preventDefault();
    if (!editingUser || userActionId) return;
    const departmentId = editingUser.departments?.id;
    if (editingUser.role !== "SUPER_ADMIN" && !departmentId) return notify("Choose a department for this user.", "error");
    setUserActionId(editingUser.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/users/${editingUser.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ full_name: editingUser.full_name, role: editingUser.role, department_id: editingUser.role === "SUPER_ADMIN" ? null : departmentId }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) notify(payload?.error ?? "Unable to update this user.", "error");
      else { setEditingUser(null); notify("User access updated."); void load(); }
    } catch { notify("The Users API could not be reached.", "error"); } finally { setUserActionId(null); }
  }

  async function toggleUserStatus(user: Profile) {
    if (userActionId) return;
    setUserActionId(user.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_active: !user.is_active }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) notify(payload?.error ?? "Unable to update user status.", "error");
      else { notify(user.is_active ? "User deactivated. Their login is now blocked." : "User reactivated."); void load(); }
    } catch { notify("The Users API could not be reached.", "error"); } finally { setUserActionId(null); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (passwordForm.password.length < 8) return notify("Password must contain at least 8 characters.", "error");
    if (passwordForm.password !== passwordForm.confirm) return notify("Password confirmation does not match.", "error");
    setBusy("password");
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (error) notify(error.message, "error");
      else { setPasswordForm({ password: "", confirm: "" }); notify("Your password has been updated securely."); }
    } finally { setBusy(null); }
  }

  async function signOut() {
    if (busy) return;
    setBusy("signout");
    try { await supabase.auth.signOut(); }
    finally { setProfile(null); setUsers([]); setBusy(null); router.replace("/"); router.refresh(); }
  }

  if (loading) return <WorkspaceSplash />;
  if (loadError || !profile) return <WorkspaceLoadError message={loadError || "Your account profile is unavailable."} onRetry={() => void load(true)} onSignOut={signOut} />;
  if (profile?.role !== "SUPER_ADMIN") return <BrokerageCommandCenter profile={profile!} onSignOut={signOut} />;

  return <main className="min-h-screen bg-[#f4f3ef] text-[#171716]">
    <aside className={`fixed inset-y-0 hidden flex-col bg-[#10100f] p-4 text-white transition-[width] duration-300 lg:flex ${sidebarOpen ? "w-64" : "w-[76px]"}`}>
      <div className="mb-12 flex items-center justify-between gap-3"><div className="flex items-center gap-3 overflow-hidden"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#f59a18] text-black"><Building2 size={18} /></span>{sidebarOpen && <div><p className="text-sm font-bold tracking-[0.18em]">DEBOSS</p><p className="text-[8px] font-bold tracking-[0.22em] text-[#f59a18]">GLOBAL OPERATIONS</p></div>}</div><button onClick={() => setSidebarOpen(!sidebarOpen)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>{sidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button></div>
      {sidebarOpen && <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">Administration</p>}
      <NavButton compact={!sidebarOpen} icon={Building2} label="Departments" active={tab === "departments"} onClick={() => setTab("departments")} />
      <NavButton compact={!sidebarOpen} icon={UsersRound} label="Users" active={tab === "users"} onClick={() => setTab("users")} />
      <NavButton compact={!sidebarOpen} icon={Truck} label="Brokerage" active={tab === "brokerage"} onClick={() => setTab("brokerage")} onIntent={() => void prefetchBrokerage()} />
      <NavButton compact={!sidebarOpen} icon={Settings} label="Settings" active={tab === "settings"} onClick={() => setTab("settings")} />
      <button disabled={Boolean(busy)} onClick={signOut} title="Sign out" className={`mt-auto flex h-10 items-center gap-3 border-t border-white/10 pt-4 text-sm text-white/55 disabled:opacity-50 ${sidebarOpen ? "px-3" : "justify-center"}`}><LogOut size={17} />{sidebarOpen && (busy === "signout" ? "Signing out..." : "Sign out")}</button>
    </aside>
    <section className={`transition-[padding] duration-300 ${sidebarOpen ? "lg:pl-64" : "lg:pl-[76px]"}`}>
      <header className="flex min-h-20 items-center justify-between border-b border-black/8 bg-white px-6 lg:px-10"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a65c00]">Super Admin</p><h1 className="text-xl font-semibold">{tab === "brokerage" ? "Brokerage Overview" : tab[0].toUpperCase() + tab.slice(1)}</h1></div><div className="rounded-md bg-[#1e1d1a] px-3 py-2 text-xs font-semibold text-white">{profile.full_name}</div></header>
      <div className="mx-auto max-w-[1440px] p-6 lg:p-10">
        {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
        {tab === "departments" && <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><form onSubmit={addDepartment} className="rounded-lg bg-[#1a1917] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#f59a18]">New department</p><h2 className="mt-2 text-xl font-semibold">Define its operating lane.</h2><fieldset disabled={busy === "department"} className="mt-6 space-y-4 disabled:opacity-50"><Field label="Department name" value={departmentForm.name} onChange={(name) => setDepartmentForm({ ...departmentForm, name })} placeholder="Brokerage Sales - East" /><div className="grid grid-cols-2 gap-3"><Select label="Business unit" value={departmentForm.business_unit} options={["BROKERAGE", "DISPATCH"]} onChange={(business_unit) => setDepartmentForm({ ...departmentForm, business_unit })} /><Select label="Function" value={departmentForm.function} options={["SALES", "OPERATIONS"]} onChange={(functionValue) => setDepartmentForm({ ...departmentForm, function: functionValue })} /></div><Submit busy={busy === "department"} label="Create department" loadingLabel="Creating department..." /></fieldset></form><DataList columns={["Name", "Unit", "Function", "Status"]} rows={departments.map((d) => [d.name, d.business_unit, d.function, d.is_active ? "ACTIVE" : "INACTIVE"])} empty="No departments created yet." /></div>}
        {tab === "users" && <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><form onSubmit={addUser} className="rounded-lg bg-[#1a1917] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#f59a18]">New user</p><h2 className="mt-2 text-xl font-semibold">Provision access.</h2><fieldset disabled={busy === "user"} className="mt-6 space-y-4 disabled:opacity-50"><Field label="Full name" value={userForm.full_name} onChange={(full_name) => setUserForm({ ...userForm, full_name })} /><Field label="Work email" type="email" value={userForm.email} onChange={(email) => setUserForm({ ...userForm, email })} /><Field label="Temporary password" type="password" value={userForm.password} onChange={(password) => setUserForm({ ...userForm, password })} /><div className={`grid gap-3 ${userForm.role === "SUPER_ADMIN" ? "grid-cols-1" : "grid-cols-2"}`}><Select label="Role" value={userForm.role} options={["SUPER_ADMIN", "MANAGER", "AGENT"]} onChange={(role) => setUserForm({ ...userForm, role, department_id: role === "SUPER_ADMIN" ? "" : userForm.department_id })} />{userForm.role !== "SUPER_ADMIN" && <Select label="Department" value={userForm.department_id} options={departments.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))} onChange={(department_id) => setUserForm({ ...userForm, department_id })} />}</div>{userForm.role === "SUPER_ADMIN" && <p className="text-xs leading-5 text-white/50">Super Admins have organization-wide access and are not assigned to a department.</p>}<Submit busy={busy === "user"} label="Create user" loadingLabel="Creating user..." /></fieldset></form><UserList users={users} actionId={userActionId} onEdit={setEditingUser} onToggleStatus={toggleUserStatus} /></div>}
        {tab === "brokerage" && <BrokerageOverviewPanel supabase={supabase} />}
        {tab === "settings" && <div className="grid max-w-3xl gap-6 lg:grid-cols-[1fr_1.2fr]"><div className="rounded-lg bg-[#1a1917] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#f59a18]">Account security</p><h2 className="mt-2 text-xl font-semibold">Own your access.</h2><p className="mt-4 text-sm leading-6 text-white/55">Passwords are stored by Supabase Auth as secure hashes, never as plain text.</p></div><form onSubmit={changePassword} className="rounded-lg border border-black/8 bg-white p-6"><h2 className="text-lg font-semibold">Change password</h2><fieldset disabled={busy === "password"} className="mt-6 space-y-4 disabled:opacity-50"><PasswordField label="New password" value={passwordForm.password} visible={showPassword} onVisibility={() => setShowPassword(!showPassword)} onChange={(password) => setPasswordForm({ ...passwordForm, password })} /><PasswordField label="Confirm password" value={passwordForm.confirm} visible={showPassword} onVisibility={() => setShowPassword(!showPassword)} onChange={(confirm) => setPasswordForm({ ...passwordForm, confirm })} /><button disabled={busy === "password"} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black disabled:opacity-60">{busy === "password" && <LoaderCircle size={16} className="animate-spin" />}{busy === "password" ? "Saving password..." : "Save new password"}</button></fieldset></form></div>}
      </div>
    </section>
    {editingUser && <UserEditor user={editingUser} departments={departments} busy={userActionId === editingUser.id} onChange={setEditingUser} onClose={() => setEditingUser(null)} onSubmit={updateUser} />}
  </main>;
}

function NavButton({ icon: Icon, label, active, onClick, compact = false, onIntent }: { icon: typeof Building2; label: string; active: boolean; onClick: () => void; compact?: boolean; onIntent?: () => void }) { return <button onClick={onClick} onMouseEnter={onIntent} onFocus={onIntent} title={compact ? label : undefined} className={`mb-1 flex h-11 items-center gap-3 rounded-md text-sm transition ${compact ? "justify-center px-0" : "px-3"} ${active ? "bg-[#f59a18] font-bold text-black" : "text-white/55 hover:bg-white/10 hover:text-white"}`}><Icon size={17} />{!compact && label}</button>; }
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="block text-xs font-semibold text-white/70">{label}<input required minLength={type === "password" ? 8 : undefined} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-[#f59a18]" /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (value: string) => void }) { return <label className="text-xs font-semibold text-white/70">{label}<select required value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#242320] px-3 text-sm">{value === "" && <option value="" disabled>Select {label}</option>}{options.map((item) => { const option = typeof item === "string" ? { value: item, label: item } : item; return <option key={option.value} value={option.value}>{option.label}</option>; })}</select></label>; }
function Submit({ busy, label, loadingLabel }: { busy: boolean; label: string; loadingLabel: string }) { return <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black disabled:opacity-60">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{busy ? loadingLabel : label}</button>; }
function DataList({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) { return <div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="grid grid-cols-4 gap-3 border-b border-black/8 px-5 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.length ? rows.map((row, index) => <div key={index} className="grid grid-cols-4 gap-3 border-b border-black/5 px-5 py-4 text-sm last:border-0">{row.map((value, column) => <span key={column} className={column === 0 ? "font-semibold" : value === "ACTIVE" ? "text-emerald-700" : "text-black/55"}>{value}</span>)}</div>) : <p className="p-8 text-sm text-black/45">{empty}</p>}</div>; }
function UserList({ users, actionId, onEdit, onToggleStatus }: { users: Profile[]; actionId: string | null; onEdit: (user: Profile) => void; onToggleStatus: (user: Profile) => void }) { return <div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="grid grid-cols-[1.25fr_1fr_.65fr_.65fr_auto] gap-3 border-b border-black/8 px-5 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-black/40"><span>Name</span><span>Department</span><span>Role</span><span>Status</span><span className="text-right">Actions</span></div>{users.length ? users.map((user) => <div key={user.id} className="grid grid-cols-[1.25fr_1fr_.65fr_.65fr_auto] items-center gap-3 border-b border-black/5 px-5 py-4 text-sm last:border-0"><div className="min-w-0"><p className="truncate font-semibold">{user.full_name}</p><p className="mt-1 truncate text-xs text-black/45">{user.email}</p></div><span className="truncate text-black/55">{user.departments?.name ?? "Leadership"}</span><span className="text-black/55">{user.role}</span><span className={user.is_active ? "text-emerald-700" : "text-red-600"}>{user.is_active ? "ACTIVE" : "INACTIVE"}</span><div className="flex justify-end gap-2"><button disabled={actionId === user.id} onClick={() => onEdit({ ...user, departments: user.departments ? { ...user.departments } : user.departments })} className="h-8 rounded-md border border-black/10 px-3 text-xs font-bold hover:bg-black/5 disabled:opacity-50">Edit</button><button disabled={actionId === user.id} onClick={() => onToggleStatus(user)} className={`h-8 rounded-md px-3 text-xs font-bold disabled:opacity-50 ${user.is_active ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-emerald-600 text-white"}`}>{actionId === user.id ? <LoaderCircle size={14} className="animate-spin" /> : user.is_active ? "Deactivate" : "Restore"}</button></div></div>) : <p className="p-8 text-sm text-black/45">No user accounts created yet.</p>}</div>; }
function UserEditor({ user, departments, busy, onChange, onClose, onSubmit }: { user: Profile; departments: Department[]; busy: boolean; onChange: (user: Profile) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) { const departmentId = user.departments?.id ?? ""; return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-5"><form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#a65c00]">User access</p><h2 className="mt-2 text-xl font-semibold">Edit team member</h2><p className="mt-2 text-sm text-black/50">{user.email}</p></div><button type="button" disabled={busy} onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-black/5"><X size={16} /></button></div><fieldset disabled={busy} className="mt-6 space-y-4 disabled:opacity-55"><label className="block text-xs font-bold text-black/55">Full name<input required value={user.full_name} onChange={(event) => onChange({ ...user, full_name: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-sm" /></label><label className="block text-xs font-bold text-black/55">Role<select value={user.role} onChange={(event) => onChange({ ...user, role: event.target.value, departments: event.target.value === "SUPER_ADMIN" ? null : user.departments })} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm"><option>SUPER_ADMIN</option><option>MANAGER</option><option>AGENT</option></select></label>{user.role === "SUPER_ADMIN" ? <p className="rounded-md bg-[#fff5e5] px-3 py-3 text-xs leading-5 text-[#7c4400]">Super Admin has organization-wide access and is intentionally outside every department.</p> : <label className="block text-xs font-bold text-black/55">Department<select required value={departmentId} onChange={(event) => onChange({ ...user, departments: { id: event.target.value, name: departments.find((department) => department.id === event.target.value)?.name ?? "" } })} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm"><option value="">Select department</option>{departments.filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}<button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black disabled:opacity-60">{busy && <LoaderCircle size={16} className="animate-spin" />}{busy ? "Saving changes..." : "Save changes"}</button></fieldset></form></div>; }
function BrokerageOverviewPanel({ supabase }: { supabase: any }) { const { data: overview, error } = useQuery({ queryKey: ["brokerage-overview"], queryFn: async () => { const token = (await supabase.auth.getSession()).data.session?.access_token; const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/brokerage/overview`, { headers: { Authorization: `Bearer ${token}` } }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Unable to load Brokerage overview."); return body; } }); if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error.message}</div>; if (!overview) return <BrokerageOverviewSkeleton />; const exceptions = overview.shipments.filter((shipment: any) => shipment.exception_note).length; const invoiceReady = overview.shipments.filter((shipment: any) => shipment.invoice_ready).length; return <div className="animate-in fade-in duration-300"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Live operating picture</p><h2 className="mt-2 text-3xl font-semibold">Sales-to-Operations, in one view.</h2></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Building2} label="Brokerage departments" value={overview.departments.length} /><Metric icon={TrendingUp} label="Sales leads" value={overview.leads.length} /><Metric icon={Truck} label="Operations shipments" value={overview.shipments.length} /><Metric icon={BarChart3} label="Invoice-ready" value={invoiceReady} /></div><div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]"><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><p className="font-semibold">Control points</p><p className="mt-1 text-xs text-black/45">Workflow volume that needs attention.</p></div><div className="divide-y divide-black/6">{[["Active teams", overview.teams.filter((team: any) => team.is_active).length], ["Approved quotes", overview.quotes.filter((quote: any) => quote.stage === "APPROVED").length], ["Handed to Operations", overview.quotes.filter((quote: any) => quote.stage === "HANDED_OFF").length], ["Open exceptions", exceptions]].map(([label, value]) => <div key={label as string} className="flex items-center justify-between px-5 py-4"><span className="text-sm text-black/60">{label as string}</span><span className={`text-sm font-bold ${label === "Open exceptions" && value ? "text-red-600" : "text-black"}`}>{value as number}</span></div>)}</div></div><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="flex items-center gap-2 border-b border-black/8 px-5 py-4"><Activity size={17} className="text-[#a65c00]" /><div><p className="font-semibold">Audit history</p><p className="mt-1 text-xs text-black/45">Permission, approval, handoff and status activity.</p></div></div><div className="max-h-80 divide-y divide-black/6 overflow-auto">{overview.audit.map((event: any) => <div key={event.id} className="px-5 py-4"><p className="text-sm font-semibold">{event.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-black/45">{event.entity_type} · {new Date(event.created_at).toLocaleString()}</p></div>)}{!overview.audit.length && <p className="p-8 text-sm text-black/45">Audit history will appear as Brokerage work begins.</p>}</div></div></div></div>; }
function BrokerageOverviewSkeleton() { const shimmer = "animate-pulse rounded-md bg-black/[.07]"; return <div aria-label="Loading Brokerage overview" aria-busy="true"><div><div className={`${shimmer} h-3 w-32`} /><div className={`${shimmer} mt-3 h-9 w-80 max-w-full`} /></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="rounded-lg border border-black/8 bg-white p-5"><div className={`${shimmer} h-5 w-5`} /><div className={`${shimmer} mt-4 h-8 w-12`} /><div className={`${shimmer} mt-2 h-3 w-28`} /></div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]"><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><div className={`${shimmer} h-4 w-28`} /><div className={`${shimmer} mt-2 h-3 w-48`} /></div>{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center justify-between border-b border-black/6 px-5 py-4 last:border-0"><div className={`${shimmer} h-4 w-32`} /><div className={`${shimmer} h-4 w-8`} /></div>)}</div><div className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="border-b border-black/8 px-5 py-4"><div className={`${shimmer} h-4 w-28`} /><div className={`${shimmer} mt-2 h-3 w-56`} /></div>{Array.from({ length: 4 }).map((_, index) => <div key={index} className="border-b border-black/6 px-5 py-4 last:border-0"><div className={`${shimmer} h-4 w-40`} /><div className={`${shimmer} mt-2 h-3 w-28`} /></div>)}</div></div></div>; }
function PasswordField({ label, value, visible, onVisibility, onChange }: { label: string; value: string; visible: boolean; onVisibility: () => void; onChange: (value: string) => void }) { return <label className="block text-xs font-semibold">{label}<span className="relative mt-2 block"><input required minLength={8} type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-md border border-black/10 px-3 pr-11 text-sm outline-none focus:border-[#f59a18]" /><button type="button" onClick={onVisibility} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-black/45">{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>; }
function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) { const success = toast.kind === "success"; return <motion.div initial={{ opacity: 0, y: -14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} role="status" aria-live="polite" className={`fixed right-5 top-5 z-50 flex w-[min(390px,calc(100vw-40px))] items-center gap-3 rounded-lg border p-4 shadow-2xl ${success ? "border-emerald-400/30 bg-[#10231d] text-emerald-50" : "border-red-400/30 bg-[#311718] text-red-50"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${success ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>{success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}</span><p className="flex-1 text-sm font-medium leading-5">{toast.message}</p><button onClick={onClose} aria-label="Dismiss notification" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"><X size={16} /></button><motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 3.6, ease: "linear" }} className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${success ? "bg-emerald-300" : "bg-red-300"}`} /></motion.div>; }
function TeamWorkspace({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) { const role = profile.role.replace("_", " "); const department = profile.departments?.name ?? "Unassigned department"; return <main className="min-h-screen bg-[#f4f3ef] text-[#171716]"><header className="flex h-20 items-center justify-between border-b border-black/8 bg-white px-6 lg:px-12"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#f59a18] text-black"><Building2 size={18} /></span><div><p className="text-sm font-bold tracking-[.18em]">DEBOSS</p><p className="text-[8px] font-bold tracking-[.2em] text-[#a65c00]">GLOBAL OPERATIONS</p></div></div><button onClick={onSignOut} className="flex h-9 items-center gap-2 rounded-md border border-black/10 px-3 text-xs font-semibold"><LogOut size={15} /> Sign out</button></header><section className="mx-auto max-w-6xl px-6 py-12 lg:px-10"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">{role}</p><h1 className="mt-2 text-4xl font-semibold">Welcome, {profile.full_name}.</h1><p className="mt-4 max-w-xl text-base leading-7 text-black/55">Your DEBOSS workspace is active. You are signed in under the <b className="font-semibold text-black">{department}</b> department.</p><div className="mt-10 grid gap-4 md:grid-cols-3"><div className="rounded-lg bg-[#1a1917] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#f59a18]">Your role</p><p className="mt-3 text-2xl font-semibold">{role}</p><p className="mt-3 text-sm leading-6 text-white/50">Permissions and working tools will appear here as each department module is activated.</p></div><div className="rounded-lg border border-black/8 bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/40">Department</p><p className="mt-3 text-2xl font-semibold">{department}</p><p className="mt-3 text-sm text-black/50">{profile.departments?.business_unit ?? "Operational"} · {profile.departments?.function ?? "Team"}</p></div><div className="rounded-lg border border-black/8 bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/40">Workspace status</p><p className="mt-3 text-2xl font-semibold">Ready</p><p className="mt-3 text-sm leading-6 text-black/50">Your account is active and ready for its department-specific work queue.</p></div></div></section></main>; }
function BrokerageWorkspace({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const supabase = useMemo(() => createClient(), []); const [workspace, setWorkspace] = useState<any>(null); const [loadingData, setLoadingData] = useState(true); const [error, setError] = useState(""); const [creating, setCreating] = useState(false); const [lead, setLead] = useState({ company_name: "", contact_name: "", contact_email: "", contact_phone: "" });
  async function loadWorkspace() { try { setLoadingData(true); const token = (await supabase.auth.getSession()).data.session?.access_token; const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/brokerage/workspace`, { headers: { Authorization: `Bearer ${token}` } }); const payload = await response.json(); if (!response.ok) setError(payload.error ?? "Unable to load your workspace."); else setWorkspace(payload); } catch { setError("Your Brokerage workspace is temporarily unavailable."); } finally { setLoadingData(false); } }
  useEffect(() => { void loadWorkspace(); }, []);
  async function createLead(event: FormEvent) { event.preventDefault(); if (creating) return; setCreating(true); try { const token = (await supabase.auth.getSession()).data.session?.access_token; const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/brokerage/leads`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(lead) }); const payload = await response.json(); if (!response.ok) setError(payload.error ?? "Unable to create lead."); else { setLead({ company_name: "", contact_name: "", contact_email: "", contact_phone: "" }); await loadWorkspace(); } } finally { setCreating(false); } }
  const sales = workspace?.capabilities?.sales;
  if (loadingData) return <WorkspaceSplash />;
  if (error) return <main className="grid min-h-screen place-items-center bg-[#090909] p-6 text-center text-white"><div><AlertCircle className="mx-auto text-[#f59a18]" /><h1 className="mt-4 text-2xl font-semibold">Workspace unavailable</h1><p className="mt-2 text-white/55">{error}</p><button onClick={() => void loadWorkspace()} className="mt-6 rounded-md bg-[#f59a18] px-4 py-2 text-sm font-bold text-black">Try again</button></div></main>;
  const records = sales ? workspace.leads : workspace.shipments;
  return <main className="min-h-screen bg-[#f4f3ef] text-[#171716]"><header className="flex min-h-20 items-center justify-between border-b border-black/8 bg-white px-6 lg:px-12"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#f59a18] text-black"><Building2 size={18} /></span><div><p className="text-sm font-bold tracking-[.18em]">DEBOSS</p><p className="text-[8px] font-bold tracking-[.2em] text-[#a65c00]">GLOBAL OPERATIONS</p></div></div><div className="flex items-center gap-3"><span className="hidden rounded-md bg-black px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white sm:block">{profile.role.replace("_", " ")}</span><button onClick={onSignOut} className="flex h-9 items-center gap-2 rounded-md border border-black/10 px-3 text-xs font-semibold"><LogOut size={15} /> Sign out</button></div></header><section className="mx-auto max-w-7xl px-6 py-10 lg:px-12"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">{workspace.department?.function} · Brokerage</p><div className="mt-2 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-4xl font-semibold">{sales ? "Sales workspace" : "Operations workspace"}</h1><p className="mt-3 text-sm text-black/55">{workspace.departmentManager ? "Department-wide control" : workspace.capabilities.teamLead ? "Team visibility enabled" : "Your assigned work"}</p></div><div className="rounded-lg bg-[#1a1917] px-5 py-3 text-right text-white"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#f59a18]">Signed in as</p><p className="mt-1 text-sm font-semibold">{profile.full_name}</p></div></div><div className="mt-8 grid gap-4 md:grid-cols-3"><Metric icon={ClipboardList} label={sales ? "Visible leads" : "Active shipments"} value={records.length} /><Metric icon={TrendingUp} label={sales ? "Team access" : "Team queue"} value={workspace.capabilities.teamLead ? "Enabled" : "Personal"} /><Metric icon={Truck} label="Department" value={workspace.department?.function ?? "Brokerage"} /></div><div className="mt-8 grid gap-6 xl:grid-cols-[.82fr_1.18fr]">{sales && <form onSubmit={createLead} className="rounded-lg bg-[#1a1917] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#f59a18]">New customer lead</p><h2 className="mt-2 text-xl font-semibold">Add to your pipeline.</h2><fieldset disabled={creating} className="mt-6 space-y-4 disabled:opacity-50"><Field label="Company name" value={lead.company_name} onChange={(company_name) => setLead({ ...lead, company_name })} /><Field label="Contact name" value={lead.contact_name} onChange={(contact_name) => setLead({ ...lead, contact_name })} /><Field label="Contact email" type="email" value={lead.contact_email} onChange={(contact_email) => setLead({ ...lead, contact_email })} /><Field label="Contact phone" value={lead.contact_phone} onChange={(contact_phone) => setLead({ ...lead, contact_phone })} /><Submit busy={creating} label="Create lead" loadingLabel="Creating lead..." /></fieldset></form>}{!sales && <div className="rounded-lg bg-[#1a1917] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#f59a18]">Operations queue</p><h2 className="mt-2 text-xl font-semibold">Execution control.</h2><p className="mt-5 text-sm leading-6 text-white/55">Loads handed off from Brokerage Sales appear here. Your permissions decide whether you can update, assign, verify documents, resolve exceptions, or mark loads invoice-ready.</p></div>}<DataList columns={sales ? ["Customer", "Stage", "Follow-up", "Value"] : ["Reference", "Customer", "Status", "Invoice"]} rows={sales ? records.map((item: any) => [item.company_name, item.stage, item.next_follow_up_at ? new Date(item.next_follow_up_at).toLocaleDateString() : "Not set", item.estimated_monthly_value ? `$${item.estimated_monthly_value}` : "—"]) : records.map((item: any) => [item.reference_number, item.customer_name, item.status, item.invoice_ready ? "READY" : "PENDING"])} empty={sales ? "No leads are available in your current scope." : "No shipment work is available in your current scope."} /></div></section></main>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) { return <div className="rounded-lg border border-black/8 bg-white p-5"><Icon size={18} className="text-[#a65c00]" /><p className="mt-5 text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{label}</p></div>; }
function WorkspaceSplash() { return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090909] text-white"><div className="grid-noise pointer-events-none absolute inset-0 opacity-40" /><div className="pointer-events-none absolute inset-x-0 top-0 h-[65vh] bg-[radial-gradient(ellipse_at_50%_30%,rgba(245,154,24,0.18),transparent_55%)]" /><motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.65, ease: "easeOut" }} className="relative z-10 flex flex-col items-center"><motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} className="relative h-28 w-28 overflow-hidden rounded-xl border border-[#f59a18]/35 bg-black shadow-[0_0_90px_rgba(245,154,24,0.16)]"><Image src="/brand/deboss-mark.png" alt="DEBOSS GLOBAL" fill priority className="object-cover object-center scale-[1.65]" /></motion.div><div className="mt-7 text-center"><p className="text-xl font-bold tracking-[0.26em]">DEBOSS</p><p className="mt-2 text-[10px] font-bold tracking-[0.34em] text-[#f59a18]">GLOBAL OPERATIONS</p></div><div className="mt-12 w-56"><div className="h-px overflow-hidden bg-white/10"><motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} className="h-full w-1/2 bg-[#f59a18]" /></div><p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Preparing secure workspace</p></div></motion.div><p className="absolute bottom-9 text-[9px] font-medium uppercase tracking-[0.16em] text-white/25">Freight intelligence in motion</p></main>; }
