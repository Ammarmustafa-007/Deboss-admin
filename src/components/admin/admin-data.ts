"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, useApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export type Department = { id: string; name: string; business_unit: string; function: string; is_active: boolean };
export type AdminUser = { id: string; full_name: string; email: string; role: string; is_active: boolean; departments?: { id?: string; name: string; business_unit?: string; function?: string } | null };

export const roles = ["SUPER_ADMIN", "MANAGER", "AGENT"];
export const roleLabel: Record<string, string> = { SUPER_ADMIN: "Super Admin", MANAGER: "Manager", AGENT: "Agent" };

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
      return (body.users ?? []) as AdminUser[];
    },
  });
}

/** Runs one Users API call at a time with the original error messages, then refreshes admin data. */
export function useAdminAction() {
  const api = useApi();
  const notify = useToast();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<string | null>(null);

  const run = useCallback(async (key: string, path: string, method: string, body: unknown, success: string, failure: string) => {
    if (active) return false;
    setActive(key);
    try {
      const response = await api(path, { method, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { notify(payload?.error ?? failure, "error"); return false; }
      notify(success);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      return true;
    } catch (error) {
      notify(errorMessage(error, "The Users API could not be reached."), "error");
      return false;
    } finally {
      setActive(null);
    }
  }, [active, api, notify, queryClient]);

  return { run, busy: (key?: string) => key ? active === key : Boolean(active), setActive };
}
