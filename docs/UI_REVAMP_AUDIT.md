# DEBOSS Admin — UI/UX Audit & Revamp Plan

Scope: `Deboss-admin` (Next.js 16, React 19, Tailwind 4, TanStack Query, Supabase auth).
Design reference: `DEBOSS_GLOBAL_LOGIN.html` and `DEBOSS_GLOBAL_CRM_PROTOTYPE.html`.

Ground rules for the revamp:
- **No new input fields, no new business logic, no new API calls.** Every form keeps the same fields and sends the same payload to the same endpoint.
- UX logic (how screens are split, the order of steps, what is shown when) can change.
- Remove explanatory paragraphs. Keep status signals such as "Awaiting quote approval", "Needs assignment" and "Exception open".
- Reports: re-skin only, no structural changes.

---

## 1. What exists today

### Entry points
| Route | Who | What it renders |
|---|---|---|
| `/` | everyone | Login |
| `/app` | Super Admin | Tabbed admin: Departments, Users, Brokerage overview, Settings |
| `/app` | everyone else | `BrokerageCommandCenter` (role-aware single page) |
| `/app/brokerage`, `/app/operations`, `/app/teams`, `/app/access`, `/app/invoices` | direct URL only | Standalone copies of panels, without the sidebar or header |

### Brokerage command center (all non-admin roles)
Navigation is a `useState("overview")` switch, not URLs. Sections: Overview · How work arrives · Sales workspace · Customers · Operations board · Invoice ledger · Teams & leads · Agent access · Reports · Notifications.

API check: all 40+ endpoints the UI calls exist in `Deboss-backend-`. No broken calls were found.

---

## 2. Structural problems

| # | Problem | Impact |
|---|---|---|
| S1 | **Every workspace is a split screen**: list on the left and the selected record on the right (Sales agent, Sales manager, Customers, Operations board). The Sales agent screen also keeps the full "New lead" form open above the list at all times. | The issue you described. Nothing has its own screen, everything is cramped, and the first record is auto-selected. |
| S2 | **No URLs per screen.** Sections and selected records live in React state. | The browser Back button leaves the app. Refreshing the page always returns to Overview. You can't link to a lead or shipment. |
| S3 | **No navigation below 1024px.** The sidebar is `hidden lg:flex` and there's no mobile menu (Super Admin and Brokerage). | On a tablet or phone you can't reach any screen except the default one. |
| S4 | **Quotes are accordions nested three levels deep:** Lead → Quote card → expand → approve/handoff form. | The manager approval and handoff flow is hard to find and gives no sense of progress. |
| S5 | **~72 KB of dead code:** `brokerage-console.tsx`, `brokerage-hub.tsx` and `brokerage-workbench.tsx` are never imported. `app/page.tsx` contains unused `TeamWorkspace` and `BrokerageWorkspace`. `operations/page.tsx` and `teams/page.tsx` have unreachable code after `return`. | Confusing to maintain, and it has to go before the revamp. |
| S6 | **One 97 KB file** (`brokerage-command-center.tsx`) with single-line components, `any` everywhere, and the `api()` helper copy-pasted 7 times. | Every UI change is risky. |
| S7 | **Wall-of-text UI.** Nearly every card has a paragraph explaining permissions. The whole "How work arrives" page is explanation. | Feels old-fashioned and slows people down. |
| S8 | **Brand drift.** The app uses `#f59a18` and `#a65c00`; the brand and prototype use `#F7941D`. The sidebar logo is a generic `Building2` icon instead of the DG mark. The layout loads Geist, but `globals.css` forces `Arial`, so Geist never renders (the prototype uses Poppins). | Looks generic and off-brand. |
| S9 | **Global hover jump.** Every `<button>` lifts 1px and gains a shadow on hover, including nav items and small text links. | Feels jittery. |

## 3. Bugs found

