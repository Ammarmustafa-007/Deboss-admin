"use client";

import { useQuery } from "@tanstack/react-query";
import { responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";

export type DirectoryPerson = { id: string; full_name: string; email?: string; role?: string; is_active?: boolean };
export type DirectoryTeam = { id: string; name: string; team_lead_id?: string | null; is_active: boolean; team_members?: { user_id: string }[]; team_lead_permissions?: { permission_key: string }[] };

/** Department agents and teams. The endpoint is manager-only, so pass `enabled = manager`. */
export function useTeamDirectory(enabled = true) {
  const { api } = useBrokerage();
  return useQuery({
    queryKey: ["brokerage", "team-directory"],
    queryFn: async () => responseData<{ users: DirectoryPerson[]; teams: DirectoryTeam[] }>(await api("/api/v1/brokerage/team-directory")),
    enabled,
    staleTime: 60_000,
  });
}
