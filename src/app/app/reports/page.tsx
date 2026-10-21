"use client";

import { ReportsScreen } from "@/components/dashboard/reports-screen";
import { useBrokerage } from "@/components/app/brokerage-context";
import { DispatchReportsScreen } from "@/components/dispatch/insights";

export default function ReportsPage() {
  const { dispatch } = useBrokerage();
  return dispatch ? <DispatchReportsScreen /> : <ReportsScreen />;
}
