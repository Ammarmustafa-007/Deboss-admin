"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Crown, ImagePlus, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { use, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Avatar, Card, Chip, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { Stepper } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { uploadGroupPhoto } from "@/components/chat/chat-screen";
import { useTeamDirectory, type DirectoryPerson, type DirectoryTeam } from "@/components/sales/directory";

type Person = DirectoryPerson;
type Team = DirectoryTeam;

type Access = "partial" | "full";

/** Team Lead access presets, mapped onto the existing permission keys for each department function. */
const accessPresets: Record<"sales" | "operations" | "dispatchSales" | "dispatchOps" | "fronter", Record<Access, { label: string; summary: string[]; keys: string[] }>> = {
  sales: {
    partial: { label: "Partial access", summary: ["View the team's leads, customers and activity", "Edit the team's leads", "Team reports"], keys: ["sales.leads.view_team", "sales.leads.edit_team", "sales.activities.view_team", "sales.reports.view_team"] },
    full: { label: "Full managerial access", summary: ["Everything a manager can do, for this team", "Assign and reassign the team's leads", "Approve or return quotes for rework", "Hand approved quotes off to Operations"], keys: ["sales.leads.view_team", "sales.leads.edit_team", "sales.activities.view_team", "sales.reports.view_team", "sales.leads.assign", "sales.activities.assign", "sales.quotes.review", "sales.quotes.handoff"] },
  },
  operations: {
    partial: { label: "Partial access", summary: ["View the team's shipments", "Update the team's shipments", "Team reports"], keys: ["operations.shipments.view_team", "operations.shipments.update_team", "operations.reports.view_team"] },
    full: { label: "Full managerial access", summary: ["Everything a manager can do, for this team", "Assign and reassign the team's shipments", "Verify or return documents", "Resolve exceptions and set their owner", "Invoices: generate, mark ready, update status"], keys: ["operations.shipments.view_team", "operations.shipments.update_team", "operations.reports.view_team", "operations.shipments.assign", "operations.documents.review", "operations.exceptions.resolve", "operations.billing.mark_invoice_ready"] },
  },
  fronter: {
    partial: { label: "Partial access", summary: ["View the team's mined prospects", "Edit the team's prospects", "Team reports"], keys: ["fronter.prospects.view_team", "fronter.prospects.edit_team", "fronter.reports.view_team"] },
    full: { label: "Full managerial access", summary: ["Everything a manager can do, for this team", "Qualify the team's prospects and assign them to Sales"], keys: ["fronter.prospects.view_team", "fronter.prospects.edit_team", "fronter.reports.view_team", "fronter.prospects.qualify"] },
  },
  dispatchSales: {
    partial: { label: "Partial access", summary: ["View the team's carriers, documents and activity", "Edit the team's carriers", "Team reports"], keys: ["dispatch_sales.carriers.view_team", "dispatch_sales.carriers.edit_team", "dispatch_sales.reports.view_team"] },
    full: { label: "Full managerial access", summary: ["Everything a manager can do, for this team", "Assign and reassign the team's carriers", "Approve, return or discard carriers", "Sign off paid invoices"], keys: ["dispatch_sales.carriers.view_team", "dispatch_sales.carriers.edit_team", "dispatch_sales.reports.view_team", "dispatch_sales.carriers.assign", "dispatch_sales.carriers.review", "dispatch_sales.invoices.signoff"] },
  },
  dispatchOps: {
    partial: { label: "Partial access", summary: ["View the team's trucks and loads", "Update the team's trucks and loads", "Team reports"], keys: ["dispatch.trucks.view_team", "dispatch.trucks.update_team", "dispatch.reports.view_team"] },
    full: { label: "Full managerial access", summary: ["Everything a manager can do, for this team", "Assign and reassign the team's trucks", "Review and forward weekly invoices"], keys: ["dispatch.trucks.view_team", "dispatch.trucks.update_team", "dispatch.reports.view_team", "dispatch.trucks.assign", "dispatch.invoices.review"] },
  },
};

