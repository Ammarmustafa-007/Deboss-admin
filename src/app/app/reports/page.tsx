"use client";

import { ReportsScreen } from "@/components/dashboard/reports-screen";
import { useBrokerage } from "@/components/app/brokerage-context";
import { DispatchReportsScreen } from "@/components/dispatch/insights";
import { FronterReportsScreen } from "@/components/fronter/fronter-screens";

export default function ReportsPage() {
  const { dispatch, fronter } = useBrokerage();
  return dispatch ? <DispatchReportsScreen /> : fronter ? <FronterReportsScreen /> : <ReportsScreen />;
}
