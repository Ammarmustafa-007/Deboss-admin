"use client";

import { useBrokerage } from "@/components/app/brokerage-context";
import { NotificationsWorkspace } from "@/components/brokerage/notifications";

export default function NotificationsPage() {
  const { notifications, api, refresh, report } = useBrokerage();
  return <NotificationsWorkspace data={notifications} api={api} refresh={refresh} report={report} />;
}
