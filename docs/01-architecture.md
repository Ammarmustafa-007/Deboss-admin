# 1. Architecture

## Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Data | TanStack Query 5 |
| Auth and realtime | `@supabase/ssr`, `@supabase/supabase-js` |
| Styling | Tailwind CSS 4 with design tokens in `src/app/globals.css` (`@theme`) |
| Forms | Controlled React state (some screens use `react-hook-form` + zod) |
| Icons | `lucide-react` |
| Excel export | `exceljs` (`src/lib/excel.ts`) |

> `AGENTS.md`: this Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before using framework APIs.

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev        # http://localhost:3000 (the team runs it on 3100)
npm run build
npm run lint
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `NEXT_PUBLIC_API_URL` | Backend origin, for example `http://localhost:4000` |

The backend must list the front end's origin in its `FRONTEND_URL`.

## Folder layout

```
src/
  app/                    Routes. Each page.tsx only renders a screen component
    page.tsx              Sign-in page (/)
    app/                  Everything after sign-in (/app/...), see 03-routes-and-screens.md
    globals.css           Tailwind setup and design tokens
  proxy.ts                Next "proxy" (middleware): redirects /app/* to / without a Supabase session
  lib/
    api.ts                useApi(): authenticated fetch; responseData(), errorMessage()
    loaders.ts            Query keys and loaders for the profile, workspace, notifications
    supabase/client.ts    Browser Supabase client
    excel.ts              downloadExcel(): styled .xlsx export
    format.ts             money(), dateLabel(), dateTimeLabel(), isPast(), localInput()
    documents.ts          File type and size checks for uploads
    cn.ts                 class name merge
  components/
    app/                  Shell, session, workspace context, navigation, notification bell
    ui/                   Buttons, fields, cards, chips, tabs, modals, drawers, toasts, motion
    admin/                Users, departments, settings
    dashboard/            Dashboards, reports, notifications
    sales/                Brokerage Sales: leads, lead page, customers, loads, quotes
    operations/           Brokerage Operations: loads, load page, invoices
    fronter/              Lead mining sheet, commodities, Fronter dashboard; sheet.tsx (spreadsheet grid)
    dispatch/             Carriers, trucks, loads, invoices, targets, DNC, dashboard, reports
    chat/                 Chat and the Super Admin's Communication page
    teams/                Teams, team wizard, Agent access
    finance/              HR and payroll: payroll, compensation, attendance, costs and P&L, performance, payslips
    login/                Sign-in globe animation
```

## Sign-in and session

1. `/` signs in with Supabase email and password (`supabase.auth.signInWithPassword`), then pre-loads the workspace (`warmWorkspace`).
2. `src/proxy.ts` runs on every `/app/*` request on the server: without a Supabase user it redirects to `/`.
3. `/app/layout.tsx` renders `AppFrame`: `ToastProvider` → `IntroProvider` → **`SessionGate`** → `RoleFrame`.
4. `SessionGate` (`components/app/session.tsx`) loads the signed-in profile from Supabase (`loadProfile`) and provides `useSession()` = `{ profile, isSuperAdmin, signOut, signingOut }`. Signing out, or another account signing in in another tab, clears every cached query and returns to `/`.
5. For anyone but the Super Admin, `RoleFrame` adds **`BrokerageGate`** (`components/app/brokerage-context.tsx`), which loads `GET /api/v1/brokerage/workspace` and the notifications and provides `useBrokerage()`. That workspace says which unit the person is in (Brokerage, Fronter or Dispatch) and their capabilities; see [02-roles-and-navigation.md](02-roles-and-navigation.md).
6. `AppShell` draws the sidebar, header and notification bell, and renders the page only if the route is in that person's menu.

## Talking to the API

```ts
const api = useApi();                                   // lib/api.ts
const data = await responseData<T>(await api("/api/v1/...", { method: "POST", body: JSON.stringify(body) }));
```

`useApi()` adds `Authorization: Bearer <access token>` from the current Supabase session, and a JSON content type when there is a body. `responseData()` throws an `Error` with the API's `error` message on any non-2xx status, so screens show the server's wording directly.

Inside the workspace, `useBrokerage().api` is the same function and `useBrokerage().report(message, tone)` shows a toast.

## Data loading and caching

- Every read is a TanStack Query. Keys start with the area: `["session", "profile"]`, `["brokerage", ...]` (all staff screens, including Fronter and Dispatch), `["admin", ...]` (Super Admin screens), `["chat", ...]`.
- **Actions** (mutations) go through:
  - `useBrokerageAction()` → `run(key, path, method, body, successMessage)`: runs one action at a time, shows a toast, and **invalidates every `["brokerage"]` query**, waiting until fresh data is on screen. `busy(key)` tells a button it's pending.
  - `useAdminAction()` (`components/admin/admin-data.ts`): the same for Super Admin screens, invalidating `["admin"]`.
- Optimistic edits are used only in the spreadsheet grids (Fronter sheet), which write the new value into the cache first and refresh after.

## Realtime

Chat (`components/chat/chat-data.ts`) reads the inbox from the API but inserts and receives messages straight through Supabase: `chat_messages` inserts, a `postgres_changes` subscription for new messages, and a private broadcast channel `typing:<conversation id>` for "typing…". Row-level security limits all of that to members (backend `08-chat.md`). The sidebar's Chat badge is live from the same stream.