const groupOf = (team?: Team) => { const value = team?.chat_conversations; return (Array.isArray(value) ? value[0] : value) ?? null; };
const presetKey = (dispatch: boolean, sales: boolean, fronter = false) => fronter ? "fronter" : dispatch ? (sales ? "dispatchSales" : "dispatchOps") : sales ? "sales" : "operations";

/** Existing teams may carry any mix of keys; anything with an approval-level key counts as full access. */
function accessFrom(keys: string[]): Access {
  return keys.some((key) => ["sales.quotes.review", "sales.quotes.handoff", "operations.exceptions.resolve", "operations.billing.mark_invoice_ready", "operations.documents.review", "dispatch_sales.carriers.review", "dispatch_sales.invoices.signoff", "dispatch.trucks.assign", "dispatch.invoices.review", "fronter.prospects.qualify"].includes(key)) ? "full" : "partial";
}

export function TeamsScreen() {
  const directory = useTeamDirectory();
  const users = directory.data?.users ?? [];
  const teams = directory.data?.teams ?? [];
  const nameOf = (id?: string | null) => users.find((user) => user.id === id)?.full_name;

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Teams" subtitle="Group agents and delegate extra rights to a Team Lead" actions={<LinkButton href="/app/teams/new" variant="primary" icon={<Plus size={16} />}>New team</LinkButton>} />
    {directory.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-card" />)}</div>
      : directory.isError ? <Card><EmptyState title="Teams unavailable" body={errorMessage(directory.error, "Unable to load teams.")} /></Card>
      : teams.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const members = (team.team_members ?? []).map((member) => member.user_id);
          const rights = team.team_lead_permissions?.length ?? 0;
          return <Link key={team.id} href={`/app/teams/${team.id}`} className={cn("group flex flex-col rounded-card border border-line bg-white p-5 transition-shadow hover:shadow-[0_10px_30px_-14px_rgba(17,17,17,.25)]", !team.is_active && "opacity-70")}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-control bg-accent/12 text-accent"><UsersRound size={18} /></span>
              <Chip tone={team.is_active ? "success" : "neutral"}>{team.is_active ? "Active" : "Archived"}</Chip>
            </div>
            <p className="mt-4 text-[15px] font-semibold">{team.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Crown size={14} className="text-brand" />{nameOf(team.team_lead_id) ?? "No Team Lead"}</p>
            <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3">
              <div className="flex -space-x-2">{members.slice(0, 5).map((id) => <Avatar key={id} name={nameOf(id)} className="h-7 w-7 border-2 border-white text-[10px]" />)}{members.length > 5 && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-canvas text-[10px] font-semibold">+{members.length - 5}</span>}</div>
              <span className="flex items-center gap-1 text-xs text-muted">{members.length} member{members.length === 1 ? "" : "s"} · {rights} right{rights === 1 ? "" : "s"}<ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
            </div>
          </Link>;
        })}
      </div>
      : <Card><EmptyState icon={UsersRound} title="No teams yet" body={users.length ? "Build the first team for this department." : "Create department agents from Super Admin first."} action={users.length > 0 && <LinkButton href="/app/teams/new" variant="primary" icon={<Plus size={16} />}>New team</LinkButton>} /></Card>}
  </div>;
}

export function TeamRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TeamWizard teamId={id} />;
}

