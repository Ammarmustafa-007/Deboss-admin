"use client";

import { useBrokerage } from "@/components/app/brokerage-context";
import { OperationsBoard } from "@/components/brokerage/operations-board";

export default function OperationsPage() {
  const { workspace } = useBrokerage();
  return <OperationsBoard initialWorkspace={workspace} />;
}
