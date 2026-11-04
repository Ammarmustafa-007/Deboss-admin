"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { useState } from "react";
import { errorMessage, responseData, useApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, Skeleton } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";

type BrokerageSettings = { sales_manager_approval: boolean };
type Saved = BrokerageSettings & { moved?: { to_operations: number; to_agent: number } };

/**
 * The Brokerage Sales Manager step. On: a new customer's first load is approved by the Sales Manager, then Operations.
 * Off: the agent hands it straight to the Operations Manager, and an Operations rejection goes back to the agent.
 */
export function BrokerageSettingsCard() {
  const api = useApi();
  const notify = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "brokerage-settings"], queryFn: async () => responseData<BrokerageSettings>(await api("/api/v1/admin/brokerage-settings")) });
  const [confirmOff, setConfirmOff] = useState(false);
  const [saving, setSaving] = useState(false);
  const on = settings.data?.sales_manager_approval !== false;

  async function save(value: boolean) {
    setSaving(true);
    try {
      const result = await responseData<Saved>(await api("/api/v1/admin/brokerage-settings", { method: "PUT", body: JSON.stringify({ sales_manager_approval: value }) }));
      queryClient.setQueryData(["admin", "brokerage-settings"], { sales_manager_approval: result.sales_manager_approval });
      const moved = result.moved ? [result.moved.to_operations && `${result.moved.to_operations} sent on to Operations`, result.moved.to_agent && `${result.moved.to_agent} back to the agent to hand off`].filter(Boolean).join(", ") : "";
      notify(value ? "Sales Manager approval is on." : `Sales Manager approval is off.${moved ? ` Waiting loads: ${moved}.` : ""}`);
      setConfirmOff(false);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally { setSaving(false); }
  }

  return <Card>
    <CardHeader title="Brokerage Sales Manager" subtitle="Who approves a new customer's first load before Operations" />
    <div className="p-5">
      {settings.isLoading ? <Skeleton className="h-16" />
        : <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{on ? "On: the Sales Manager approves" : "Off: agents hand off to Operations"}</p>
            <p className="mt-1 text-muted">{on
              ? "The agent enters the agreed rate, the Sales Manager approves it and picks the Operations department, then the Operations Manager approves and assigns the customer's agent."
              : "The agent hands the first load straight to the Operations Manager, who approves and assigns the customer's agent, or rejects it back to the agent. Later loads still go straight to the customer's agent."}</p>
          </div>
          <Button variant={on ? "outline" : "primary"} icon={<UserCheck size={15} />} pending={saving} pendingLabel="Saving…" disabled={settings.isError} onClick={() => on ? setConfirmOff(true) : void save(true)} className="shrink-0">{on ? "Turn off" : "Turn on"}</Button>
        </div>}
      {settings.isError && <p className="mt-3 text-sm text-[#A5183F]">{errorMessage(settings.error)}</p>}
    </div>
    <Modal open={confirmOff} onClose={() => setConfirmOff(false)} dismissible={!saving} title="Turn off Sales Manager approval?"
      footer={<><Button variant="ghost" onClick={() => setConfirmOff(false)} disabled={saving}>Keep it on</Button><Button variant="primary" pending={saving} pendingLabel="Turning off…" onClick={() => void save(false)}>Turn off</Button></>}>
      <p className="text-sm leading-6 text-muted">Agents will hand new customers&apos; first loads straight to the Operations Manager. Loads now waiting for the Sales Manager move on to Operations, and loads rejected by Operations go back to their agent. You can turn it back on at any time.</p>
    </Modal>
  </Card>;
}
