"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Mail, Phone, Search, UsersRound } from "lucide-react";
import { use, useState } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Avatar, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { LinkButton } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { CustomerPanel, useCustomerProfile } from "@/components/sales/customer-panel";
import { useTeamDirectory } from "@/components/sales/directory";
import type { Customer } from "@/components/sales/model";

export function CustomersScreen() {
  const router = useRouter();
  const { api } = useBrokerage();
  const customers = useQuery({ queryKey: ["brokerage", "customers"], queryFn: async () => responseData<{ customers: Customer[] }>(await api("/api/v1/brokerage/customers")), staleTime: 20_000 });
  const [search, setSearch] = useState("");
  const { manager } = useBrokerage();
  const directory = useTeamDirectory(manager);
  const [owner, setOwner] = useState("");
  const ownerName = (id?: string | null) => directory.data?.users.find((user) => user.id === id)?.full_name;

  const list = customers.data?.customers ?? [];
  const term = search.trim().toLowerCase();
  const visible = list.filter((customer) => (!owner || customer.owner_id === owner) && (!term || `${customer.company_name} ${customer.contact_name ?? ""} ${customer.contact_email ?? ""}`.toLowerCase().includes(term)));

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Customers" subtitle={customers.data ? `${list.length} customer${list.length === 1 ? "" : "s"} in your scope` : undefined} />
    <Card>
      <div className="flex flex-col items-stretch justify-end gap-2 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
        {manager && <select value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Filter by agent" className={cn(controlClass, "h-10 sm:w-48")}><option value="">All agents</option>{(directory.data?.users ?? []).filter((user) => user.role === "AGENT").map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select>}
        <label className="relative block w-full sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" aria-label="Search customers" className={cn(controlClass, "h-10 pl-9")} />
        </label>
      </div>
      {customers.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
        : customers.isError ? <EmptyState title="Customers unavailable" body={errorMessage(customers.error)} />
        : visible.length ? <>
          <table className="hidden w-full text-sm md:table">
            <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Company</th>{manager && <th className="px-3 py-2.5 font-medium">Owner</th>}<th className="px-3 py-2.5 font-medium">Email</th><th className="px-3 py-2.5 font-medium">Phone</th><th className="px-3 py-2.5 font-medium">Updated</th><th className="w-10" /></tr></thead>
            <tbody>{visible.map((customer) => <tr key={customer.id} onClick={() => router.push(`/app/customers/${customer.id}`)} className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-[#FAF8F4]">
              <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={customer.company_name} /><div className="min-w-0"><Link href={`/app/customers/${customer.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-brand-deep">{customer.company_name}</Link><p className="text-xs text-muted">{customer.contact_name || "No contact"}</p></div></div></td>
              {manager && <td className="px-3 py-3 text-[13px] text-ink/75">{ownerName(customer.owner_id) ?? "—"}</td>}
              <td className="px-3 py-3 text-[13px] text-ink/75">{customer.contact_email || "—"}</td>
              <td className="px-3 py-3 text-[13px] text-ink/75">{customer.contact_phone || "—"}</td>
              <td className="px-3 py-3 text-[13px] text-ink/75">{dateLabel(customer.updated_at)}</td>
              <td className="pr-4 text-muted"><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></td>
            </tr>)}</tbody>
          </table>
          <ul className="divide-y divide-line-soft md:hidden">{visible.map((customer) => <li key={customer.id}><Link href={`/app/customers/${customer.id}`} className="flex items-center gap-3 px-4 py-3.5"><Avatar name={customer.company_name} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{customer.company_name}</p><p className="truncate text-xs text-muted">{customer.contact_name || "No contact"}{customer.contact_email ? ` · ${customer.contact_email}` : ""}</p></div><ChevronRight size={16} className="text-muted" /></Link></li>)}</ul>
        </> : <EmptyState icon={term ? Search : UsersRound} title={term ? "No customers match your search" : "No customers yet"} body={term ? undefined : "Leads appear here once they're converted to customers."} />}
    </Card>
  </div>;
}

export function CustomerRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerScreen customerId={id} />;
}

export function CustomerScreen({ customerId }: { customerId: string }) {
  const profile = useCustomerProfile(customerId);
  const customer = profile.data?.customer;
  return <div className="space-y-6 animate-rise">
    <PageHeader
      crumbs={[{ label: "Customers", href: "/app/customers" }, { label: customer?.company_name ?? "Customer" }]}
      title={customer?.company_name ?? <Skeleton className="h-8 w-64" />}
      subtitle={customer && <span className="flex flex-wrap gap-x-4 gap-y-1">
        <span>{customer.contact_name || "No contact"}</span>
        {customer.contact_email && <a href={`mailto:${customer.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-ink"><Mail size={14} />{customer.contact_email}</a>}
        {customer.contact_phone && <a href={`tel:${customer.contact_phone}`} className="inline-flex items-center gap-1.5 hover:text-ink"><Phone size={14} />{customer.contact_phone}</a>}
      </span>}
      actions={customer?.lead_id && <LinkButton href={`/app/sales/leads/${customer.lead_id}`} variant="ink" icon={<ExternalLink size={15} />}>Manage in Sales</LinkButton>}
    />
    <CustomerPanel customerId={customerId} readOnly />
  </div>;
}
