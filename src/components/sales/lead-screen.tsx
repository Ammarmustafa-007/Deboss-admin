"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Crown, CalendarClock, FileSearch, Mail, Phone, Plus, UserRound, UserRoundPlus } from "lucide-react";
import { use, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { responseData } from "@/lib/api";
import { dateTimeLabel, localInput, money } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton, StatusChip } from "@/components/ui/surface";
import { Stepper, Tabs } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { SelectField, TextField, controlClass } from "@/components/ui/field";
import { ActivityFeed, CommentFeed, Composer } from "@/components/sales/feed";
import { CustomerPanel } from "@/components/sales/customer-panel";
import { QuoteList } from "@/components/sales/quote-panel";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { useTeamDirectory, type DirectoryPerson, type DirectoryTeam } from "@/components/sales/directory";
import { activityTypes, editableStages, journeyPosition, journeySteps, nextAction, stageLabel, type FeedItem, type Lead, type LeadDetailData } from "@/components/sales/model";

type TabKey = "quotes" | "details" | "activity" | "comments" | "customer";

export function LeadRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LeadScreen leadId={id} />;
}

export function LeadScreen({ leadId }: { leadId: string }) {
  const { api, manager, teamLead } = useBrokerage();
  const detail = useQuery({ queryKey: ["brokerage", "lead", leadId], queryFn: async () => responseData<LeadDetailData>(await api(`/api/v1/brokerage/leads/${leadId}/detail`)), staleTime: 15_000 });

  if (detail.isLoading) return <LeadSkeleton />;
  if (detail.isError || !detail.data) return <EmptyState icon={FileSearch} title="Lead unavailable" body={detail.error instanceof Error ? detail.error.message : "This lead could not be loaded."} action={<LinkButton href="/app/sales" variant="ink">Back to pipeline</LinkButton>} className="mt-10" />;
  return <LeadView key={leadId} data={detail.data} manager={manager} teamLead={teamLead} />;
}

