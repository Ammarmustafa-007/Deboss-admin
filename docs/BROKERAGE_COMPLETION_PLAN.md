# Brokerage Completion Plan

This plan is the implementation gate for Brokerage. A phase is complete only when its database dependency, API behavior, role permissions, UI states, and production build validation are complete.

## Phase 1: Shared Foundation

1. Confirm migrations 001 through 007 are applied in order.
2. Remove duplicate or inactive Brokerage UI paths and make the active workbench the single role-aware entry point.
3. Connect Operations, Teams, and Invoice workspaces through the active Brokerage navigation.
4. Replace temporary TypeScript suppression with typed request/response boundaries.

## Phase 2: Manager Control Plane

1. Complete Team Builder editing: add/remove members, replace Team Lead, edit permissions, archive/restore.
2. Add departmental Agent access management with direct permission grant/revoke and account activation controls.
3. Add Operations assignment board for Agents and teams.

## Phase 3: Sales Lifecycle

1. Complete lead edit, assignment/reassignment, archive, follow-up, callback, appointment, and activity timeline.
2. Complete customer workspace with contact details, activity/shipment history, and comments.
3. Complete quote rework, rejection reason, history, comments, secure attachments, approval, and handoff.

## Phase 4: Operations Lifecycle

1. Complete shipment status and assignment workflow.
2. Complete document upload, private preview/download, verification/rejection, and timeline.
3. Complete exception owner, resolution, notes, and history.
4. Complete finance values, invoice generation, invoice ledger, payment lifecycle, and overdue handling.

## Phase 5: Oversight and Verification

1. Complete reports by agent, team, manager, customer, department, and timeframe; add CSV/Excel-compatible export and allowed bulk actions.
2. Complete notifications for assignments, approvals, comments, exceptions, and overdue invoices.
3. Verify Super Admin cross-Brokerage oversight and audit history.
4. Run role-by-role acceptance tests on desktop and mobile: Super Admin, Sales Manager, Sales Agent, Operations Manager, Operations Agent, and delegated Team Lead.

No Brokerage completion report is issued until every Phase 1-5 item is checked against the running frontend, backend, and Supabase schema.
