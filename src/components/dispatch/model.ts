"use client";

import { useQuery } from "@tanstack/react-query";
import { responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";

/** Dispatch module types and labels (client spec 3.4, 3.5, Figure 5). */

export type Truck = {
  id: string; carrier_id: string; unit_number: string; truck_type: string; equipment_notes?: string | null; status: string;
  dispatch_department_id?: string | null; assigned_to?: string | null; assigned_name?: string | null; team_id?: string | null; team_name?: string | null;
  dnc_reason?: string | null; activated_at?: string | null; created_at?: string; updated_at?: string;
  carrier?: Carrier; week_gross?: number; week_loads?: number; last_load_date?: string | null;
};
export type Carrier = {
  id: string; department_id: string; owner_id: string; owner_name?: string | null; team_id?: string | null; team_name?: string | null;
  company_name: string; mc_number?: string | null; dot_number?: string | null; contact_name?: string | null; phone?: string | null; email?: string | null;
  operating_pattern?: string | null; charge_percent?: number | string | null; payment_method?: string | null;
  review_status: string; review_note?: string | null; submitted_at?: string | null; reviewed_at?: string | null; reviewed_by_name?: string | null;
  dispatch_department_id?: string | null; dispatch_department_name?: string | null; handed_off_at?: string | null;
  created_at?: string; updated_at?: string; trucks?: Truck[];
};
export type CarrierDocument = { id: string; document_type: string; file_name: string; uploaded_by_name?: string | null; created_at: string };
export type Activity = { id: string; activity_type: string; body: string; due_at?: string | null; completed_at?: string | null; created_at: string; author_name?: string | null; created_by: string };
export type Comment = { id: string; body: string; author_name?: string; created_at: string; can_delete?: boolean };
export type Duplicate = { id: string; company_name: string; mc_number?: string | null; dot_number?: string | null; owner_name: string; review_status: string; dnc: boolean };
export type Load = {
  id: string; truck_id: string; dispatcher_id: string; dispatcher_name?: string | null; load_number?: string | null; broker_name?: string | null;
  pickup_city?: string | null; pickup_zip?: string | null; pickup_date: string; delivery_city?: string | null; delivery_zip?: string | null; delivery_date?: string | null;
  rate: number | string; miles?: number | null; status: string; notes?: string | null; week_start?: string;
  truck?: { id: string; unit_number: string; truck_type: string }; carrier?: { id: string; company_name: string };
};
export type DispatchInvoice = {
  id: string; invoice_number: string; truck_id: string; carrier_id: string; dispatcher_id: string; dispatcher_name?: string | null; sales_agent_name?: string | null;
  week_start: string; week_end: string; gross_amount: number | string; charge_percent: number | string; amount: number | string; amount_paid: number | string;
  status: string; review_note?: string | null; due_date?: string | null; submitted_at?: string | null; forwarded_at?: string | null; paid_at?: string | null; signed_off_at?: string | null;
  outstanding?: number; overdue?: boolean; truck?: { id: string; unit_number: string; truck_type: string; assigned_to?: string | null }; carrier?: { id: string; company_name: string };
};
export type CarrierDetail = {
  carrier: Carrier; trucks: Truck[]; documents: CarrierDocument[]; activities: Activity[]; comments: Comment[]; invoices: DispatchInvoice[];
  missing_documents: string[]; duplicates: Duplicate[];
  rights: { edit: boolean; submit: boolean; review: boolean; assign: boolean; terms: boolean; sales_side: boolean };
};
export type TruckDetail = {
  truck: Truck; carrier: Carrier; loads: Load[]; invoices: DispatchInvoice[]; comments: Comment[]; targets: { period_type: string; amount: number }[];
  rights: { update: boolean; assign: boolean; terms: boolean; sales_side: boolean };
};
export type DispatchDirectory = { users: { id: string; full_name: string }[]; teams: { id: string; name: string; team_lead_id?: string | null }[]; operations_departments: { id: string; name: string }[] };

export const truckTypes = ["DRY_VAN", "REEFER", "FLATBED", "STEP_DECK", "POWER_ONLY", "BOX_TRUCK", "HOTSHOT", "OTHER"];
export const truckTypeLabel: Record<string, string> = { DRY_VAN: "Dry van", REEFER: "Reefer", FLATBED: "Flatbed", STEP_DECK: "Step deck", POWER_ONLY: "Power only", BOX_TRUCK: "Box truck", HOTSHOT: "Hotshot", OTHER: "Other" };
export const paymentMethods = ["ACH", "CHECK", "ZELLE", "WIRE", "FACTORING", "OTHER"];
export const paymentLabel: Record<string, string> = { ACH: "ACH", CHECK: "Check", ZELLE: "Zelle", WIRE: "Wire", FACTORING: "Factoring", OTHER: "Other" };
export const documentTypes = ["MC_AUTHORITY", "W9", "COI", "PACKET", "OTHER"];
export const documentLabel: Record<string, string> = { MC_AUTHORITY: "MC/DOT authority", W9: "W9", COI: "Certificate of insurance (COI)", PACKET: "Carrier packet", OTHER: "Other" };
export const requiredDocuments = ["MC_AUTHORITY", "W9", "COI"];
export const activityTypes = ["CALL", "CALLBACK", "APPOINTMENT", "FOLLOW_UP", "EMAIL", "NOTE"];
export const carrierStatusLabel: Record<string, string> = { DOCS_PENDING: "Docs pending", PENDING_REVIEW: "Pending review", RETURNED: "Returned for rework", APPROVED: "Approved", DISCARDED: "Discarded" };
export const truckStatusLabel: Record<string, string> = { PENDING: "Awaiting approval", ACTIVE: "Active · needs dispatcher", ONBOARDED: "Onboarded", RUNNING: "Running", INACTIVE: "Inactive", DNC: "Do not call", DISCARDED: "Discarded" };
export const invoiceStatusLabel: Record<string, string> = { DRAFT: "Draft", SUBMITTED: "Submitted for review", FORWARDED: "Forwarded to accounting", PAID: "Paid", CANCELLED: "Cancelled" };
export const loadStatusLabel: Record<string, string> = { BOOKED: "Booked", DELIVERED: "Delivered", CANCELLED: "Cancelled" };

/** Figure 5 as a line: Docs pending → Pending review → Active → Onboarded → Running. */
export const carrierSteps = ["Docs pending", "Pending review", "Active", "Onboarded", "Running"];
export function carrierPosition(carrier: Carrier, trucks: Truck[]) {
  if (carrier.review_status === "DISCARDED") return { current: 1, blocked: true };
  if (carrier.review_status === "RETURNED") return { current: 0, blocked: true };
  if (carrier.review_status === "DOCS_PENDING") return { current: 0, blocked: false };
  if (carrier.review_status === "PENDING_REVIEW") return { current: 1, blocked: false };
  if (trucks.some((truck) => truck.status === "RUNNING")) return { current: carrierSteps.length, blocked: false };
  if (trucks.some((truck) => ["ONBOARDED", "INACTIVE"].includes(truck.status))) return { current: 4, blocked: false };
  return { current: 3, blocked: false };
}
export const truckSteps = ["Active", "Onboarded", "Running"];
export function truckPosition(status: string) {
  if (status === "RUNNING") return truckSteps.length;
  if (["ONBOARDED", "INACTIVE"].includes(status)) return 2;
  if (status === "ACTIVE") return 1;
  return 0;
}

/** Monday of the week containing the date (UTC), as YYYY-MM-DD, matching the API. */
export function weekStart(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekLabel(start: string) {
  const fmt = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(addDays(start, 6))}`;
}
export const pct = (value?: number | string | null) => value === null || value === undefined || value === "" ? "—" : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

// ---- Data hooks (keys start with "brokerage" so every action refresh reloads them) ----------------------------
export const dispatchKeys = {
  carriers: ["brokerage", "dispatch", "carriers"] as const,
  carrier: (id: string) => ["brokerage", "dispatch", "carrier", id] as const,
  trucks: ["brokerage", "dispatch", "trucks"] as const,
  truck: (id: string) => ["brokerage", "dispatch", "truck", id] as const,
  invoices: ["brokerage", "dispatch", "invoices"] as const,
  directory: ["brokerage", "dispatch", "directory"] as const,
};

export function useCarriers() {
  const { api } = useBrokerage();
  return useQuery({ queryKey: dispatchKeys.carriers, queryFn: async () => (await responseData<{ carriers: Carrier[] }>(await api("/api/v1/dispatch/carriers"))).carriers, staleTime: 15_000 });
}
export function useCarrier(id: string) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: dispatchKeys.carrier(id), queryFn: async () => responseData<CarrierDetail>(await api(`/api/v1/dispatch/carriers/${id}/detail`)), staleTime: 10_000 });
}
export function useTrucks() {
  const { api } = useBrokerage();
  return useQuery({ queryKey: dispatchKeys.trucks, queryFn: async () => responseData<{ week_start: string; trucks: Truck[] }>(await api("/api/v1/dispatch/trucks")), staleTime: 15_000 });
}
export function useTruck(id: string) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: dispatchKeys.truck(id), queryFn: async () => responseData<TruckDetail>(await api(`/api/v1/dispatch/trucks/${id}/detail`)), staleTime: 10_000 });
}
export function useDispatchInvoices() {
  const { api } = useBrokerage();
  return useQuery({ queryKey: dispatchKeys.invoices, queryFn: async () => (await responseData<{ invoices: DispatchInvoice[] }>(await api("/api/v1/dispatch/invoices"))).invoices, staleTime: 15_000 });
}
export function useDispatchDirectory(enabled = true) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: dispatchKeys.directory, queryFn: async () => responseData<DispatchDirectory>(await api("/api/v1/dispatch/directory")), staleTime: 60_000, enabled });
}
