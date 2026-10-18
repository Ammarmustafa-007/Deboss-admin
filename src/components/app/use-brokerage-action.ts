"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSingleFlight } from "@/components/action-state";
import { useBrokerage } from "@/components/app/brokerage-context";
import { errorMessage, responseData } from "@/lib/api";

/**
 * Runs one Sales mutation at a time, reports the outcome as a toast and refreshes every Brokerage query
 * (workspace, lead, customer, quote). `busy(key)` uses the same key the action ran under.
 */
export function useBrokerageAction() {
  const { api, report } = useBrokerage();
  const queryClient = useQueryClient();
  const actions = useSingleFlight();

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ["brokerage"] }), [queryClient]);

  const run = useCallback(async <T = unknown>(key: string, path: string, method: string, body: unknown, success: string): Promise<T | undefined> => {
    let result: T | undefined;
    await actions.run(key, async () => {
      try {
        result = await responseData<T>(await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
        // Keep the action busy until fresh data is on screen, so nothing shows the old value in between.
        await refresh().catch(() => undefined);
        if (success) report(success);
      } catch (error) {
        report(errorMessage(error), "error");
        result = undefined;
      }
    });
    return result;
  }, [actions, api, refresh, report]);

  return { run, busy: actions.isBusy, refresh, wrap: actions.run };
}
