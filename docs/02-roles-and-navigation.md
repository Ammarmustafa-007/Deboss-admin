# 2. Roles and navigation

The front end never decides permissions by itself. It reads who the person is and what they may do from the backend, and builds the menu and buttons from that. The API re-checks every action anyway. Roles, departments and the permission rules are defined in the backend's `docs/02-roles-and-access.md`.

## 2.1 Where the facts come from

| Source | Gives | Used through |
|---|---|---|
| Supabase `profiles` row (loaded by `SessionGate`) | Name, email, role, active, department (business unit, function) | `useSession()`: `profile`, `isSuperAdmin` |
| `GET /api/v1/brokerage/workspace` (loaded by `BrokerageGate`, everyone except the Super Admin) | `unit` (Brokerage, `FRONTER`, `DISPATCH`), teams, permission keys, `capabilities` | `useBrokerage()` |

`useBrokerage()` returns: `workspace`, `notifications`, `unread`, `api`, `report`, and these flags:

| Flag | Meaning |
|---|---|
| `sales` | In a Sales department (Brokerage or Dispatch) |
| `manager` | Department manager |
| `teamLead` | Team Lead of at least one team |
| `fullLead` | Team Lead with any approval-level permission ("Team lead · Full access") |
| `fronter` | In a Fronter department |
| `dispatch` | In the Dispatch business unit |

The header shows the area (for example "Dispatch · Operations", "Brokerage · Fronters", "Administration") and the role label: Super Admin, Department manager, Team lead, Team lead · Full access, or Agent.

## 2.2 Which dashboard

`/app` (`src/app/app/page.tsx`) picks the dashboard:

| Who | Dashboard |
|---|---|
| Super Admin | `AdminDashboard` (company finance overview) |
| Dispatch | `DispatchDashboard` (`components/dispatch/insights.tsx`) |
| Fronter | `FronterDashboard` |
| Brokerage | `BrokerageDashboard` (Sales or Operations version) |

## 2.3 The menu per role

Built in `components/app/navigation.ts`. Every workspace also gets **Chat** at the end of its first group. "Notifications" is a hidden item, opened from the header bell.

### Super Admin (`adminNavigation`)

| Group | Items |
|---|---|
| Overview | Dashboard, Chat |
| Administration | Departments, Users |
| Finance | Payroll, Attendance, Costs and P&L, Performance, Compensation |
| Account | Communication, Settings |

### Brokerage Sales (`brokerageNavigation`, `sales`)

| Group | Agent / Team Lead | Manager adds |
|---|---|---|
| Workspace | Dashboard, Sales, Customers, Fronter mining sheet, Commodities, Chat | |
| Management | | Teams, Agent access, Attendance, Team performance |
| Insights | Reports | |

### Brokerage Operations (`brokerageNavigation`, not `sales`)

| Group | Agent / Team Lead | Manager adds |
|---|---|---|
| Workspace | Dashboard, Operations, Chat. **Invoices** for managers and for leads with billing access (`canMarkInvoiceReady`) | Customers (read-only profiles of their department's customers) |
| Management | | Teams, Agent access, Attendance, Team performance |
| Insights | Reports | |

### Fronters (`fronterNavigation`)

| Group | Fronter | Manager adds |
|---|---|---|
| Workspace | Dashboard, Lead mining, Commodities, Chat | |
| Management | | Teams, Fronter access, Attendance, Team performance |

Fronters have **no Reports** (client request).

### Dispatch Sales (`dispatchNavigation`, `sales`)

| Group | Agent | Manager adds |
|---|---|---|
| Workspace | Dashboard, Carriers, Do-not-call list, Chat. **Invoices** only with sign-off rights (`canSignOffInvoices`), so never for a plain agent | Invoices |
| Management | | Teams, Agent access, Targets, Attendance, Team performance |
| Insights | Reports | |

### Dispatch Operations (`dispatchNavigation`, not `sales`)

| Group | Dispatcher | Manager adds |
|---|---|---|
| Workspace | Dashboard, Trucks, Loads, Invoices, Do-not-call list, Chat | |
| Management | | Teams, Dispatcher access, Targets, Attendance, Team performance |
| Insights | Reports (Carriers is reachable from a truck, hidden from the menu) | |

## 2.4 Route gating

A route is shown only if it belongs to the person's menu. `AppShell` finds the menu item for the current path (`activeItem()`: exact match for `/app`, otherwise the longest matching prefix, hidden items included). If there is none, it renders **"This area isn't part of your workspace"** instead of the page. So a Fronter opening `/app/reports`, or a Dispatch Sales Agent opening `/app/dispatch/invoices`, sees that message, and the API would refuse the data anyway.

Inside a screen, buttons follow `workspace.capabilities` and the `rights` objects detail endpoints return (for example a truck's `rights.update`, an invoice's `rights.edit`, a carrier's `rights.money_hidden`).

## 2.5 Money visibility

| Person | Never shown |
|---|---|
| Any employee | Salaries, payslips, commission amounts, profit share. "My performance" shows progress only |
| Brokerage Sales Agent | Gross on the dashboard (shows customers onboarded instead), quoted and agreed rates in Reports, exports |
| Dispatch Sales Agent | Invoices, gross, revenue, load lists. Dashboard and Reports show active sales and sales targets instead (`report.money_hidden`, `rights.money_hidden`) |
| Brokerage Sales | Who the carrier is on a load (only the carrier rate and profit) |
| Managers | Department P&L and costs (Super Admin only) |

The backend removes these fields from its responses; the screens simply don't render what isn't there.