/** Three steps: name & members → Team Lead → delegated rights. Saves the same payload as before. */
export function TeamWizard({ teamId }: { teamId?: string }) {
  const directory = useTeamDirectory();
  if (directory.isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 rounded-card" /></div>;
  if (directory.isError || !directory.data) return <EmptyState title="Teams unavailable" body={errorMessage(directory.error, "Unable to load teams.")} action={<LinkButton href="/app/teams" variant="ink">Back to teams</LinkButton>} className="mt-10" />;
  const team = teamId ? directory.data.teams.find((item) => item.id === teamId) : undefined;
  if (teamId && !team) return <EmptyState title="Team not found" action={<LinkButton href="/app/teams" variant="ink">Back to teams</LinkButton>} className="mt-10" />;
  return <TeamForm key={teamId ?? "new"} team={team} users={directory.data.users} />;
}

function TeamForm({ team, users }: { team?: Team; users: Person[] }) {
  const router = useRouter();
  const { report, sales, dispatch, fronter } = useBrokerage();
  const presets = accessPresets[presetKey(dispatch, sales, fronter)];
  const { run, busy } = useBrokerageAction();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: team?.name ?? "",
    team_lead_id: team?.team_lead_id ?? "",
    member_ids: (team?.team_members ?? []).map((member) => member.user_id),
    access: accessFrom((team?.team_lead_permissions ?? []).map((permission) => permission.permission_key)),
    is_active: team?.is_active ?? true,
    // The team's chat group: its members always follow the team.
    group_name: groupOf(team)?.name ?? "",
    group_photo_url: groupOf(team)?.photo_url ?? null as string | null,
  });
  const [photoBusy, setPhotoBusy] = useState(false);
  const { api } = useBrokerage();
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return report("Use a JPG, PNG or WebP image.", "error");
    if (file.size > 2 * 1024 * 1024) return report("The photo must be 2 MB or smaller.", "error");
    setPhotoBusy(true);
    try { const url = await uploadGroupPhoto(api, file); setForm((current) => ({ ...current, group_photo_url: url })); }
    catch (error) { report(errorMessage(error), "error"); } finally { setPhotoBusy(false); }
  };
  const saving = busy("save-team");
  const toggleMember = (id: string) => setForm((current) => {
    const member_ids = current.member_ids.includes(id) ? current.member_ids.filter((item) => item !== id) : [...current.member_ids, id];
    // Removing the lead from the members also clears the lead choice.
    return { ...current, member_ids, team_lead_id: member_ids.includes(current.team_lead_id) ? current.team_lead_id : "" };
  });

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (step === 0 && !form.member_ids.length) return report("Select at least one Agent before continuing.", "error");
    setStep(step + 1);
  };
  const save = async () => {
    if (!form.member_ids.length) return report("Select at least one Agent before saving the team.", "error");
    if (form.team_lead_id && !form.member_ids.includes(form.team_lead_id)) return report("The Team Lead must be selected as a team member.", "error");
    const { access, ...rest } = form;
    const payload = { ...rest, permissions: form.team_lead_id ? presets[access].keys : [] };
    const result = await run("save-team", team ? `/api/v1/brokerage/teams/${team.id}` : "/api/v1/brokerage/teams", team ? "PATCH" : "POST", payload, team ? "Team updated." : "Team created.");
    if (result !== undefined) router.push("/app/teams");
  };

  const members = users.filter((user) => form.member_ids.includes(user.id));
  const lead = users.find((user) => user.id === form.team_lead_id);

  return <div className="mx-auto max-w-3xl space-y-6 animate-rise">
    <PageHeader crumbs={[{ label: "Teams", href: "/app/teams" }, { label: team ? team.name : "New team" }]} title={team ? team.name : "New team"} />
    <Card className="overflow-hidden">
      <div className="border-b border-line-soft bg-[#FBFAF7] px-6 py-5"><Stepper steps={[{ label: "Name & members" }, { label: "Team Lead" }, { label: "Lead access" }]} current={step} className="mx-auto max-w-lg" /></div>

      <form onSubmit={step < 2 ? next : (event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving} className="p-6">
          {step === 0 && <div className="space-y-5">
            <TextField label="Team name" required minLength={2} maxLength={80} placeholder="Sales Team A" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <div className="grid gap-4 rounded-[14px] border border-line-soft bg-[#FBFAF7] p-4 sm:grid-cols-[auto_1fr] sm:items-end">
              <label className={cn("group relative grid h-16 w-16 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line bg-white text-muted hover:border-brand", photoBusy && "pointer-events-none opacity-60")} title="Group photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {form.group_photo_url ? <img src={form.group_photo_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={20} />}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void pickPhoto(event.target.files?.[0])} />
              </label>
              <TextField label="Chat group name" maxLength={80} placeholder={form.name || "Same as the team name"} hint={photoBusy ? "Uploading photo…" : "The team chats here. Tap the circle to add a group photo (JPG, PNG or WebP, up to 2 MB)."} value={form.group_name} onChange={(event) => setForm({ ...form, group_name: event.target.value })} />
            </div>
            <div>
              <p className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-ink/80">Members<span className="text-xs font-normal text-muted">{form.member_ids.length} selected</span></p>
              {users.length ? <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto rounded-control border border-line">{users.map((user) => {
                const checked = form.member_ids.includes(user.id);
                return <li key={user.id}><label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[#FAF8F4]", checked && "bg-brand-tint/60")}>
                  <input type="checkbox" checked={checked} onChange={() => toggleMember(user.id)} className="h-4 w-4" />
                  <Avatar name={user.full_name} className="h-8 w-8 text-[11px]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.full_name}</span><span className="block truncate text-xs text-muted">{user.email}</span></span>
                  {user.role && <Chip>{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</Chip>}
                </label></li>;
              })}</ul> : <p className="rounded-control border border-dashed border-line p-6 text-center text-sm text-muted">Create department Agents first.</p>}
            </div>
          </div>}

          {step === 1 && <div>
            <p className="mb-3 text-sm text-muted">Optional. The Team Lead receives the rights you choose in the next step.</p>
            <ul className="space-y-2">
              <LeadOption label="No Team Lead" checked={!form.team_lead_id} onChange={() => setForm({ ...form, team_lead_id: "" })} />
              {members.map((user) => <LeadOption key={user.id} label={user.full_name} hint={user.email} checked={form.team_lead_id === user.id} onChange={() => setForm({ ...form, team_lead_id: user.id })} />)}
            </ul>
          </div>}

          {step === 2 && (lead ? <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm"><Crown size={15} className="text-brand" /><b>{lead.full_name}</b><span className="text-muted">gets:</span></p>
            <div className="grid gap-3 sm:grid-cols-2">{(["partial", "full"] as const).map((mode) => {
              const preset = presets[mode];
              const checked = form.access === mode;
              return <label key={mode} className={cn("flex cursor-pointer flex-col gap-3 rounded-[14px] border p-4 transition-colors", checked ? "border-brand bg-brand-tint/60 shadow-[0_0_0_3px_rgba(247,148,29,.15)]" : "border-line hover:border-[#CFC8BA]")}>
                <span className="flex items-center gap-2.5"><input type="radio" name="team-access" checked={checked} onChange={() => setForm({ ...form, access: mode })} className="h-4 w-4" /><span className="font-semibold">{preset.label}</span></span>
                <ul className="space-y-1.5 pl-6 text-[13px] text-ink/75">{preset.summary.map((line) => <li key={line} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-success" />{line}</li>)}</ul>
              </label>;
            })}</div>
          </div> : <EmptyState icon={ShieldCheck} title="No Team Lead selected" body="Members keep their standard agent access." />)}

          {step === 2 && team && <label className="mt-6 flex w-fit cursor-pointer items-center gap-3 rounded-control border border-line px-4 py-3 text-sm font-medium">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-4 w-4" />Team is active
          </label>}
        </fieldset>

        <div className="flex justify-between gap-3 border-t border-line-soft px-6 py-4">
          {step === 0 ? <LinkButton href="/app/teams" variant="ghost">Cancel</LinkButton> : <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}><ArrowLeft size={16} />Back</Button>}
          {step < 2 ? <Button type="submit" variant="ink" disabled={!users.length}>Continue<ArrowRight size={16} /></Button>
            : <Button type="submit" variant="primary" icon={<Check size={16} />} pending={saving} pendingLabel="Saving team…">{team ? "Save team" : "Create team"}</Button>}
        </div>
      </form>
    </Card>
  </div>;
}

function LeadOption({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return <li><label className={cn("flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition-colors", checked ? "border-brand bg-brand-tint/60" : "border-line hover:border-[#CFC8BA]")}>
    <input type="radio" name="team-lead" checked={checked} onChange={onChange} className="h-4 w-4" />
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span>{hint && <span className="block truncate text-xs text-muted">{hint}</span>}</span>
    {checked && label !== "No Team Lead" && <Crown size={16} className="text-brand" />}
  </label></li>;
}
