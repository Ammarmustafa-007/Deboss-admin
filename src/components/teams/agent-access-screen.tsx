"use client";

import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, Search, ShieldCheck, Unlock, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Avatar, Card, Chip, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { PasswordInput, TextField, controlClass } from "@/components/ui/field";

type DepartmentUser = { id: string; full_name: string; email: string; role: string; is_active: boolean };
type Filter = "all" | "active" | "revoked";

export function AgentAccessScreen() {
  const { api } = useBrokerage();
  const { run, busy } = useBrokerageAction();
  const data = useQuery({ queryKey: ["brokerage", "department-users"], queryFn: async () => responseData<{ users: DepartmentUser[] }>(await api("/api/v1/brokerage/department-users")), staleTime: 20_000 });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<DepartmentUser | null>(null);
  const [adding, setAdding] = useState(false);

  const agents = (data.data?.users ?? []).filter((user) => user.role === "AGENT");
  const term = search.trim().toLowerCase();
  const visible = agents.filter((user) => (filter === "all" || (filter === "active") === user.is_active) && (!term || `${user.full_name} ${user.email}`.toLowerCase().includes(term)));

  const setActive = async (user: DepartmentUser, is_active: boolean) => {
    const result = await run(`access:${user.id}`, `/api/v1/brokerage/department-users/${user.id}`, "PATCH", { is_active }, is_active ? "Agent login restored." : "Agent login revoked.");
    if (result !== undefined) setConfirming(null);
  };

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Agent access" subtitle="Every active agent gets the standard workflow for this department" actions={<Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>Add agent</Button>} />
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs<Filter> value={filter} onChange={setFilter} className="-mb-px border-b-0" items={[
          { value: "all", label: "All", count: agents.length },
          { value: "active", label: "Active", count: agents.filter((user) => user.is_active).length },
          { value: "revoked", label: "Revoked", count: agents.filter((user) => !user.is_active).length },
        ]} />
        <label className="relative mb-3 block sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents" aria-label="Search agents" className={cn(controlClass, "h-10 pl-9")} />
        </label>
      </div>
      <div className="border-t border-line">
        {data.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          : data.isError ? <EmptyState title="Agents unavailable" body={errorMessage(data.error, "Unable to load departmental Agents.")} />
          : visible.length ? <ul className="divide-y divide-line-soft">{visible.map((user) => <li key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <Avatar name={user.full_name} className={cn(!user.is_active && "bg-black/[.06] text-ink/50")} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.full_name}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
            <Chip tone={user.is_active ? "success" : "danger"}>{user.is_active ? "Active" : "Login revoked"}</Chip>
            {user.is_active
              ? <Button size="sm" variant="danger" icon={<LockKeyhole size={13} />} disabled={busy()} onClick={() => setConfirming(user)}>Revoke</Button>
              : <Button size="sm" variant="outline" icon={<Unlock size={13} />} pending={busy(`access:${user.id}`)} disabled={busy() && !busy(`access:${user.id}`)} onClick={() => void setActive(user, true)}>Restore</Button>}
          </li>)}</ul>
          : <EmptyState icon={term ? Search : ShieldCheck} title={term ? "No agents match your search" : agents.length ? "Nothing in this view" : "No agents in this department"} body={!agents.length ? "Agents are created by a Super Admin." : undefined} />}
      </div>
    </Card>

    {adding && <AddAgent onClose={() => setAdding(false)} />}
    <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} dismissible={!busy()} title="Revoke login?"
      footer={<><Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy()}>Cancel</Button><Button variant="danger" icon={<LockKeyhole size={15} />} pending={confirming ? busy(`access:${confirming.id}`) : false} pendingLabel="Revoking…" onClick={() => confirming && void setActive(confirming, false)}>Revoke login</Button></>}>
      <p className="text-sm text-muted"><b className="text-ink">{confirming?.full_name}</b> won&apos;t be able to sign in until their access is restored.</p>
    </Modal>
  </div>;
}

function AddAgent({ onClose }: { onClose: () => void }) {
  const { run, busy } = useBrokerageAction();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const pending = busy("add-agent");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run("add-agent", "/api/v1/brokerage/department-users", "POST", form, "Agent created and ready to sign in.") !== undefined) onClose();
  };
  return <Modal open onClose={onClose} dismissible={!pending} title="Add agent" subtitle="Joins your department with standard agent access"
    footer={<><Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" form="add-agent-form" variant="primary" icon={<UserPlus size={15} />} pending={pending} pendingLabel="Creating…">Create agent</Button></>}>
    <form id="add-agent-form" onSubmit={submit}>
      <fieldset disabled={pending} className="space-y-4">
        <TextField label="Full name" required minLength={2} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
        <TextField label="Work email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <PasswordInput label="Temporary password" required minLength={8} autoComplete="new-password" hint="At least 8 characters. Share it with the agent securely." value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      </fieldset>
    </form>
  </Modal>;
}
