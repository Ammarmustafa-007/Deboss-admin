"use client";

import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { ReportsWorkspace } from "@/components/brokerage/reports";

export default function ReportsPage() {
  const { profile } = useSession();
  const { api, report, sales, manager } = useBrokerage();
  return <ReportsWorkspace api={api} report={report} sales={sales} canViewTeamPerformance={manager || profile.role === "SUPER_ADMIN"} />;
}