| # | Bug | Where |
|---|---|---|
| B1 | **Follow-up times drift on every save.** `localInput()` fills `datetime-local` using `toISOString()` (UTC), then saves it back as local time. In PKT (UTC+5), each "Update lead information" moves the follow-up 5 hours earlier, even if nobody touched it. | `brokerage-command-center.tsx:695` |
| B2 | Rules-of-hooks violation: `LeadDetail` returns `ManagerLeadReview` *before* calling its own hooks. | `brokerage-command-center.tsx:220` |
| B3 | Pending spinners never show for lead activity complete/delete or comment delete. The busy keys (`PATCH:/api/...`) don't match what `Timeline`/`CommentList` look for (`activity:…`, `delete-comment:…`). Users can click twice. | `:239`, `:684-685` |
| B4 | The header title shows "Brokerage" on the "How work arrives" page because `titleFor` has no `workflow` entry. | `:694` |
| B5 | Missing rates show **$0** (`money(null)`). Quote cards show raw `"$" + value` with no formatting. | `:442`, `:576`, `:696` |
| B6 | Operations shipment comments show only the text, with no author or time (Sales comments show both). | `operations-board.tsx:118` |
| B7 | Operations board uses an inline banner at the top of the page for success/error messages. When you're scrolled into a shipment, you never see it. The rest of the app uses toasts. | `operations-board.tsx:69` |
| B8 | File pickers are `<label>` elements with a hidden `<input>`, so you can't reach them with the keyboard. | Quote attachments, shipment documents |
| B9 | Super Admin tables use fixed `grid-cols-4/5` and overflow on smaller screens. | `app/app/page.tsx` `DataList`, `UserList` |
| B10 | After conversion, the "Convert to customer" button becomes "Refresh customer", which still calls `/convert`. The label is misleading. | `:329` |

None of these needs a backend change.

---

## 4. Design system (taken from the prototypes)

**Tokens:** `--or #F7941D` (primary), `--ink #111`, `--bg #F5F4F1`, `--ln #E6E3DD`, `--mu #5F5B53`. Status colours: teal `#0FB5A6`, violet `#7C5CFC`, sky `#2E90FA`, rose `#F43F6E`, green `#22A860`.
**Type:** Poppins 400–800 (via `next/font`).
**Shape:** cards 14px radius, 1px `--ln` border, white. Controls 10px radius, 44px tall, orange focus ring.
**Components to build once and reuse:**
- AppShell: dark gradient sidebar with orange active pill, the real DG logo, and a user block at the bottom. Mobile gets a drawer.
- PageHeader: breadcrumb, title, one-line subtitle, and actions on the right.
- KPI card: coloured top border, icon tile, value, and optional sparkline.
- DataTable: search, tabs with counts, clickable rows, empty state, pagination.
- Chip: status colour map, e.g. QUOTED→violet, BOOKED→orange, DELIVERED→sky, PAID→green, EXCEPTION→rose.
- Stepper: done / current / upcoming (`.stp` in the prototype).
- Tabs, Segmented control, Drawer, Modal, Toast stack, Skeletons.
- Button variants: primary gradient, ink, outline, danger, small.

**Login:** port the prototype directly. Dark background, animated globe canvas, light glass card, Caps Lock hint, inline field errors. It keeps the same two fields and the same Supabase call.

---

## 5. New information architecture

Each list becomes its own screen, and each record gets its own detail page. Real routes, so Back and Refresh work.

```
/                              Login
/app                           Dashboard (role-aware)
/app/sales                     Leads list          (+ "New lead" → /app/sales/new)
/app/sales/new                 New lead form (same 7 fields), step 1 Company & contact → step 2 Forecast & follow-up
/app/sales/leads/[id]          Lead detail
/app/customers                 Customers list
/app/customers/[id]            Customer profile (read-only, as today)
/app/operations                Shipments list
/app/operations/[id]           Shipment detail
/app/invoices                  Invoice ledger
/app/teams                     Teams list          (+ /app/teams/new, /app/teams/[id])
/app/access                    Agent access
/app/reports                   Reports (re-skin only)
/app/notifications             Notifications
/app/admin/departments         Super Admin
/app/admin/users               Super Admin        (+ /app/admin/users/new, /[id])
/app/admin/brokerage           Super Admin oversight
/app/settings                  Change password
```
"How work arrives" is removed. What it explained is shown in context instead (a stepper on each record, and status chips).

