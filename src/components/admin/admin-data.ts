"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useApi } from "@/lib/api";
import type { Department, Profile } from "@/components/admin/parts";

export function useDepartments() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["admin", "departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Department[];
    },
  });
}

export function useUsers() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const response = await api("/api/v1/users");
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "User management API is unavailable.");
      return (body.users ?? []) as Profile[];
    },
  });
}

export function useAdminRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] });
}
