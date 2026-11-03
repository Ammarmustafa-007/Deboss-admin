# 4. Conventions

## 4.1 UI kit (`src/components/ui`)

| File | Components |
|---|---|
| `surface.tsx` | `Card`, `CardHeader`, `PageHeader` (title, subtitle, breadcrumbs, actions), `KpiCard`, `Chip`, `StatusChip` (status → colour), `IconTile`, `Avatar`, `EmptyState`, `Skeleton`, `humanize`, `toneFor` |
| `button.tsx` | `Button` (variants: primary, ink, outline, ghost, success, danger; `pending` + `pendingLabel`), `IconButton`, `LinkButton`, `buttonClass` |
| `field.tsx` | `TextField`, `PasswordInput`, `SelectField`, `TextAreaField`, `FilePicker` (label, hint, error; non-required fields show "Optional") |
| `overlay.tsx` | `Modal`, `Drawer` (title, subtitle, footer, `dismissible`) |
| `navigation.tsx` | `Tabs` (with counts and `hidden` items), `Segmented`, `Stepper` |
| `toast.tsx` | `ToastProvider`, `useToast()` |
| `motion.tsx` | `Bump`, `Sparkles`, `StatusMotion`, `useChangeCount` (small animations on changes) |

Spreadsheet grids use `components/fronter/sheet.tsx` (`Sheet`, `FullSheet`): editable cells, arrow-key navigation, paste-to-add-rows, locked rows, sticky columns and edge scroll buttons.

## 4.2 Design tokens

Defined once in `src/app/globals.css` under `@theme`, used as Tailwind classes (`bg-brand`, `text-muted`, `border-line`, `rounded-card`, `animate-rise`…):

| Token | Value | Use |
|---|---|---|
| `brand` / `brand-soft` / `brand-deep` / `brand-tint` | #F7941D / #FFB347 / #A85D00 / #FFF4E4 | DEBOSS orange: primary actions, highlights |
| `ink` / `ink-soft` | #111111 / #1B1A17 | Text, dark buttons |
| `canvas` | #F5F4F1 | Page background |
| `line` / `line-soft` | #E6E3DD / #F0EEE9 | Borders, dividers |
| `muted` | #5F5B53 | Secondary text |
| `aqua`, `accent`, `info`, `danger`, `success` | #0FB5A6, #7C5CFC, #2E90FA, #F43F6E, #22A860 | Tones for KPIs, chips and states |
| `radius-card` / `radius-control` | 14px / 10px | Corners |
| Animations | `rise`, `fade`, `slide-in`, `pop`, `status-pop`, `typing-dot`, `msg-in/out`, `shake` | Page entry, chat, status changes |

Font: Poppins. In development, Turbopack may not pick up edits to `globals.css`; restart the dev server and clear `.next/dev` if a token change doesn't appear.

## 4.3 Reading data

```tsx
const { api } = useBrokerage();
const trucks = useQuery({
  queryKey: ["brokerage", "dispatch", "trucks"],
  queryFn: async () => responseData<{ trucks: Truck[] }>(await api("/api/v1/dispatch/trucks")),
  staleTime: 15_000,
});
```

- Put the hook in the module's data file (`model.ts`, `*-data.ts`), typed with the response shape.
- Key under `["brokerage", …]` for staff screens and `["admin", …]` for Super Admin screens, so actions refresh them.
- Render four states: loading (`Skeleton`), error (`EmptyState` with `errorMessage(error)`), empty (`EmptyState`), data.

## 4.4 Changing data

```tsx
const { run, busy } = useBrokerageAction();          // or useAdminAction() on Super Admin screens
<Button pending={busy("save")} onClick={() => run("save", `/api/v1/dispatch/invoices/${id}`, "PATCH", body, "Invoice updated.")}>Save</Button>
```

`run` returns `undefined` when the request failed (the error is already shown as a toast), so `if (result !== undefined) close()` is the pattern for closing a form on success.

## 4.5 Writing for the client

Text on screens is read by the client's staff. Use plain words and the client's names for things (Load, Invoice, Active sale, Fronter mining sheet), and never internal codes or requirement ids. Errors come from the API and are already written that way.

## 4.6 Exports

`downloadExcel(fileName, sheets, meta)` (`lib/excel.ts`) builds a styled workbook: title, period, "exported by", typed columns (`money`, `date`, `number`, `percent`, `status`) and an optional totals row. Lead mining also exports CSV (UTF-8 with BOM so Excel opens it correctly).

## 4.7 Adding a screen

1. Build the screen in `src/components/<module>/`, with its data hooks in the module's data file.
2. Add `src/app/app/<route>/page.tsx` that only renders it (`"use client"`).
3. Add the route to the right menu builder in `components/app/navigation.ts`. Without that, `AppShell` shows "This area isn't part of your workspace". Use `hidden: true` for a route that should be reachable but not listed.
4. Add or check the backend endpoint and its permission check. The screen's own checks are only for display.
5. Run `npm run lint` and `npx tsc --noEmit`.