### Sales — leads list
Full-width table with columns Company · Contact · Stage chip · **Next action chip** · Follow-up · Forecast.
Tabs: All · New · Contacted · Qualified · Customer · Lost, each with a count. Managers also get a **Needs review (n)** tab and a "Ready for Operations (n)" tab.
"Next action" reuses the existing `managerLeadState` logic: *Awaiting quote approval*, *Ready to hand off*, *Agent rework*, *With Operations*, *Draft*. Clicking a row opens the lead.

### Sales — lead detail
- Header: company, contact, stage chip, Archive/Restore. Below it, a **journey stepper**: Lead → Contacted → Qualified → Customer → Quote submitted → Approved → With Operations. Every step is derived from data the page already has.
- Tabs:
  1. **Overview**: lead info form (same 7 fields) and the stage change control.
  2. **Activity**: add activity (same 3 inputs) and the timeline.
  3. **Comments**.
  4. **Customer & shipments**: shown after conversion. Before conversion it shows a single "Convert to customer" call to action.
- Shipment rows open a **shipment/quote panel** (a drawer) with:
  - its own stepper: Draft → Submitted → Approved → Handed off
  - the edit form (same fields)
  - attachments, comments and revision history
- The manager flow inside that panel is two explicit steps:
  - **Step 1, Review & decide:** Approve, or Return with a reason (the reason field already exists).
  - **Step 2, Hand off:** department, reference and customer name (the existing 3 fields).

### Operations — shipments list
Table: Reference · Customer · Lane · Status chip · Assignee · Docs pending · Exception flag.
Tabs by status, plus **Needs assignment**. Managers keep the inline Agent and Team assignment selects in the row, since that's a quick action. Clicking a row opens the shipment detail page.

### Operations — shipment detail
- Header: reference, lane, a status stepper (BOOKED → … → COMPLETED, with EXCEPTION shown as a red state), and the status select.
- Manager summary chips: Assignment / Documents / Exception.
- Tabs:
  - **Details & finance**: the same 7 fields plus invoice-ready.
  - **Documents**: type plus upload, and verify/return.
  - **Exception**.
  - **Comments & timeline**.

### Invoices
A table where every row is read-only. Edit opens a drawer with the same 4 fields (amount, paid, due date, status). This replaces the current wall of inputs.

### Teams
List of teams → editor as a three-step wizard:
1. **Name & members**
2. **Team Lead**
3. **Delegated permissions**, with readable labels such as "Review quotes" instead of `sales · quotes · review`. The labels already exist in the dead `teams/page.tsx`.

### Agent access
A clean list: avatar, name, email, status chip, and Revoke/Restore. The two explanation cards are removed.

### Super Admin
- Departments and Users become tables with "New" buttons that open a modal (Users: step 1 Identity → step 2 Role & department).
- Clicking a user opens a user detail page with the same edit fields and Deactivate/Restore.
- Brokerage overview becomes a dashboard in the prototype's style.
- Settings keeps just the password card.

### Dashboard (all roles)
KPI row in prototype style, an "Needs your attention" list built from existing data (submitted quotes, exceptions, unread notifications, follow-ups due), and a recent-queue table. No paragraphs.

---

## 6. Implementation phases

| Phase | Work | Risk |
|---|---|---|
| 0 | Delete dead code. Add tokens and Poppins. Build the shared UI kit, one typed `useApi()` client and the responsive AppShell. Fix the global hover CSS. | Low |
| 1 | Move sections to real App Router routes under a shared `/app` layout that does the role check once. (Next 16 + `cacheComponents`: read `node_modules/next/dist/docs` first, per AGENTS.md.) | Medium |
| 2 | Login and splash screen ported from the prototype. | Low |
| 3 | Sales: leads list, new lead, lead detail, shipment/quote drawer, manager review and handoff. Fix B1–B5 and B10. | High (largest surface) |
| 4 | Operations: list, shipment detail, invoices. Fix B6–B8. | Medium |
| 5 | Teams wizard, Agent access, Super Admin screens. Fix B9. | Low |
| 6 | Dashboard, Notifications, Reports re-skin. | Low |
| 7 | `npm run build` and lint, then a role-by-role click-through: Super Admin, Sales Manager, Sales Agent, Ops Manager, Ops Agent, Team Lead. Test desktop and mobile widths. | — |

Each phase ships on its own commit and can be reviewed in the browser before moving on.
