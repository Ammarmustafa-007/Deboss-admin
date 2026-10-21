"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Container, Hourglass, Plus, Search, Trash2, Truck as TruckIcon, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { dateLabel } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Card, EmptyState, KpiCard, PageHeader, Skeleton, StatusChip } from "@/components/ui/surface";
import { Button, LinkButton } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField, controlClass } from "@/components/ui/field";
import { Tabs, type TabItem } from "@/components/ui/navigation";
import { carrierStatusLabel, truckTypeLabel, truckTypes, useCarriers, useDispatchDirectory, type Carrier, type Duplicate } from "@/components/dispatch/model";

type Filter = "all" | "DOCS_PENDING" | "PENDING_REVIEW" | "RETURNED" | "APPROVED" | "DISCARDED";

/** Dispatch Sales: every carrier the viewer may see (DS-1, DS-6, DS-13). */
export function CarriersScreen() {
  const router = useRouter();
  const { manager, teamLead, workspace } = useBrokerage();
  const carriers = useCarriers();
  const showOwner = manager || teamLead;
  const directory = useDispatchDirectory(showOwner);
  const reviewer = manager || Boolean(workspace.capabilities?.canReviewCarriers);
  const [filter, setFilter] = useState<Filter>(reviewer ? "PENDING_REVIEW" : "all");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const list = useMemo(() => carriers.data ?? [], [carriers.data]);
  const count = (status: string) => list.filter((carrier) => carrier.review_status === status).length;
  const tabs: TabItem<Filter>[] = [
    { value: "all", label: "All", count: list.length },
    { value: "PENDING_REVIEW", label: reviewer ? "Needs review" : "Pending review", count: count("PENDING_REVIEW") },
    { value: "DOCS_PENDING", label: "Docs pending", count: count("DOCS_PENDING") },
    { value: "RETURNED", label: "Returned", count: count("RETURNED"), hidden: !count("RETURNED") },
    { value: "APPROVED", label: "Approved", count: count("APPROVED") },
    { value: "DISCARDED", label: "Discarded", count: count("DISCARDED"), hidden: !count("DISCARDED") },
  ];
  const term = search.trim().toLowerCase();
  const visible = list.filter((carrier) => (filter === "all" || carrier.review_status === filter) && (!owner || carrier.owner_id === owner)
    && (!term || [carrier.company_name, carrier.mc_number, carrier.dot_number, carrier.contact_name, carrier.owner_name].some((value) => value?.toLowerCase().includes(term))));
  const trucks = list.flatMap((carrier) => carrier.trucks ?? []);

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Carriers" subtitle={manager ? "Every carrier in your department" : teamLead ? "Your team's carriers" : "Carriers you are onboarding"} actions={!manager && <LinkButton href="/app/dispatch/carriers/new" variant="primary" icon={<Plus size={16} />}>New carrier</LinkButton>} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Carriers" value={list.length} icon={Container} tone="brand" />
      <KpiCard label={reviewer ? "Waiting for your review" : "Pending review"} value={count("PENDING_REVIEW")} icon={Hourglass} tone={count("PENDING_REVIEW") ? "accent" : "info"} />
      <KpiCard label="Approved" value={count("APPROVED")} icon={UserRoundCheck} tone="success" />
      <KpiCard label="Trucks running" value={trucks.filter((truck) => truck.status === "RUNNING").length} icon={TruckIcon} tone="aqua" />
    </div>
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={filter} onChange={setFilter} className="min-w-0 flex-1" />
        <div className="flex flex-col gap-2 pb-3 sm:flex-row">
          {showOwner && <select value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Filter by agent" className={cn(controlClass, "h-10 sm:w-48")}><option value="">All agents</option>{(directory.data?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>}
          <div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, MC, DOT or contact" aria-label="Search carriers" className={cn(controlClass, "h-10 pl-9")} /></div>
        </div>
      </div>
      {carriers.isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14" />)}</div>
        : carriers.isError ? <EmptyState icon={AlertTriangle} title="Carriers unavailable" body={errorMessage(carriers.error)} />
        : visible.length ? <ul className="divide-y divide-line-soft border-t border-line-soft">{visible.map((carrier) => <CarrierRow key={carrier.id} carrier={carrier} showOwner={showOwner} onOpen={() => router.push(`/app/dispatch/carriers/${carrier.id}`)} />)}</ul>
        : <EmptyState icon={term ? Search : Container} title={term ? "No carriers match your search" : list.length ? "Nothing in this view" : "No carriers yet"} body={!list.length && !manager ? "Start by adding a carrier's MC/DOT details and trucks." : undefined} action={!list.length && !manager && <LinkButton href="/app/dispatch/carriers/new" variant="primary" icon={<Plus size={15} />}>New carrier</LinkButton>} />}
    </Card>
  </div>;
}

function CarrierRow({ carrier, showOwner, onOpen }: { carrier: Carrier; showOwner: boolean; onOpen: () => void }) {
  const trucks = carrier.trucks ?? [];
  return <li><button type="button" onClick={onOpen} className="group flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-[#FAF8F4]">
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold">{carrier.company_name}</p>
      <p className="truncate text-xs text-muted">{[carrier.mc_number && `MC ${carrier.mc_number}`, carrier.dot_number && `DOT ${carrier.dot_number}`, carrier.contact_name].filter(Boolean).join(" · ")}{showOwner && carrier.owner_name ? ` · ${carrier.owner_name}` : ""}</p>
    </div>
    <span className="hidden text-[13px] text-ink/70 sm:block">{trucks.length} truck{trucks.length === 1 ? "" : "s"}</span>
    <span className="hidden w-28 text-[13px] text-muted md:block">{dateLabel(carrier.updated_at)}</span>
    <StatusChip status={carrier.review_status} label={carrierStatusLabel[carrier.review_status]} />
    <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
  </button></li>;
}

type TruckDraft = { unit_number: string; truck_type: string; equipment_notes: string };
const blankTruck: TruckDraft = { unit_number: "", truck_type: "DRY_VAN", equipment_notes: "" };

/** DS-1: carrier profile with its trucks (answer 4), with a live MC/DOT duplicate warning (DS-4). */
export function NewCarrierScreen() {
  const router = useRouter();
  const { manager, api } = useBrokerage();
  const { run, busy } = useBrokerageAction();
  const [form, setForm] = useState({ company_name: "", mc_number: "", dot_number: "", contact_name: "", phone: "", email: "", operating_pattern: "" });
  const [trucks, setTrucks] = useState<TruckDraft[]>([{ ...blankTruck }]);
  const duplicates = useDuplicateCheck(api, form.mc_number, form.dot_number);
  const saving = busy("create-carrier");
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const setTruck = (index: number, field: keyof TruckDraft, value: string) => setTrucks((current) => current.map((truck, position) => position === index ? { ...truck, [field]: value } : truck));

  if (manager) return <EmptyState icon={Container} title="Carriers are added by Dispatch Sales agents" body="Managers review and approve them once they are submitted." action={<LinkButton href="/app/dispatch/carriers" variant="ink">Back to carriers</LinkButton>} className="mt-10" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const filled = trucks.filter((truck) => truck.unit_number.trim());
    const result = await run<{ carrier: Carrier }>("create-carrier", "/api/v1/dispatch/carriers", "POST", { ...form, trucks: filled }, "Carrier created. Add the documents next.");
    if (result?.carrier) router.push(`/app/dispatch/carriers/${result.carrier.id}?tab=documents`);
  };

  return <div className="mx-auto max-w-3xl space-y-6 animate-rise">
    <PageHeader crumbs={[{ label: "Carriers", href: "/app/dispatch/carriers" }, { label: "New carrier" }]} title="New carrier" subtitle="MC/DOT details, contact and trucks. Documents come next." />
    <form onSubmit={submit} className="space-y-6">
      <Card className="p-5">
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Company name" required minLength={2} maxLength={180} value={form.company_name} onChange={(event) => set("company_name")(event.target.value)} wrapperClassName="sm:col-span-2" />
          <TextField label="MC number" maxLength={20} value={form.mc_number} onChange={(event) => set("mc_number")(event.target.value)} hint="MC or DOT is required" />
          <TextField label="DOT number" maxLength={20} value={form.dot_number} onChange={(event) => set("dot_number")(event.target.value)} />
          {duplicates.length > 0 && <DuplicateWarning matches={duplicates} className="sm:col-span-2" />}
          <TextField label="Contact name" maxLength={160} value={form.contact_name} onChange={(event) => set("contact_name")(event.target.value)} />
          <TextField label="Phone" type="tel" maxLength={40} value={form.phone} onChange={(event) => set("phone")(event.target.value)} />
          <TextField label="Email" type="email" maxLength={180} value={form.email} onChange={(event) => set("email")(event.target.value)} wrapperClassName="sm:col-span-2" />
          <TextAreaField label="Operating pattern / notes" maxLength={3000} placeholder="Lanes, home base, preferred freight, hours…" value={form.operating_pattern} onChange={(event) => set("operating_pattern")(event.target.value)} wrapperClassName="sm:col-span-2" />
        </fieldset>
      </Card>
      <Card>
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4"><div><h2 className="font-semibold">Trucks</h2><p className="text-xs text-muted">Each truck is tracked as its own sale.</p></div><Button size="sm" variant="outline" icon={<Plus size={14} />} disabled={saving || trucks.length >= 50} onClick={() => setTrucks([...trucks, { ...blankTruck }])}>Add truck</Button></div>
        <div className="space-y-3 p-5">{trucks.map((truck, index) => <div key={index} className="grid items-end gap-3 rounded-[12px] border border-line-soft p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <TextField label="Unit / truck #" maxLength={40} value={truck.unit_number} onChange={(event) => setTruck(index, "unit_number", event.target.value)} />
          <SelectField label="Truck type" required value={truck.truck_type} onChange={(event) => setTruck(index, "truck_type", event.target.value)} options={truckTypes.map((type) => ({ value: type, label: truckTypeLabel[type] }))} />
          <TextField label="Equipment notes" maxLength={500} value={truck.equipment_notes} onChange={(event) => setTruck(index, "equipment_notes", event.target.value)} />
          <Button variant="ghost" aria-label="Remove truck" disabled={saving || trucks.length === 1} onClick={() => setTrucks(trucks.filter((_, position) => position !== index))} className="h-11 text-[#C4254B]"><Trash2 size={15} /></Button>
        </div>)}</div>
      </Card>
      <div className="flex justify-end gap-2">
        <LinkButton href="/app/dispatch/carriers" variant="ghost">Cancel</LinkButton>
        <Button type="submit" variant="primary" pending={saving} pendingLabel="Creating…" disabled={!form.company_name.trim() || (!form.mc_number.trim() && !form.dot_number.trim())}>Create carrier</Button>
      </div>
    </form>
  </div>;
}