function LeadView({ data, manager, teamLead }: { data: LeadDetailData; manager: boolean; teamLead: boolean }) {
  const { lead, quotes, activities, comments, customer } = data;
  const { workspace } = useBrokerage();
  const caps = workspace.capabilities ?? {};
  // Department managers, and Team Leads with full managerial access, review and hand off quotes.
  const reviewer = manager || Boolean(caps.canReviewQuotes || caps.canHandoffQuotes);
  const action = nextAction(quotes, reviewer);
  const reviewWaiting = quotes.some((quote) => quote.stage === "SUBMITTED" || quote.stage === "APPROVED");
  const [tab, setTab] = useState<TabKey>(reviewer && reviewWaiting ? "quotes" : "details");
  const directory = useTeamDirectory(manager || teamLead);
  const ownerName = directory.data?.users.find((user) => user.id === lead.owner_id)?.full_name;
  const { run, busy } = useBrokerageAction();
  const leadPath = `/api/v1/brokerage/leads/${lead.id}`;
  const openActivities = activities.filter((item) => item.activity_type && !item.completed_at).length;

  const toggleArchive = () => run(`archive:${lead.id}`, leadPath, "PATCH", { archived_at: lead.archived_at ? null : new Date().toISOString() }, lead.archived_at ? "Lead restored." : "Lead archived.");

  return <div className="space-y-6 animate-rise">
    <PageHeader
      crumbs={[{ label: "Sales", href: "/app/sales" }, { label: lead.company_name }]}
      title={<span className="flex flex-wrap items-center gap-3">{lead.company_name}<StatusChip status={lead.stage} label={stageLabel[lead.stage] ?? undefined} className="text-[13px]" />{lead.archived_at && <Chip>Archived</Chip>}</span>}
      subtitle={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5"><UserRound size={14} />{lead.contact_name || "No contact"}</span>
        {(manager || teamLead) && <span className="inline-flex items-center gap-1.5"><Crown size={14} className="text-brand" />Owner: {ownerName ?? "—"}</span>}
        {lead.contact_email && <a href={`mailto:${lead.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-ink"><Mail size={14} />{lead.contact_email}</a>}
        {lead.contact_phone && <a href={`tel:${lead.contact_phone}`} className="inline-flex items-center gap-1.5 hover:text-ink"><Phone size={14} />{lead.contact_phone}</a>}
      </span>}
      actions={<>
        {action.key !== "none" && <Chip tone={action.tone} className="h-8 px-3 text-[13px]">{action.label}</Chip>}
        {!customer && !quotes.length && lead.stage !== "CUSTOMER" && <StageControl lead={lead} />}
        <Button variant="outline" icon={lead.archived_at ? <ArchiveRestore size={15} /> : <Archive size={15} />} pending={busy(`archive:${lead.id}`)} onClick={() => void toggleArchive()}>{lead.archived_at ? "Restore" : "Archive"}</Button>
      </>}
    />

    <Journey converted={Boolean(customer) || lead.stage === "CUSTOMER"} quotes={quotes} />

    <Tabs<TabKey> value={tab} onChange={setTab} items={manager ? [
      { value: "quotes", label: "Quotes & approval", count: quotes.length },
      { value: "details", label: "Lead details" },
      { value: "activity", label: "Activity", count: activities.length },
      { value: "comments", label: "Comments", count: comments.length },
    ] : [
      ...(reviewer ? [{ value: "quotes" as const, label: "Quotes & approval", count: quotes.length }] : []),
      { value: "details", label: "Lead details" },
      { value: "activity", label: "Activity", count: openActivities || undefined },
      { value: "comments", label: "Comments", count: comments.length || undefined },
      { value: "customer", label: customer ? "Customer & shipments" : "Customer" },
    ]} />

    <div key={tab} className="animate-fade">
      {tab === "quotes" && <QuoteList quotes={quotes} lead={lead} customerId={customer?.id} />}
      {tab === "details" && (manager ? <div className="space-y-6"><Assignment lead={lead} directory={directory.data} /><LeadFacts lead={lead} /></div> : caps.canAssignLeads ? <div className="space-y-6"><Assignment lead={lead} directory={directory.data} /><LeadForm lead={lead} /></div> : <LeadForm lead={lead} />)}
      {tab === "activity" && <ActivityTab lead={lead} activities={activities} manager={manager} />}
      {tab === "comments" && <CommentsTab leadId={lead.id} comments={comments} manager={manager} />}
      {tab === "customer" && <CustomerTab lead={lead} customerId={customer?.id ?? null} />}
    </div>
  </div>;
}

function Journey({ converted, quotes }: { converted: boolean; quotes: LeadDetailData["quotes"] }) {
  const { current, blocked } = journeyPosition(converted, quotes);
  const rejected = quotes.find((quote) => quote.stage === "REJECTED");
  return <Card className="px-4 py-5 sm:px-6">
    <div className="overflow-x-auto"><Stepper steps={journeySteps.map((label, index) => ({ label, hint: blocked && index === current ? "Returned for rework" : undefined }))} current={current} tone={blocked ? "danger" : "brand"} className="min-w-[620px]" /></div>
    {blocked && rejected?.rejection_note && <p className="mt-4 rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm text-[#A5183F]"><b>Manager note:</b> {rejected.rejection_note}</p>}
  </Card>;
}

function Assignment({ lead, directory }: { lead: Lead; directory?: { users: DirectoryPerson[]; teams: DirectoryTeam[] } }) {
  const { run, busy } = useBrokerageAction();
  const pending = busy(`assign:${lead.id}`);
  const assign = (patch: { owner_id?: string; team_id?: string | null }, success: string) => void run(`assign:${lead.id}`, `/api/v1/brokerage/leads/${lead.id}`, "PATCH", patch, success);
  const agents = (directory?.users ?? []).filter((user) => user.role === "AGENT" && user.is_active !== false);
  const teams = (directory?.teams ?? []).filter((team) => team.is_active);
  return <Card>
    <CardHeader title="Assignment" subtitle="Who owns this lead and which team it belongs to" />
    <div className="grid gap-4 p-5 sm:grid-cols-2">
      <SelectField label="Owner" required value={lead.owner_id ?? ""} disabled={pending || !directory} onChange={(event) => event.target.value && assign({ owner_id: event.target.value }, "Lead owner updated.")} options={agents.map((user) => ({ value: user.id, label: user.full_name }))} />
      <SelectField label="Team" required value={lead.team_id ?? ""} placeholder="No team" disabled={pending || !directory} onChange={(event) => assign({ team_id: event.target.value || null }, "Lead team updated.")} options={teams.map((team) => ({ value: team.id, label: team.name + (team.team_lead_id ? ` · Lead: ${directory?.users.find((user) => user.id === team.team_lead_id)?.full_name ?? "—"}` : "") }))} />
    </div>
  </Card>;
}

function StageControl({ lead }: { lead: Lead }) {
  const { run, busy } = useBrokerageAction();
  const [stage, setStage] = useState(lead.stage);
  const pending = busy(`stage:${lead.id}`);
  return <div className="flex items-center gap-2">
    <label className="sr-only" htmlFor="lead-stage">Pipeline stage</label>
    <select id="lead-stage" value={stage} disabled={pending} onChange={(event) => setStage(event.target.value)} className={cn(controlClass, "h-10 w-auto min-w-36 text-[13px]")}>
      {editableStages.map((item) => <option key={item} value={item}>{stageLabel[item]}</option>)}
    </select>
    {stage !== lead.stage && <Button variant="ink" pending={pending} onClick={() => void run(`stage:${lead.id}`, `/api/v1/brokerage/leads/${lead.id}`, "PATCH", { stage }, `Pipeline moved to ${stageLabel[stage] ?? stage}.`)}>Move</Button>}
  </div>;
}

function leadFormState(lead: Lead) {
  return {
    company_name: lead.company_name ?? "",
    contact_name: lead.contact_name ?? "",
    contact_email: lead.contact_email ?? "",
    contact_phone: lead.contact_phone ?? "",
    source: lead.source ?? "",
    estimated_monthly_value: lead.estimated_monthly_value == null ? "" : String(lead.estimated_monthly_value),
    next_follow_up_at: localInput(lead.next_follow_up_at),
  };
}

function LeadForm({ lead }: { lead: Lead }) {
  const { run, busy } = useBrokerageAction();
  const initial = leadFormState(lead);
  const [form, setForm] = useState(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => form[key] !== initial[key]);
  const pending = busy(`lead:${lead.id}`);
  const set = (field: keyof typeof initial) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(`lead:${lead.id}`, `/api/v1/brokerage/leads/${lead.id}`, "PATCH", {
      company_name: form.company_name,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      source: form.source,
      estimated_monthly_value: form.estimated_monthly_value === "" ? null : Number(form.estimated_monthly_value),
      next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null,
    }, "Lead information updated.");
  };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <Card>
      <CardHeader title="Lead information" />
      <form onSubmit={save} className="p-5">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Company" required minLength={2} value={form.company_name} onChange={(event) => set("company_name")(event.target.value)} />
          <TextField label="Contact" value={form.contact_name} onChange={(event) => set("contact_name")(event.target.value)} />
          <TextField label="Email" type="email" value={form.contact_email} onChange={(event) => set("contact_email")(event.target.value)} />
          <TextField label="Phone" value={form.contact_phone} onChange={(event) => set("contact_phone")(event.target.value)} />
          <TextField label="Source" value={form.source} onChange={(event) => set("source")(event.target.value)} />
          <TextField label="Forecast (monthly)" type="number" min="0" value={form.estimated_monthly_value} onChange={(event) => set("estimated_monthly_value")(event.target.value)} />
          <TextField label="Next follow-up" type="datetime-local" value={form.next_follow_up_at} onChange={(event) => set("next_follow_up_at")(event.target.value)} wrapperClassName="sm:col-span-2" />
        </fieldset>
        <div className="mt-6 flex items-center justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm(initial)} disabled={pending}>Discard</Button>}
          <Button type="submit" variant="ink" pending={pending} pendingLabel="Saving…" disabled={!dirty}>Save changes</Button>
        </div>
      </form>
    </Card>
    <LeadSummary lead={lead} />
  </div>;
}

function LeadSummary({ lead }: { lead: Lead }) {
  return <Card className="h-fit p-5">
    <dl className="space-y-4 text-sm">
      <Fact label="Forecast" value={money(lead.estimated_monthly_value)} />
      <Fact label="Next follow-up" value={lead.next_follow_up_at ? dateTimeLabel(lead.next_follow_up_at) : "Not scheduled"} icon={<CalendarClock size={14} />} />
      <Fact label="Source" value={lead.source || "—"} />
    </dl>
    {lead.notes && <div className="mt-5 border-t border-line-soft pt-4"><p className="text-xs font-medium text-muted">Notes</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{lead.notes}</p></div>}
  </Card>;
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 flex items-center gap-1.5 font-semibold">{icon}{value}</dd></div>;
}

function LeadFacts({ lead }: { lead: Lead }) {
  const facts: [string, string][] = [["Company", lead.company_name], ["Contact", lead.contact_name || "—"], ["Email", lead.contact_email || "—"], ["Phone", lead.contact_phone || "—"], ["Source", lead.source || "—"], ["Forecast", money(lead.estimated_monthly_value)], ["Next follow-up", lead.next_follow_up_at ? dateTimeLabel(lead.next_follow_up_at) : "Not scheduled"], ["Pipeline stage", stageLabel[lead.stage] ?? lead.stage]];
  return <Card>
    <CardHeader title="Lead record" />
    <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 xl:grid-cols-4">{facts.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 truncate text-sm font-semibold">{value}</dd></div>)}</dl>
    {lead.notes && <div className="border-t border-line-soft p-5"><p className="text-xs font-medium text-muted">Notes</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{lead.notes}</p></div>}
  </Card>;
}

function ActivityTab({ lead, activities, manager }: { lead: Lead; activities: FeedItem[]; manager: boolean }) {
  const { run, busy } = useBrokerageAction();
  const [form, setForm] = useState({ activity_type: "CALL", body: "", due_at: "" });
  const adding = busy(`add-activity:${lead.id}`);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run(`add-activity:${lead.id}`, `/api/v1/brokerage/leads/${lead.id}/activities`, "POST", { ...form, due_at: form.due_at ? new Date(form.due_at).toISOString() : null }, "Activity added.");
    if (saved !== undefined) setForm({ activity_type: "CALL", body: "", due_at: "" });
  };
  return <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
    {!manager && <Card className="h-fit">
      <CardHeader title="Log activity" />
      <form onSubmit={add} className="space-y-4 p-5">
        <fieldset disabled={adding} className="space-y-4">
          <SelectField label="Type" required value={form.activity_type} onChange={(event) => setForm({ ...form, activity_type: event.target.value })} options={activityTypes.map((type) => ({ value: type, label: type.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }))} />
          <TextField label="What happened or what's next" required maxLength={3000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          <TextField label="Due" type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
        </fieldset>
        <Button type="submit" variant="ink" pending={adding} pendingLabel="Adding…" icon={<Plus size={15} />} className="w-full">Add activity</Button>
      </form>
    </Card>}
    <Card className={cn(manager && "xl:col-span-2")}>
      <CardHeader title="Timeline" subtitle={`${activities.length} recorded`} />
      <div className="p-5"><ActivityFeed rows={activities} empty="No activities recorded yet." busy={busy}
        onToggle={manager ? undefined : (row) => void run(`activity:${row.id}`, `/api/v1/brokerage/activities/${row.id}`, "PATCH", { completed: !row.completed_at }, row.completed_at ? "Activity reopened." : "Activity marked completed.")}
        onDelete={manager ? undefined : (row) => void run(`delete-activity:${row.id}`, `/api/v1/brokerage/activities/${row.id}`, "DELETE", undefined, "Activity deleted.")} /></div>
    </Card>
  </div>;
}

function CommentsTab({ leadId, comments, manager }: { leadId: string; comments: FeedItem[]; manager: boolean }) {
  const { run, busy } = useBrokerageAction();
  return <Card className="max-w-3xl">
    <CardHeader title={manager ? "Manager comments" : "Internal comments"} />
    <div className="space-y-6 p-5">
      <Composer placeholder={manager ? "Add direction for the Sales Agent" : "Add a comment"} pending={busy(`comment:${leadId}`)} onSubmit={async (body) => (await run(`comment:${leadId}`, `/api/v1/brokerage/leads/${leadId}/comments`, "POST", { body }, manager ? "Manager comment added." : "Comment added.")) !== undefined} />
      <CommentFeed rows={comments} empty="No comments yet." busy={busy} onDelete={(row) => void run(`delete-comment:${row.id}`, `/api/v1/brokerage/comments/${row.id}`, "DELETE", undefined, "Comment deleted.")} />
    </div>
  </Card>;
}

function CustomerTab({ lead, customerId }: { lead: Lead; customerId: string | null }) {
  const { run, busy } = useBrokerageAction();
  const convert = () => run(`convert:${lead.id}`, `/api/v1/brokerage/leads/${lead.id}/convert`, "POST", undefined, customerId ? "Customer contact details synced from the lead." : "Customer workspace created.");
  if (!customerId) return <Card><EmptyState icon={UserRoundPlus} title="Not a customer yet" body="Convert this lead to open its customer record and start adding shipments." action={<Button variant="primary" pending={busy(`convert:${lead.id}`)} pendingLabel="Creating customer…" onClick={() => void convert()}>Convert to customer</Button>} /></Card>;
  return <CustomerPanel customerId={customerId} onSyncFromLead={{ run: () => void convert(), pending: busy(`convert:${lead.id}`) }} />;
}

function LeadSkeleton() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading lead">
    <div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-96 max-w-full" /></div>
    <Skeleton className="h-24 rounded-card" />
    <Skeleton className="h-10 w-96 max-w-full" />
    <Skeleton className="h-80 rounded-card" />
  </div>;
}
