"use client";

import { useQuery } from "@tanstack/react-query";
import { responseData, useApi } from "@/lib/api";

export type RoleKey = "BROKERAGE_SALES_AGENT" | "BROKERAGE_SALES_MANAGER" | "BROKERAGE_OPERATIONS_AGENT" | "BROKERAGE_OPERATIONS_MANAGER" | "BROKERAGE_FRONTER_AGENT" | "BROKERAGE_FRONTER_MANAGER" | "DISPATCH_SALES_AGENT" | "DISPATCH_SALES_MANAGER" | "DISPATCHER" | "DISPATCH_MANAGER";
export type Tier = { from: number; rate: number };
export type HrRules = {
  dispatch_sales: { min_active_sales: number; rate: number };
  dispatcher: { tiers: Tier[] }; brokerage_sales: { tiers: Tier[] }; brokerage_operations: { tiers: Tier[] };
  fronter_per_lead_pkr: number;
  manager_share: { DISPATCH_SALES_MANAGER: number; DISPATCH_MANAGER: number; BROKERAGE_SALES_MANAGER: number; BROKERAGE_OPERATIONS_MANAGER: number };
  paid_leaves_per_month: number;
};
export type ExitType = "NOTICE_SERVED" | "NO_NOTICE" | "FIRED";
export type Employee = { id: string; full_name: string; email: string; is_active: boolean; department_id: string | null; department_name: string | null; role_key: RoleKey; base_salary_pkr: number; configured: boolean; joined_on: string; manager_id: string | null; last_working_day: string | null; exit_type: ExitType | null };
export type PayrollItem = { reference: string; customer: string | null; amount: number; date: string | null };
export type LineDetail = {
  usd_to_pkr: number | null; joined_on: string; last_working_day: string | null; exit_type: ExitType | null; on_probation: boolean;
  working_days: number; employed_days: number; days_worked: number; leave_days: number; absent_days: number; paid_leave_used: number; unpaid_absences: number;
  base_earned: number; leave_deduction: number; gross: number; active_sales: number | null; qualified_leads: number | null;
  commission_usd: number; commission_pkr: number; profit_share_percent: number; profit_share_usd: number; profit_share_pkr: number; net_pay_pkr: number; net_pay_usd: number | null;
};
export type PayrollLine = { user_id: string; full_name: string; role_key: RoleKey; department_id: string | null; department_name: string | null; base_salary: number; commission_rate: number; basis_amount: number; commission_amount: number; total: number; configured: boolean; items: PayrollItem[]; detail: LineDetail | null };
export type Totals = { people: number; base: number; commission: number; total: number; total_usd: number };
export type DepartmentTotal = { department_id: string | null; name: string; people: number; base: number; commission: number; total: number };
export type DepartmentPl = { department_id: string; manager_id: string | null; unassigned: boolean; name: string; business_unit: string; function: string; people: number; income: number; salaries: number; commissions: number; costs: { name: string; amount: number }[]; other_costs: number; total_costs: number; net_profit: number; manager_share_percent: number; manager_share: number };
export type PayrollData = { period: string; status: "DRAFT" | "FINALIZED"; finalized_at: string | null; finalized_by_name: string | null; usd_to_pkr: number | null; department_pl: DepartmentPl[]; lines: PayrollLine[]; totals: Totals; departments: DepartmentTotal[] };
export type CostType = "COMPANY_SHARED" | "ONE_DEPARTMENT" | "TWO_DEPARTMENTS" | "COMPANY_ONLY";
export type Cost = { id: string; name: string; amount: number; currency: "USD" | "PKR"; cost_type: CostType; department_ids: string[] };
export type CostsData = { period: string; locked: boolean; usd_to_pkr: number | null; costs: Cost[]; departments: { id: string; name: string }[]; department_pl: DepartmentPl[] };
export type AttendanceStatus = "PRESENT" | "LEAVE" | "ABSENT";
export type AttendanceData = { period: string; days: string[]; people: { id: string; full_name: string; department_name: string | null; joined_on: string; last_working_day: string | null }[]; records: { user_id: string; work_date: string; status: "LEAVE" | "ABSENT" }[]; locked: boolean; paid_leaves: number };
export type Progress = {
  user_id: string; full_name: string; role_key: RoleKey; department_name: string | null; gross: number; active_sales: number | null; qualified_leads: number | null;
  target: number | null; rate: number | null; reached: boolean; next_level: number | null; next_rate: number | null; to_next: number | null; active_sales_target?: number; sales_to_target?: number;
};
export type FinanceData = {
  period: string; invoiced: number; collected: number; approved_gross: number; outstanding: number; payroll: number; payroll_status: "DRAFT" | "FINALIZED"; operating_profit: number;
  departments: { id: string; name: string; function: string; business_unit?: string; revenue: number; collected: number | null; payroll: number; people: number }[];
  trend: { period: string; invoiced: number; collected: number; approved_gross: number; payroll: number; profit: number }[];
};

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

export const exitLabel: Record<ExitType, string> = { NOTICE_SERVED: "Served full notice", NO_NOTICE: "Left without notice", FIRED: "Fired" };
export const costTypeLabel: Record<CostType, string> = { COMPANY_SHARED: "Company-wide shared", ONE_DEPARTMENT: "One department", TWO_DEPARTMENTS: "Two departments", COMPANY_ONLY: "Company only" };

export const currentPeriod = () => new Date().toISOString().slice(0, 7);
export function shiftPeriod(period: string, months: number) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7);
}
export function periodLabel(period: string, short = false) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: short ? "short" : "long", year: short ? "2-digit" : "numeric", timeZone: "UTC" });
}

export function useEmployees() {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "employees"], queryFn: async () => responseData<{ employees: Employee[] }>(await api("/api/v1/admin/hr/employees")) });
}
export function useHrRules() {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "hr-rules"], queryFn: async () => responseData<{ rules: HrRules }>(await api("/api/v1/admin/hr/rules")) });
}
export function useCosts(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "costs", period], queryFn: async () => responseData<CostsData>(await api(`/api/v1/admin/costs?period=${period}`)) });
}
export function useAttendance(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "attendance", period], queryFn: async () => responseData<AttendanceData>(await api(`/api/v1/attendance?period=${period}`)) });
}
export function useTeamPerformance(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "team-performance", period], queryFn: async () => responseData<{ period: string; people: Progress[] }>(await api(`/api/v1/performance/team?period=${period}`)) });
}
export function usePayroll(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "payroll", period], queryFn: async () => responseData<PayrollData>(await api(`/api/v1/admin/payroll?period=${period}`)) });
}
export function useFinance(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["admin", "finance", period], queryFn: async () => responseData<FinanceData>(await api(`/api/v1/admin/finance?period=${period}`)) });
}
export function useMyPerformance(period: string) {
  const api = useApi();
  return useQuery({ queryKey: ["brokerage", "my-performance", period], queryFn: async () => responseData<{ period: string; progress: Progress | null }>(await api(`/api/v1/me/performance?period=${period}`)) });
}

const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Currency with cents, for salary and commission figures. */
export function cash(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return exact.format(Number.isFinite(number) ? number : 0);
}

const rupees = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
/** Salaries and net pay are in Pakistani rupees. */
export function pkr(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return rupees.format(Number.isFinite(number) ? number : 0);
}
