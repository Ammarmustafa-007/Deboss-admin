"use client";

import { useSession } from "@/components/app/session";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { BrokerageDashboard } from "@/components/dashboard/brokerage-dashboard";

export default function DashboardPage() {
  const { isSuperAdmin } = useSession();
  return isSuperAdmin ? <AdminDashboard /> : <BrokerageDashboard />;
}
