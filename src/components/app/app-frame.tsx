"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { SessionGate, useSession } from "@/components/app/session";
import { BrokerageGate } from "@/components/app/brokerage-context";
import { AppShell } from "@/components/app/app-shell";

export function AppFrame({ children }: { children: ReactNode }) {
  return <ToastProvider><SessionGate><RoleFrame>{children}</RoleFrame></SessionGate></ToastProvider>;
}

function RoleFrame({ children }: { children: ReactNode }) {
  const { isSuperAdmin } = useSession();
  if (isSuperAdmin) return <AppShell>{children}</AppShell>;
  return <BrokerageGate><AppShell>{children}</AppShell></BrokerageGate>;
}
