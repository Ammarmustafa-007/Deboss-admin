"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceLoadError } from "@/components/app/workspace-load-error";
import { IntroBackdrop, RevealIntro } from "@/components/app/intro";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  departments?: { id?: string; name: string; business_unit?: string; function?: string } | null;
};

type Session = {
  profile: Profile;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  signingOut: boolean;
};

const SessionContext = createContext<Session | null>(null);

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

/** Verifies the Supabase session and loads the signed-in profile once for the whole /app area. */
export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);

  const session = useQuery({
    queryKey: ["session", "profile"],
    queryFn: async (): Promise<Profile | null> => {
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
    },
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (session.data === null) router.replace("/");
  }, [router, session.data]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, current) => {
      if (!current) {
        router.replace("/");
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") void queryClient.invalidateQueries({ queryKey: ["session", "profile"] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router, supabase]);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await supabase.auth.signOut(); }
    finally {
      // A full reload clears every preserved route and cached query from the previous user.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    }
  }, [signingOut, supabase]);

  const profile = session.data;
  const value = useMemo<Session | null>(() => profile ? { profile, isSuperAdmin: profile.role === "SUPER_ADMIN", signOut, signingOut } : null, [profile, signOut, signingOut]);

  if (session.isPending || (session.isFetching && !profile) || session.data === null) return <IntroBackdrop />;
  if (session.isError || !value) return <><RevealIntro /><WorkspaceLoadError message={session.error?.message || "Your account profile is unavailable."} onRetry={() => void session.refetch()} onSignOut={() => void signOut()} /></>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionGate.");
  return session;
}
