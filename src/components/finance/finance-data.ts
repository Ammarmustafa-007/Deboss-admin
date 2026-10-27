"use client";

import { useQuery } from "@tanstack/react-query";
import { responseData, useApi } from "@/lib/api";

export type RoleKey = "BROKERAGE_SALES_AGENT" | "BROKERAGE_SALES_MANAGER" | "BROKERAGE_OPERATIONS_AGENT" | "BROKERAGE_OPERATIONS_MANAGER" | "BROKERAGE_FRONTER_AGENT" | "BROKERAGE_FRONTER_MANAGER" | "DISPATCH_SALES_AGENT" | "DISPATCH_SALES_MANAGER" | "DISPATCHER" | "DISPATCH_MANAGER";
export type Basis = "APPROVED_GROSS" | "COLLECTED";
export type Setting = { base_salary: number; commission_rate: number; commission_basis: Basis; updated_at?: string };
export type StaffMember = { id: string; full_name: string; email: string; is_active: boolean; department_name: string | null; role_key: RoleKey };
export type CompensationData = { roles: { role_key: RoleKey; people: number; setting: Setting | null }[]; overrides: ({ user_id: string } & Setting)[]; people: StaffMember[] };
export type PayrollItem = { reference: string; customer: string | null; amount: number; date: string | null };
export type PayrollLine = { user_id: string; full_name: string; role_key: RoleKey; department_id: string | null; department_name: string | null; base_salary: number; commission_basis: Basis; commission_rate: number; basis_amount: number; commission_amount: number; total: number; configured: boolean; items: PayrollItem[] };
export type Totals = { people: number; base: number; commission: number; total: number };
export type DepartmentTotal = { department_id: string | null; name: string; people: number; base: number; commission: number; total: number };
export type PayrollData = { period: string; status: "DRAFT" | "FINALIZED"; finalized_at: string | null; finalized_by_name: string | null; lines: PayrollLine[]; totals: Totals; departments: DepartmentTotal[] };
export type FinanceData = {
  period: string; invoiced: number; collected: number; approved_gross: number; outstanding: number; payroll: number; payroll_status: "DRAFT" | "FINALIZED"; operating_profit: number;
  departments: { id: string; name: string; function: string; business_unit?: string; revenue: number; collected: number | null; payroll: number; people: number }[];
  trend: { period: string; invoiced: number; collected: number; approved_gross: number; payroll: number; profit: number }[];
};
export type EarningsData = { period: string; status: "FINALIZED" | "ESTIMATE"; line: PayrollLine | null };

export const roleLabel: Record<RoleKey, string> = {
  BROKERAGE_SALES_AGENT: "Brokerage Sales Agent",
  BROKERAGE_SALES_MANAGER: "Brokerage Sales Manager",
  BROKERAGE_OPERATIONS_AGENT: "Brokerage Operations Agent",
  BROKERAGE_OPERATIONS_MANAGER: "Brokerage Operations Manager",
  BROKERAGE_FRONTER_AGENT: "Brokerage Fronter",
  BROKERAGE_FRONTER_MANAGER: "Brokerage Fronter Manager",
  DISPATCH_SALES_AGENT: "Dispatch Sales Agent",
  DISPATCH_SALES_MANAGER: "Dispatch Sales Manager",
  DISPATCHER: "Dispatcher",
  DISPATCH_MANAGER: "Dispatch Manager",
};

export const basisLabel: Record<Basis, string> = { APPROVED_GROSS: "Approved gross", COLLECTED: "Collected" };

/** What the commission basis counts for a role, in one line. */
export function basisDescription(basis: Basis, role?: RoleKey) {
  const scope = role?.endsWith("MANAGER") ? "the whole department" : "their own records";
  if (basis === "COLLECTED") return `Payments received in the month, for ${scope}.`;
  if (role?.startsWith("DISPATCH")) return `Weekly invoices signed off by the Dispatch Sales Manager in the month, for ${scope}.`;
  if (role?.includes("FRONTER")) return `${basis === "APPROVED_GROSS" ? "Approved shipments" : "Payments"} of customers that came from mined leads, for ${scope}.`;
  return role?.includes("OPERATIONS") ? `Invoices issued on delivered shipments in the month, for ${scope}.` : `Shipments approved by a manager in the month, for ${scope}.`;
}

export const currentPeriod = () => new Date().toISOString().slice(0, 7);
export function shiftPeriod(period: string, months: number) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7);
}
export function periodLabel(period: string, short = false) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: short ? "short" : "long", year: short ? "2-digit" : "numeric", timeZone: "UTC" });
}

export function useCompensation() {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "compensation"], queryFn: async () => responseData<CompensationData>(await api("/api/v1/admin/compensation")) });
}
export function usePayroll(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "payroll", period], queryFn: async () => responseData<PayrollData>(await api(`/api/v1/admin/payroll?period=${period}`)) });
}
export function useFinance(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "finance", period], queryFn: async () => responseData<FinanceData>(await api(`/api/v1/admin/finance?period=${period}`)) });
}
export function useMyEarnings(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["brokerage", "my-earnings", period], queryFn: async () => responseData<EarningsData>(await api(`/api/v1/me/earnings?period=${period}`)) });
}

const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Currency with cents, for salary and commission figures. */
export function cash(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return exact.format(Number.isFinite(number) ? number : 0);
}
