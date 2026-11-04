# 3. Routes and screens

Every `page.tsx` under `src/app` only renders a screen component from `src/components`. Pages that take an id (`[id]`) pass `params` straight to the screen, which reads it with React's `use()`.

## 3.1 Routes

| Route | Screen component | Who | What it is |
|---|---|---|---|
| `/` | `app/page.tsx` | Everyone | Sign-in |
| `/app` | `AdminDashboard`, `DispatchDashboard`, `FronterDashboard` or `BrokerageDashboard` | Everyone | Dashboard for the person's area (see [02-roles-and-navigation.md](02-roles-and-navigation.md#22-which-dashboard)) |
| `/app/notifications` | `NotificationsScreen` (`dashboard/notifications-screen`) | Staff | All notifications |
| `/app/reports` | `ReportsScreen`, `DispatchReportsScreen` or `FronterReportsScreen` | Brokerage, Dispatch | Reports for the person's area and scope |
| `/app/chat` | `ChatScreen` (`chat/chat-screen`) | Everyone | Direct messages, team groups, channels |
| `/app/settings` | `SettingsScreen` (`admin/settings-screen`, `admin/brokerage-settings`) | Super Admin | Password, and the **Brokerage Sales Manager** switch |
| **Administration** | | | |
| `/app/admin/departments` | `DepartmentsScreen` | Super Admin | List and create departments (directly in Supabase) |
| `/app/admin/users`, `/app/admin/users/[id]` | `UsersScreen`, `UserRoute` (`admin/users-screen`) | Super Admin | Users: create (with a Fronter's Sales agent), edit access, deactivate, delete |
| `/app/admin/communication` | `CommunicationScreen` (`chat/communication-screen`) | Super Admin | Every team group and its members |
| **HR and payroll** | | | |
| `/app/admin/payroll` | `PayrollScreen` (`finance/payroll-screen`) | Super Admin | Month's payroll, USD→PKR rate, finalize / reopen, Excel export, payslips |
| `/app/admin/compensation` | `CompensationScreen` | Super Admin | Employees tab (base salary, joining date, manager, exit) and Commission rules tab |
| `/app/admin/attendance`, `/app/attendance` | `AttendanceScreen` | Super Admin, managers | Monthly grid: click a day to cycle Absent → Leave → Present |
| `/app/admin/costs` | `CostsScreen` | Super Admin | Monthly costs and the department P&L |
| `/app/admin/performance`, `/app/team-performance` | `TeamPerformanceScreen` | Super Admin, managers | Progress towards commission levels |
| **Teams** | | | |
| `/app/teams`, `/app/teams/new`, `/app/teams/[id]` | `TeamsScreen`, `TeamWizard`, `TeamRoute` (`teams/teams-screens`) | Managers | Teams, members, Team Lead and their Partial / Full access |
| `/app/access` | `AgentAccessScreen` (`teams/agent-access-screen`) | Managers | Add an agent login to the department, revoke or restore agents |
| **Brokerage Sales** | | | |
| `/app/sales` | `LeadsScreen` (`sales/leads-screen`) | Sales | Leads (list and sheet views), bulk changes, import |
| `/app/sales/new` | `NewLeadScreen` | Sales | New lead |
| `/app/sales/leads/[id]` | `LeadRoute` (`sales/lead-screen`) | Sales | A lead: details, status, activities, comments, customer, loads and quotes |
| `/app/customers`, `/app/customers/[id]` | `CustomersScreen`, `CustomerRoute` (`sales/customers-screen`) | Sales | Customers and one customer's profile, loads and Operations progress |
| `/app/sales/mining` | `MiningScreen` with `salesView` (`fronter/fronter-screens`) | Sales | **Fronter mining sheet**: the linked Fronters' rows, editable (no adding or deleting) |
| **Brokerage Operations** | | | |
| `/app/operations`, `/app/operations/[id]` | `ShipmentsScreen`, `ShipmentRoute` (`operations/…`) | Operations | Loads board and one load: status, carrier, documents, exception, invoice, Operations review |
| `/app/invoices` | `InvoicesScreen` (`operations/invoices-screen`) | Operations managers, billing leads | Invoices and their status |
| **Fronters** | | | |
| `/app/fronter` | `MiningScreen` | Fronters | Lead mining list (editable in place) and full-screen sheet |
| `/app/fronter/commodities` | `CommoditiesScreen` | Fronters | Commodities sheet |
| **Dispatch** | | | |
| `/app/dispatch/carriers`, `/new`, `/[id]` | `CarriersScreen`, `NewCarrierScreen`, `CarrierScreen` | Dispatch Sales (and Operations through trucks) | Carriers, new carrier, one carrier: summary, profile and terms, trucks (active-sale state), documents, activities, comments, invoices, assignment, review |
| `/app/dispatch/trucks`, `/[id]` | `TrucksScreen`, `TruckScreen` | Dispatch Operations | Dispatch board (Trucks / **By company** views) and one truck: loads, invoices (choose loads), comments, assignment |
| `/app/dispatch/loads` | `LoadsScreen` (`dispatch/work-screens`) | Dispatch Operations | Search loads |
| `/app/dispatch/invoices` | `DispatchInvoicesScreen` | Dispatch Operations, Sales Managers | Invoices list and drawer: edit figures, add / remove loads, submit, recall, return, forward, pay, sign off, delete |
| `/app/dispatch/targets` | `TargetsScreen` | Dispatch managers | Weekly and monthly targets (sales counts or gross) |
| `/app/dispatch/dnc` | `DncScreen` | Dispatch | Do-Not-Call list |

## 3.2 Screens and the endpoints they call

Data hooks live next to the screens (`*-data.ts`, `model.ts`, `directory.ts`).

| Component file | Endpoints |
|---|---|
| `admin/admin-data.ts`, `admin/users-screen.tsx` | `GET/POST /users`, `PATCH/DELETE /users/:id`. Departments read from Supabase |
| `admin/departments-screen.tsx` | Supabase `departments` insert |
| `app/notification-bell.tsx`, `dashboard/notifications-screen.tsx` | `PATCH /brokerage/notifications/:id/read` |
| `dashboard/reports-screen.tsx` | `GET /brokerage/reports` |
| `chat/chat-data.ts`, `chat/chat-screen.tsx` | `GET /chat/inbox`, `GET /chat/conversations/:id/messages`, `POST /chat/direct`, `PATCH /chat/groups/:id`, `POST /chat/photo-upload-url`; Supabase `chat_messages` insert, realtime and typing |
| `chat/communication-screen.tsx` | `GET /admin/communication` |
| `sales/directory.ts` | `GET /brokerage/team-directory` |
| `sales/leads-screen.tsx`, `lead-bulk.tsx`, `lead-import.tsx`, `lead-details.tsx`, `new-lead-screen.tsx` | `POST /brokerage/leads`, `PATCH /brokerage/leads/:id` |
| `sales/lead-screen.tsx` | `GET /brokerage/leads/:id/detail`, `PATCH /brokerage/leads/:id`, activities, comments, `POST /brokerage/leads/:id/convert` |
| `sales/customers-screen.tsx`, `customer-panel.tsx`, `loads-sheet.tsx` | `GET /brokerage/customers`, customer profile, comments, `POST /brokerage/customers/:id/shipments`, `PATCH /brokerage/sales-shipments/:id`, quote submit and attachments, document download |
| `sales/quote-panel.tsx` | Quote detail, edit, comments, attachment download, customer profile |
| `operations/model.ts` | `GET /brokerage/operations-directory` |
| `operations/shipments-screen.tsx`, `shipment-screen.tsx` | `PATCH /brokerage/shipments/:id`, load detail, comments, documents (upload URL, record, review, download), invoice, Operations review, customer's Operations agent, Brokerage carriers list |
| `operations/invoices-screen.tsx` | `GET /brokerage/invoices`, `PATCH /brokerage/invoices/:id` |
| `fronter/fronter-screens.tsx` | `GET/POST /fronter/prospects`, `PATCH/DELETE /fronter/prospects/:id`, commodities, `GET /fronter/reports` |
| `dispatch/model.ts` | `GET /dispatch/carriers`, carrier detail, `GET /dispatch/directory`, `GET /dispatch/invoices`, `GET /dispatch/trucks`, truck detail |
| `dispatch/carriers-screen.tsx`, `carrier-screen.tsx` | Carrier create and edit, duplicates, trucks, documents, activities, submit, review, comments |
| `dispatch/trucks-screen.tsx`, `truck-screen.tsx` | `PATCH /dispatch/trucks/:id`, loads, `POST /dispatch/trucks/:id/invoices`, comments |
| `dispatch/work-screens.tsx` | Loads search, invoice detail / edit / delete / actions, targets, DNC, comments |
| `dispatch/insights.tsx` | `GET /dispatch/reports` |
| `finance/finance-data.ts` and screens | `/admin/hr/*`, `/admin/payroll*`, `/admin/costs*`, `/admin/finance`, `/attendance`, `/me/performance`, `/performance/team` |
| `teams/teams-screens.tsx` | `POST /brokerage/teams`, `PATCH /brokerage/teams/:id` |
| `teams/agent-access-screen.tsx` | `GET/POST /brokerage/department-users`, `PATCH /brokerage/department-users/:id` |

## 3.3 Notable screen behaviour

- **Fronter lead mining** (`MiningScreen`): the list is a spreadsheet grid (`fronter/sheet.tsx`). Company, Contact, Email, Website, Commodity are edited in place (Enter or leaving the cell saves); Status is a coloured dropdown; pasting several lines copied from Excel adds them as new rows; a row button opens every field in a drawer; "Open sheet" shows all columns full-screen. Qualified rows lock. With `salesView` (Sales' Fronter mining sheet) cells are editable but adding, pasting and deleting are off. There are no exports in the Fronter module.
- **Dispatch truck → Invoices tab:** tick the loads to bill (any week) and create the invoice. The invoice drawer edits figures, adds or removes loads, and runs the workflow buttons the caller's `rights` allow.
- **Dispatch board → By company:** groups the trucks list by carrier: trucks running, paid gross and miles this week, invoices received.
- **Payslips** (`finance/payslip.ts`): printed from a hidden iframe so pop-up blockers don't stop them; "Save as PDF" in the print dialog makes the file.
- **Brokerage Sales Agent:** the dashboard shows "Customers onboarded" this month (and how many are currently shipping) instead of My performance. The lead page has no Source or Forecast; its side panel holds Next follow-up and a **Notes** sticky note that saves as the agent types. Exports are hidden from agents (leads list, Reports).
- **Brokerage Sales Manager switch** (`workspace.capabilities.salesManagerApproval`): when off, the agent's load drawer shows **Hand off to Operations** (or "Hand off again" after an Operations rejection) instead of "Submit for approval", with a department picker only when the customer has none and there are several Operations departments; the quote steps drop "Sales Manager" (`quoteStepsFor()`), and the Operations reject dialog says it goes back to the agent.
- **Reports for agents:** current month only, no date range; managers keep the range and the export.
- **Attendance:** only working days are clickable, and days outside a person's employment are greyed out.
- **Excel exports** (`lib/excel.ts`) keep the on-screen columns, with totals rows. Dispatch Sales Agents' exports drop money columns.
