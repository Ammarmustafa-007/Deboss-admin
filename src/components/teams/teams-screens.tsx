"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Crown, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { use, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Avatar, Card, Chip, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { Stepper } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

type Person = { id: string; full_name: string; email?: string; role?: string; is_active?: boolean };
type Team = { id: string; name: string; team_lead_id?: string | null; is_active: boolean; team_members?: { user_id: string }[]; team_lead_permissions?: { permission_key: string }[] };
type TeamDirectory = { users: Person[]; teams: Team[] };

const permissionGroups = [
  { title: "Sales", items: [["sales.leads.view_team", "View team leads"], ["sales.leads.edit_team", "Edit team leads"], ["sales.leads.assign", "Assign team leads"], ["sales.activities.view_team", "View team activity"], ["sales.activities.assign", "Assign follow-ups"], ["sales.quotes.review", "Review quotes"], ["sales.quotes.handoff", "Approve Operations handoff"]] },
  { title: "Operations", items: [["operations.shipments.view_team", "View team shipments"], ["operations.shipments.assign", "Assign shipments"], ["operations.shipments.update_team", "Update team shipments"], ["operations.documents.review", "Review documents"], ["operations.exceptions.resolve", "Resolve exceptions"], ["operations.billing.mark_invoice_ready", "Mark invoice-ready"]] },
  { title: "Reporting", items: [["sales.reports.view_team", "Sales team reports"], ["operations.reports.view_team", "Operations team reports"]] },
] as const;

function useTeamDirectory() {
  const { api } = useBrokerage();
  return useQuery({ queryKey: ["brokerage", "team-directory"], queryFn: async () => responseData<TeamDirectory>(await api("/api/v1/brokerage/team-directory")), staleTime: 20_000 });
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
  const { report } = useBrokerage();
  const { run, busy } = useBrokerageAction();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: team?.name ?? "",
    team_lead_id: team?.team_lead_id ?? "",
    member_ids: (team?.team_members ?? []).map((member) => member.user_id),
    permissions: (team?.team_lead_permissions ?? []).map((permission) => permission.permission_key),
    is_active: team?.is_active ?? true,
  });
  const saving = busy("save-team");
  const toggle = (key: "member_ids" | "permissions", value: string) => setForm((current) => {
    const list = current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value];
    // Removing the lead from the members also clears the lead choice.
    return key === "member_ids" && !list.includes(current.team_lead_id) ? { ...current, member_ids: list, team_lead_id: "" } : { ...current, [key]: list };
  });

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (step === 0 && !form.member_ids.length) return report("Select at least one Agent before continuing.", "error");
    setStep(step + 1);
  };
  const save = async () => {
    if (!form.member_ids.length) return report("Select at least one Agent before saving the team.", "error");
    if (form.team_lead_id && !form.member_ids.includes(form.team_lead_id)) return report("The Team Lead must be selected as a team member.", "error");
    const result = await run("save-team", team ? `/api/v1/brokerage/teams/${team.id}` : "/api/v1/brokerage/teams", team ? "PATCH" : "POST", form, team ? "Team updated." : "Team created.");
    if (result !== undefined) router.push("/app/teams");
  };

  const members = users.filter((user) => form.member_ids.includes(user.id));
  const lead = users.find((user) => user.id === form.team_lead_id);

  return <div className="mx-auto max-w-3xl space-y-6 animate-rise">
    <PageHeader crumbs={[{ label: "Teams", href: "/app/teams" }, { label: team ? team.name : "New team" }]} title={team ? team.name : "New team"} />
    <Card className="overflow-hidden">
      <div className="border-b border-line-soft bg-[#FBFAF7] px-6 py-5"><Stepper steps={[{ label: "Name & members" }, { label: "Team Lead" }, { label: "Delegated rights" }]} current={step} className="mx-auto max-w-lg" /></div>

      <form onSubmit={step < 2 ? next : (event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving} className="p-6">
          {step === 0 && <div className="space-y-5">
            <TextField label="Team name" required minLength={2} maxLength={80} placeholder="Sales Team A" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <div>
              <p className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-ink/80">Members<span className="text-xs font-normal text-muted">{form.member_ids.length} selected</span></p>
              {users.length ? <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto rounded-control border border-line">{users.map((user) => {
                const checked = form.member_ids.includes(user.id);
                return <li key={user.id}><label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[#FAF8F4]", checked && "bg-brand-tint/60")}>
                  <input type="checkbox" checked={checked} onChange={() => toggle("member_ids", user.id)} className="h-4 w-4" />
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
              <LeadOption label="No Team Lead" checked={!form.team_lead_id} onChange={() => setForm({ ...form, team_lead_id: "", permissions: [] })} />
              {members.map((user) => <LeadOption key={user.id} label={user.full_name} hint={user.email} checked={form.team_lead_id === user.id} onChange={() => setForm({ ...form, team_lead_id: user.id })} />)}
            </ul>
          </div>}

          {step === 2 && (lead ? <div className="space-y-6">
            <p className="flex items-center gap-2 text-sm"><Crown size={15} className="text-brand" /><b>{lead.full_name}</b><span className="text-muted">will be able to:</span></p>
            {permissionGroups.map((group) => <div key={group.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{group.title}</p>
              <div className="grid gap-2 sm:grid-cols-2">{group.items.map(([key, label]) => {
                const checked = form.permissions.includes(key);
                return <label key={key} className={cn("flex cursor-pointer items-center gap-3 rounded-control border px-3.5 py-3 text-sm transition-colors", checked ? "border-brand bg-brand-tint/60" : "border-line hover:border-[#CFC8BA]")}>
                  <input type="checkbox" checked={checked} onChange={() => toggle("permissions", key)} className="h-4 w-4" />{label}
                </label>;
              })}</div>
            </div>)}
          </div> : <EmptyState icon={ShieldCheck} title="No Team Lead selected" body="Delegated rights apply only to a Team Lead. Members keep their standard agent access." />)}

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
