import { BarChart3, Bell, Building2, Contact, LayoutDashboard, ReceiptText, Settings, ShieldCheck, TrendingUp, Truck, UsersRound, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/surface";

export type NavItem = { href: string; label: string; icon: LucideIcon; tone: Tone; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

export const adminNavigation: NavGroup[] = [
  { label: "Overview", items: [{ href: "/app", label: "Dashboard", icon: LayoutDashboard, tone: "brand" }] },
  { label: "Administration", items: [
    { href: "/app/admin/departments", label: "Departments", icon: Building2, tone: "aqua" },
    { href: "/app/admin/users", label: "Users", icon: UsersRound, tone: "accent" },
  ] },
  { label: "Account", items: [{ href: "/app/settings", label: "Settings", icon: Settings, tone: "info" }] },
];

type BrokerageAccess = { sales: boolean; manager: boolean; canMarkInvoiceReady: boolean; unread: number };

/** Mirrors the permission rules of the original section switcher. */
export function brokerageNavigation({ sales, manager, canMarkInvoiceReady, unread }: BrokerageAccess): NavGroup[] {
  const work: NavItem[] = [{ href: "/app", label: "Dashboard", icon: LayoutDashboard, tone: "brand" }];
  if (sales) work.push({ href: "/app/sales", label: "Sales", icon: TrendingUp, tone: "aqua" }, { href: "/app/customers", label: "Customers", icon: Contact, tone: "accent" });
  else work.push({ href: "/app/operations", label: "Operations", icon: Truck, tone: "aqua" });
  if (!sales && (manager || canMarkInvoiceReady)) work.push({ href: "/app/invoices", label: "Invoices", icon: ReceiptText, tone: "success" });

  const groups: NavGroup[] = [{ label: "Workspace", items: work }];
  if (manager) groups.push({ label: "Management", items: [
    { href: "/app/teams", label: "Teams", icon: UsersRound, tone: "accent" },
    { href: "/app/access", label: "Agent access", icon: ShieldCheck, tone: "info" },
  ] });
  groups.push({ label: "Insights", items: [
    { href: "/app/reports", label: "Reports", icon: BarChart3, tone: "info" },
    { href: "/app/notifications", label: "Notifications", icon: Bell, tone: "danger", badge: unread || undefined },
  ] });
  return groups;
}

/** The nav item that owns a pathname: exact match for the dashboard, segment-prefix match for the rest. */
export function activeItem(groups: NavGroup[], pathname: string): NavItem | undefined {
  const items = groups.flatMap((group) => group.items);
  return items
    .filter((item) => item.href === "/app" ? pathname === "/app" : pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
