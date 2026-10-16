"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/components/app/session";
import { useBrokerage } from "@/components/app/brokerage-context";
import { BrokerageOverviewPanel } from "@/components/admin/brokerage-overview";
import { Overview } from "@/components/brokerage/overview";

const sectionPaths: Record<string, string> = { sales: "/app/sales", operations: "/app/operations" };

export default function DashboardPage() {
  const { isSuperAdmin } = useSession();
  return isSuperAdmin ? <BrokerageOverviewPanel /> : <BrokerageDashboard />;
}

function BrokerageDashboard() {
  const router = useRouter();
  const { workspace, sales } = useBrokerage();
  return <Overview data={workspace} sales={sales} setSection={(section) => router.push(sectionPaths[section] ?? "/app")} />;
}
