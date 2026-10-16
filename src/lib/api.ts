"use client";

import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export const apiRoot = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Api = (path: string, init?: RequestInit) => Promise<Response>;

/** Authenticated fetch against the DEBOSS backend. JSON content type is only sent when there is a body. */
export function useApi(): Api {
  const supabase = useMemo(() => createClient(), []);
  return useCallback<Api>(async (path, init) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(`${apiRoot}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  }, [supabase]);
}

export async function responseData<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
  return body as T;
}

export function errorMessage(error: unknown, fallback = "The request could not be completed.") {
  return error instanceof Error ? error.message : fallback;
}
