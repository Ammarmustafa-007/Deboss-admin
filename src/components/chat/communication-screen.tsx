"use client";

import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, Search, UsersRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { dateTimeLabel } from "@/lib/format";
import { errorMessage, responseData, useApi } from "@/lib/api";
import { Avatar, Card, CardHeader, Chip, EmptyState, KpiCard, PageHeader, Skeleton } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/field";

type Group = { id: string; name: string; photo_url: string | null; team: string | null; team_active: boolean; department: string | null; created_at: string; last_message_at: string | null; messages: number; members: { id: string; full_name: string; email: string | null; role: string | null; chat_role: string; active: boolean }[] };

/** Super Admin: which chat groups exist and who can talk inside each one. Message contents stay with the members. */
export function CommunicationScreen() {
  const api = useApi();
  const data = useQuery({ queryKey: ["admin", "communication"], queryFn: async () => responseData<{ direct_conversations: number; groups: Group[] }>(await api("/api/v1/admin/communication")), staleTime: 30_000 });
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const groups = (data.data?.groups ?? []).filter((group) => !term || [group.name, group.team, group.department, ...group.members.map((member) => member.full_name)].some((value) => value?.toLowerCase().includes(term)));
  return <div className="space-y-6 animate-rise">
    <PageHeader title="Communication" subtitle="Team chat groups and who is in each one" />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      <KpiCard label="Team groups" value={data.data?.groups.length ?? "…"} icon={UsersRound} tone="aqua" />
      <KpiCard label="People in groups" value={data.data ? new Set(data.data.groups.flatMap((group) => group.members.map((member) => member.id))).size : "…"} tone="brand" />
      <KpiCard label="Direct conversations" value={data.data?.direct_conversations ?? "…"} icon={MessagesSquare} tone="accent" className="col-span-2 xl:col-span-1" />
    </div>
    <div className="relative sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Group, team, department or person" aria-label="Search groups" className={cn(controlClass, "h-10 pl-9")} /></div>
    {data.isLoading ? <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((index) => <Skeleton key={index} className="h-48" />)}</div>
      : data.isError ? <Card><EmptyState icon={MessagesSquare} title="Communication unavailable" body={errorMessage(data.error)} /></Card>
      : groups.length ? <div className="grid gap-4 xl:grid-cols-2">{groups.map((group) => <Card key={group.id}>
        <CardHeader title={<span className="flex items-center gap-3">{group.photo_url ? <img // eslint-disable-line @next/next/no-img-element
           src={group.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-aqua/15 text-aqua"><UsersRound size={16} /></span>}{group.name}</span>}
          subtitle={`${group.department ?? "—"} · Team ${group.team ?? "—"} · ${group.messages} message${group.messages === 1 ? "" : "s"}${group.last_message_at ? ` · last ${dateTimeLabel(group.last_message_at)}` : ""}`}
          actions={!group.team_active && <Chip tone="neutral">Team inactive</Chip>} />
        <ul className="divide-y divide-line-soft">{group.members.map((member) => <li key={member.id} className="flex items-center gap-3 px-5 py-2.5"><Avatar name={member.full_name} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{member.full_name}</span><span className="block truncate text-xs text-muted">{member.email}</span></span><span className="text-xs text-muted">{member.role === "MANAGER" ? "Manager" : "Agent"}</span>{member.chat_role === "ADMIN" && <Chip tone="brand">Admin</Chip>}{!member.active && <Chip tone="neutral">Inactive</Chip>}</li>)}</ul>
      </Card>)}</div>
      : <Card><EmptyState icon={UsersRound} title={term ? "No groups match" : "No team groups yet"} body={!term ? "Groups are created when managers create teams." : undefined} /></Card>}
  </div>;
}