/** Real-time MC/DOT duplicate check (DS-4): runs shortly after typing stops. */
export function useDuplicateCheck(api: ReturnType<typeof useBrokerage>["api"], mc: string, dot: string, exclude?: string) {
  const [matches, setMatches] = useState<Duplicate[]>([]);
  useEffect(() => {
    const mcValue = mc.trim(); const dotValue = dot.trim();
    if (mcValue.length < 3 && dotValue.length < 3) { const clear = setTimeout(() => setMatches([]), 0); return () => clearTimeout(clear); }
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ ...(mcValue.length >= 3 ? { mc: mcValue } : {}), ...(dotValue.length >= 3 ? { dot: dotValue } : {}), ...(exclude ? { exclude } : {}) });
      void api(`/api/v1/dispatch/duplicates?${params}`).then((response) => responseData<{ matches: Duplicate[] }>(response)).then((data) => setMatches(data.matches)).catch(() => setMatches([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [api, mc, dot, exclude]);
  return matches;
}

export function DuplicateWarning({ matches, className }: { matches: Duplicate[]; className?: string }) {
  const dnc = matches.some((match) => match.dnc);
  return <div className={cn("rounded-[12px] border px-4 py-3 text-sm", dnc ? "border-danger/30 bg-danger/[.06] text-[#A5183F]" : "border-accent/40 bg-[#FFF6E8] text-[#7C4400]", className)}>
    <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} />{dnc ? "This carrier is on the Do-Not-Call list" : "This MC/DOT number already exists"}</p>
    <ul className="mt-1.5 space-y-0.5">{matches.map((match) => <li key={match.id}><Link href={`/app/dispatch/carriers/${match.id}`} className="underline-offset-2 hover:underline">{match.company_name}</Link> · {match.owner_name} · {carrierStatusLabel[match.review_status] ?? match.review_status}{match.dnc ? " · Do not call" : ""}</li>)}</ul>
  </div>;
}
