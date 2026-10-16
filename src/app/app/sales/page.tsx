"use client";

import { useRouter } from "next/navigation";
import { useBrokerage } from "@/components/app/brokerage-context";
import { SalesWorkspace } from "@/components/brokerage/sales";

export default function SalesPage() {
  const router = useRouter();
  const { workspace, api, refresh, report } = useBrokerage();
  return <SalesWorkspace data={workspace} api={api} refresh={refresh} report={report} onOpenCustomers={() => router.push("/app/customers")} />;
}
