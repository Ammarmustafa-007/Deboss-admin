"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadProfile, profileKey, type Profile } from "@/lib/loaders";
import { WorkspaceLoadError } from "@/components/app/workspace-load-error";
import { IntroBackdrop, RevealIntro } from "@/components/app/intro";

export type { Profile };

type Session = {
  profile: Profile;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  signingOut: boolean;
};

const SessionContext = createContext<Session | null>(null);

/** Verifies the Supabase session and loads the signed-in profile once for the whole /app area. */
export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);

  const session = useQuery({
    queryKey: profileKey,
    queryFn: () => loadProfile(supabase),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (session.data === null) router.replace("/");
  }, [router, session.data]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, current) => {
      if (!current) {
        // Drop the previous user's cached data so the next sign-in never sees it.
        queryClient.clear();
        router.replace("/");
        return;
      }
      const cached = queryClient.getQueryData<{ id: string } | null>(profileKey);
      if (cached && cached.id !== current.user.id) {
        // Another account signed in (e.g. in another tab): reload so nothing from the old account survives.
        window.location.reload();
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") void queryClient.invalidateQueries({ queryKey: profileKey });
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
