"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { responseData, type Api } from "@/lib/api";

/**
 * Query keys and fetchers shared by the /app screens and the login page.
 * Login starts these during its globe animation so /app opens with the data already cached.
 */
export const profileKey = ["session", "profile"] as const;
export const workspaceKey = ["brokerage", "workspace"] as const;
export const notificationsKey = ["brokerage", "notifications"] as const;
export const overviewKey = ["brokerage-overview"] as const;

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  departments?: { id?: string; name: string; business_unit?: string; function?: string } | null;
};

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

export async function loadProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: auth, error: authError } = await withTimeout(supabase.auth.getUser(), "Your sign-in session could not be verified. Please try again.");
  if (authError) throw authError;
  if (!auth.user) return null;
  const { data: me, error: profileError } = await withTimeout(
    supabase.from("profiles").select("id, full_name, email, role, is_active, departments!profiles_department_id_fkey(id, name, business_unit, function)").eq("id", auth.user.id).single(),
    "Your workspace details took too long to load. Please try again.",
  );
  if (profileError || !me) throw new Error(profileError?.message ?? "Your account profile is incomplete.");
  if (!me.is_active) throw new Error("This account is inactive. Ask a Super Admin to restore access.");
  return me as unknown as Profile;
}

export const loadWorkspace = async <T,>(api: Api) => responseData<T>(await api("/api/v1/brokerage/workspace"));
export const loadNotifications = async <T,>(api: Api) => responseData<T>(await api("/api/v1/brokerage/notifications"));
export const loadOverview = async <T,>(api: Api) => responseData<T>(await api("/api/v1/brokerage/overview"));

/** Loads everything the first /app screen needs for this user. Never throws; /app retries on its own. */
export async function warmWorkspace(queryClient: QueryClient, supabase: SupabaseClient, api: Api) {
  try {
    const profile = await queryClient.fetchQuery({ queryKey: profileKey, queryFn: () => loadProfile(supabase), staleTime: Infinity });
    if (!profile) return;
    if (profile.role === "SUPER_ADMIN") await queryClient.prefetchQuery({ queryKey: overviewKey, queryFn: () => loadOverview(api) });
    else await Promise.all([
      queryClient.prefetchQuery({ queryKey: workspaceKey, queryFn: () => loadWorkspace(api) }),
      queryClient.prefetchQuery({ queryKey: notificationsKey, queryFn: () => loadNotifications(api) }),
    ]);
  } catch { /* the /app screens show their own error states */ }
}
