"use client";

import { Check, LoaderCircle, Pencil, Plus, UsersRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const permissionGroups = [
  ["Sales", ["sales.leads.view_team", "sales.leads.edit_team", "sales.leads.assign", "sales.activities.view_team", "sales.activities.assign", "sales.quotes.review", "sales.quotes.handoff"]],
  ["Operations", ["operations.shipments.view_team", "operations.shipments.assign", "operations.shipments.update_team", "operations.documents.review", "operations.exceptions.resolve", "operations.billing.mark_invoice_ready"]],
  ["Reporting", ["sales.reports.view_team", "operations.reports.view_team"]],
] as const;

const blankTeam = { name: "", team_lead_id: "", member_ids: [] as string[], permissions: [] as string[], is_active: true };

export function TeamBuilderPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [directory, setDirectory] = useState<any>();
  const [form, setForm] = useState<any>(blankTeam);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const api = async (path: string, init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  };

  const load = async () => {
    try {
      const response = await api("/api/v1/brokerage/team-directory");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load teams.");
      setDirectory(body);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load teams."); }
  };

  useEffect(() => { void load(); }, []);

  const start = (team?: any) => {
    setMessage("");
    setOpen(true);
    if (!team) { setEditing(null); setForm(blankTeam); return; }
    setEditing(team);
    setForm({ name: team.name, team_lead_id: team.team_lead_id ?? "", member_ids: (team.team_members ?? []).map((member: any) => member.user_id), permissions: (team.team_lead_permissions ?? []).map((permission: any) => permission.permission_key), is_active: team.is_active });
  };

  const close = () => { setOpen(false); setEditing(null); setForm(blankTeam); };
  const toggle = (key: "member_ids" | "permissions", value: string) => setForm((current: any) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item: string) => item !== value) : [...current[key], value] }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.member_ids.length) return setMessage("Select at least one Agent before saving the team.");
    if (form.team_lead_id && !form.member_ids.includes(form.team_lead_id)) return setMessage("The Team Lead must be selected as a team member.");
    setSaving(true);
    try {
      const response = await api(editing ? `/api/v1/brokerage/teams/${editing.id}` : "/api/v1/brokerage/teams", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save this team.");
      close();
      setMessage(editing ? "Team updated." : "Team created.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save this team."); } finally { setSaving(false); }
  };

  if (!directory) return <div className="grid min-h-[360px] place-items-center"><LoaderCircle className="animate-spin text-[#f59a18]"/></div>;

  return <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[.9fr_1.1fr]">
    <section className="rounded-lg bg-[#1a1917] p-6 text-white">
      {open ? <form onSubmit={save}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Brokerage manager controls</p><h2 className="mt-2 text-2xl font-semibold">{editing ? "Edit team" : "Create a team"}</h2></div><button type="button" onClick={close} disabled={saving} title="Close team editor" className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-white/70"><X size={16}/></button></div><label className="mt-6 block text-xs font-bold text-white/60">Team name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Sales Team A" className="mt-2 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"/></label><div className="mt-5"><p className="text-xs font-bold text-white/60">Members and Team Lead</p><p className="mt-1 text-xs leading-5 text-white/40">Select Agents, then select one of those Agents as Team Lead.</p><div className="mt-3 max-h-60 space-y-2 overflow-auto rounded-md border border-white/10 p-2">{directory.users.map((user: any) => <label key={user.id} className="flex items-center gap-2 rounded p-2 text-sm hover:bg-white/5"><input type="checkbox" checked={form.member_ids.includes(user.id)} onChange={() => toggle("member_ids", user.id)}/><span className="min-w-0 flex-1 truncate">{user.full_name}</span><input type="radio" name="team-lead" checked={form.team_lead_id === user.id} disabled={!form.member_ids.includes(user.id)} onChange={() => setForm({ ...form, team_lead_id: user.id })}/><small className="text-white/50">Lead</small></label>)}{!directory.users.length && <p className="p-3 text-sm text-white/45">Create department Agents first.</p>}</div></div><div className="mt-5 space-y-5">{permissionGroups.map(([title, permissions]) => <div key={title}><p className="text-[10px] font-bold uppercase tracking-wide text-[#f59a18]">{title} permissions</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission} className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" disabled={!form.team_lead_id} checked={form.permissions.includes(permission)} onChange={() => toggle("permissions", permission)}/>{permission.replaceAll(".", " · ")}</label>)}</div></div>)}</div>{editing && <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })}/> Team is active</label>}<button disabled={saving || !directory.users.length} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black disabled:opacity-50">{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Check size={15}/>}{saving ? "Saving team..." : editing ? "Save team changes" : "Create team"}</button></form> : <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Brokerage manager controls</p><h2 className="mt-2 text-2xl font-semibold">Build a working team.</h2><p className="mt-4 text-sm leading-6 text-white/55">Teams group departmental Agents. Choose an Agent as Team Lead and grant exactly the Sales, Operations, and reporting controls they need.</p><button onClick={() => start()} className="mt-7 flex h-10 items-center gap-2 rounded-md bg-[#f59a18] px-4 text-sm font-bold text-black"><Plus size={16}/>Create a team</button></div>}
      {message && <p className="mt-5 rounded-md bg-white/10 p-3 text-sm text-white/85">{message}</p>}
    </section>
    <section className="overflow-hidden rounded-lg border border-black/8 bg-white"><div className="flex items-center gap-2 border-b border-black/8 p-5"><UsersRound size={17}/><div><h2 className="font-semibold">Teams</h2><p className="mt-1 text-xs text-black/45">Edit membership, replace a Team Lead, or change delegated permissions.</p></div><button onClick={() => start()} title="Create a team" className="ml-auto grid h-9 w-9 place-items-center rounded-md bg-[#f59a18] text-black"><Plus size={16}/></button></div>{directory.teams.map((team: any) => <article key={team.id} className="border-b border-black/6 p-5 last:border-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{team.name}</p><p className="mt-1 text-sm text-black/50">{team.team_members?.length ?? 0} members · {team.team_lead_permissions?.length ?? 0} delegated rights</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{team.is_active ? "Active" : "Archived"}</p></div><button onClick={() => start(team)} title={`Edit ${team.name}`} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-black/[.03]"><Pencil size={15}/></button></div></article>)}{!directory.teams.length && <div className="p-10 text-center"><UsersRound className="mx-auto text-black/25" size={24}/><p className="mt-3 font-semibold">No teams yet</p><p className="mt-2 text-sm text-black/45">Use the plus button to build the first team for this department.</p></div>}</section>
  </div>;
}
