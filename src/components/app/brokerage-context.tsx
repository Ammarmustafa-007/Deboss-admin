"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useApi, type Api } from "@/lib/api";
import { loadNotifications, loadWorkspace, notificationsKey, workspaceKey } from "@/lib/loaders";
import { useToast, type ToastTone } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";
import { IntroBackdrop, RevealIntro } from "@/components/app/intro";

export type Capabilities = {
  sales?: boolean;
  departmentManager?: boolean;
  teamLead?: boolean;
  canMarkInvoiceReady?: boolean;
  canReviewQuotes?: boolean;
  canAssignLeads?: boolean;
  canAssignShipments?: boolean;
  canHandoffQuotes?: boolean;
  canResolveExceptions?: boolean;
  canReviewDocuments?: boolean;
  [key: string]: boolean | undefined;
};

// The workspace payload is passed straight through to the existing feature components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Workspace = { capabilities?: Capabilities; [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Notification = { id: string; read_at?: string | null; [key: string]: any };

type Brokerage = {
  workspace: Workspace;
  notifications: Notification[];
  unread: number;
  sales: boolean;
  manager: boolean;
  teamLead: boolean;
  /** Team Lead with Full managerial access: manager-style views and approvals, scoped to their team. */
  fullLead: boolean;
  /** Manager or Full Team Lead: anyone who supervises other agents' work. */
  supervisor: boolean;
  isFetching: boolean;
  api: Api;
  refresh: () => Promise<void>;
  report: (message: string, tone?: "success" | "error") => void;
};

const BrokerageContext = createContext<Brokerage | null>(null);

/** Loads the permission-scoped Brokerage workspace once for every non-admin screen. */
export function BrokerageGate({ children }: { children: ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const notify = useToast();

  const workspace = useQuery({
    queryKey: workspaceKey,
    queryFn: () => loadWorkspace<Workspace>(api),
    staleTime: 30_000,
    // Work assigned by someone else must appear without a manual reload.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const notifications = useQuery({
    queryKey: notificationsKey,
    queryFn: () => loadNotifications<{ notifications: Notification[] }>(api),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const refresh = useCallback(async () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["brokerage", "workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["brokerage", "notifications"] }),
    ]).catch(() => undefined);
  }, [queryClient]);
  const report = useCallback((message: string, tone: ToastTone = "success") => notify(message, tone), [notify]);

  const value = useMemo<Brokerage | null>(() => {
    if (!workspace.data) return null;
    const list = notifications.data?.notifications ?? [];
    const caps = workspace.data.capabilities ?? {};
    return {
      workspace: workspace.data,
      notifications: list,
      unread: list.filter((item) => !item.read_at).length,
      sales: Boolean(caps.sales),
      manager: Boolean(caps.departmentManager),
      teamLead: Boolean(caps.teamLead),
      fullLead: Boolean(caps.teamLead && !caps.departmentManager && (caps.canReviewQuotes || caps.canHandoffQuotes || caps.canReviewDocuments || caps.canResolveExceptions || caps.canMarkInvoiceReady)),
      supervisor: Boolean(caps.departmentManager || (caps.teamLead && (caps.canReviewQuotes || caps.canHandoffQuotes || caps.canReviewDocuments || caps.canResolveExceptions || caps.canMarkInvoiceReady))),
      isFetching: workspace.isFetching || notifications.isFetching,
      api,
      refresh,
      report,
    };
  }, [workspace.data, workspace.isFetching, notifications.data, notifications.isFetching, api, refresh, report]);

  if (workspace.isLoading) return <IntroBackdrop />;
  if (workspace.isError || !value) return <div className="grid min-h-screen place-items-center bg-canvas p-6">
    <RevealIntro />
    <EmptyState icon={ShieldAlert} title="Brokerage workspace unavailable" body={workspace.error instanceof Error ? workspace.error.message : "We could not load your permitted Brokerage data."} action={<Button variant="ink" icon={<RefreshCw size={15} />} onClick={() => void workspace.refetch()}>Try again</Button>} />
  </div>;
  return <BrokerageContext.Provider value={value}>{children}</BrokerageContext.Provider>;
}

export function useBrokerage(): Brokerage {
  const context = useContext(BrokerageContext);
  if (!context) throw new Error("useBrokerage must be used inside BrokerageGate.");
  return context;
}

/** Returns null for Super Admins, who have no Brokerage workspace. */
export function useOptionalBrokerage(): Brokerage | null {
  return useContext(BrokerageContext);
}
