"use client";

import { useSession } from "@/components/app/session";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { BrokerageDashboard } from "@/components/dashboard/brokerage-dashboard";
import { useOptionalBrokerage } from "@/components/app/brokerage-context";
import { DispatchDashboard } from "@/components/dispatch/insights";

export default function DashboardPage() {
  const { isSuperAdmin } = useSession();
  const workspace = useOptionalBrokerage();
  return isSuperAdmin ? <AdminDashboard /> : workspace?.dispatch ? <DispatchDashboard /> : <BrokerageDashboard />;
}
