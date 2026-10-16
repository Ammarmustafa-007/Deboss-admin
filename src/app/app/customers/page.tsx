"use client";

import { useBrokerage } from "@/components/app/brokerage-context";
import { CustomerDirectory } from "@/components/brokerage/customers";

export default function CustomersPage() {
  const { api, report } = useBrokerage();
  return <CustomerDirectory api={api} report={report} />;
}
