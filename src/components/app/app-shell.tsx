"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Compass, LoaderCircle, LogOut, Menu, RefreshCw, X } from "lucide-react";
import { useState, ViewTransition, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar, EmptyState, humanize, type Tone } from "@/components/ui/surface";
import { LinkButton } from "@/components/ui/button";
import { Bump } from "@/components/ui/motion";
import { useSession } from "@/components/app/session";
import { useOptionalBrokerage } from "@/components/app/brokerage-context";
import { NotificationBell } from "@/components/app/notification-bell";
import { RevealIntro, useIntro } from "@/components/app/intro";
import { activeItem, adminNavigation, brokerageNavigation, chatItem, dispatchNavigation, fronterNavigation, type NavGroup } from "@/components/app/navigation";
import { useChatUnread } from "@/components/chat/chat-data";

const iconTone: Record<Tone, string> = {
  brand: "text-brand", aqua: "text-aqua", accent: "text-[#A08BFF]", info: "text-[#6AB0FF]", danger: "text-[#FF7A9A]", success: "text-[#4FD18B]", neutral: "text-white/60",
};

const collapseKey = "deboss.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, isSuperAdmin, signOut, signingOut } = useSession();
  const brokerage = useOptionalBrokerage();
  const [collapsed, setCollapsed] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem(collapseKey) === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { entering } = useIntro();

  const toggleCollapsed = () => setCollapsed((value) => {
    try { window.localStorage.setItem(collapseKey, value ? "0" : "1"); } catch { /* storage unavailable */ }
    return !value;
  });

  // Everyone gets Chat; the Super Admin's holds only Company announcements.
  const chatUnread = useChatUnread(isSuperAdmin || Boolean(brokerage));
  const baseGroups: NavGroup[] = isSuperAdmin || !brokerage ? adminNavigation : brokerage.fronter ? fronterNavigation({ manager: brokerage.manager }) : brokerage.dispatch ? dispatchNavigation({
    sales: brokerage.sales,
    manager: brokerage.manager,
    invoices: Boolean(brokerage.workspace.capabilities?.canSignOffInvoices),
  }) : brokerageNavigation({
    sales: brokerage.sales,
    manager: brokerage.manager,
    canMarkInvoiceReady: Boolean(brokerage.workspace.capabilities?.canMarkInvoiceReady),
  });
  // Chat goes into the first group of every non-admin workspace.
  const groups: NavGroup[] = !isSuperAdmin && !brokerage ? baseGroups : baseGroups.map((group, index) => index === 0 ? { ...group, items: [...group.items, chatItem(chatUnread)] } : group);
  const current = activeItem(groups, pathname);
  const roleLabel = isSuperAdmin ? "Super Admin" : brokerage?.manager ? "Department manager" : brokerage?.teamLead ? (brokerage.fullLead ? "Team lead · Full access" : "Team lead") : "Agent";
  const areaLabel = isSuperAdmin ? "Administration" : `${brokerage?.dispatch ? "Dispatch" : "Brokerage"} · ${brokerage?.fronter ? "Fronters" : humanize(brokerage?.workspace.department?.function ?? (brokerage?.sales ? "SALES" : "OPERATIONS"))}`;

  const sidebar = (compact: boolean) => <div className="sidebar-surface flex h-full flex-col px-3 py-5 text-white">
    <div className={cn("mb-7 flex items-center gap-3", compact ? "justify-center" : "px-2")}>
      <Image src="/brand/dg-mark-light.png" alt="DEBOSS GLOBAL" width={52} height={34} className="h-[30px] w-auto shrink-0" priority />
      {!compact && <div className="min-w-0 leading-tight"><p className="text-[15px] font-bold tracking-wide">DEBOSS</p><p className="text-[10px] font-medium tracking-[0.3em] text-brand">GLOBAL</p></div>}
    </div>
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {groups.map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) })).filter((group) => group.items.length).map((group) => <div key={group.label}>
        {!compact && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{group.label}</p>}
        <div className="flex flex-col gap-1">
          {group.items.map((item) => {
            const active = current?.href === item.href;
            return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={compact ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("group relative flex h-10 items-center gap-3 rounded-control text-sm font-medium transition-[background-color,color,transform] duration-200", compact ? "justify-center" : "px-3 hover:translate-x-1", active ? "bg-brand font-semibold text-ink" : "text-[#D4D0C8] hover:bg-white/[.08] hover:text-white")}>
              <item.icon size={18} className={cn("shrink-0", active ? "text-ink" : iconTone[item.tone])} />
              {!compact && <span className="truncate">{item.label}</span>}
              {item.badge ? <Bump value={item.badge} className={cn("grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white", compact ? "absolute -right-0.5 -top-0.5" : "ml-auto")} /> : null}
            </Link>;
          })}
        </div>
      </div>)}
    </nav>
    <div className={cn("mt-4 flex items-center gap-3 rounded-[12px] bg-white/[.07] p-2.5", compact && "flex-col")}>
      <Avatar name={profile.full_name} className="bg-brand text-ink" />
      {!compact && <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-sm font-semibold">{profile.full_name}</p><p className="truncate text-xs text-[#B8B3A9]">{roleLabel}</p></div>}
      <button type="button" onClick={() => void signOut()} disabled={signingOut} aria-label="Sign out" title="Sign out" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50">{signingOut ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}</button>
    </div>
  </div>;

  return <div className={cn("min-h-screen bg-canvas text-ink", entering && "app-intro")}>
    <RevealIntro />
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-[248px]")}>
      {sidebar(collapsed)}
      <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-ink/60 shadow-sm hover:text-ink">{collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}</button>
    </aside>

    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/55 animate-fade" onClick={() => setMobileOpen(false)} />
      <div className="relative h-full w-[min(280px,85vw)] animate-slide-in">
        {sidebar(false)}
        <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10"><X size={18} /></button>
      </div>
    </div>}

    <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="grid h-10 w-10 place-items-center rounded-control border border-line bg-white lg:hidden"><Menu size={18} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{areaLabel}</p>
          <p className="truncate text-[15px] font-semibold">{current?.label ?? "DEBOSS"}</p>
        </div>
        {brokerage && <>
          <button type="button" onClick={() => void brokerage.refresh()} disabled={brokerage.isFetching} aria-label="Refresh workspace" title="Refresh workspace" className="grid h-10 w-10 place-items-center rounded-control border border-line bg-white text-ink/70 transition hover:border-brand hover:text-ink disabled:opacity-60"><RefreshCw size={16} className={brokerage.isFetching ? "animate-spin" : ""} /></button>
          <NotificationBell />
        </>}
        <div className="hidden items-center gap-2.5 border-l border-line pl-3 sm:flex">
          <Avatar name={profile.full_name} />
          <div className="leading-tight"><p className="max-w-40 truncate text-sm font-semibold">{profile.full_name}</p><p className="text-xs text-muted">{roleLabel}</p></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ViewTransition default="page">
          <div>{current ? children : <EmptyState icon={Compass} title="This area isn't part of your workspace" body="Your role doesn't include this screen." action={<LinkButton href="/app" variant="ink">Back to dashboard</LinkButton>} className="mt-16" />}</div>
        </ViewTransition>
      </main>
    </div>
  </div>;
}
