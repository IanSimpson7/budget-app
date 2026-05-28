---
phase: 02-income-model-with-two-floors
plan: 04
subsystem: dashboard-ui
tags: [ui, dashboard, income-bar, metric-card, backfill-alert, jotai, tdd, aria, routing, react]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [income-bar, metric-card, backfill-alert-card, dashboard-page, dashboard-route]
  affects:
    - src/components/IncomeBar.tsx
    - src/components/MetricCard.tsx
    - src/domains/income/BackfillAlertCard.tsx
    - src/pages/DashboardPage.tsx
    - src/pages/DashboardPage.test.tsx
    - src/components/IncomeBar.test.tsx
    - src/App.tsx
    - src/components/AppShell.tsx
tech_stack:
  added: []
  patterns:
    - role=meter (ARIA income bar with floor markers)
    - role=alert (BackfillAlertCard — dynamic screen reader announcement)
    - useAtomValue(atom, { delay: 0 }) — Pitfall 1 prophylaxis at all async atom consumers
    - in-place surplus↔backfill swap driven by backfillActiveAtom (pre-mirrors Phase-5 SURP-07)
    - vi.mock async importOriginal — avoids top-level variable hoisting in Vitest mock factories
key_files:
  created:
    - src/components/IncomeBar.tsx
    - src/components/MetricCard.tsx
    - src/domains/income/BackfillAlertCard.tsx
    - src/pages/DashboardPage.tsx
    - src/pages/DashboardPage.test.tsx
  modified:
    - src/components/IncomeBar.test.tsx
    - src/App.tsx
    - src/components/AppShell.tsx
decisions:
  - "bg-warning bg-opacity-10 used instead of bg-[#9a7a2e]/10: Tailwind v3 bg-opacity-* works with plain hex tokens; the /10 modifier requires CSS variable tokens. Functionally equivalent; passes grep gate (no inline hex)."
  - "DashboardPage test uses vi.mock async importOriginal with all fixture data defined inside the factory — avoids Vitest top-level hoisting ReferenceError for variables referenced inside mock factories."
  - "Empty-state rendered via currentMonthChecksAtom.length === 0 check (no additional atom); bar collapses to 0% fill gracefully when projectedMonth=0 via base=max(1, projectedMonth) guard."
metrics:
  duration: "~1 hour"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 8
---

# Phase 2 Plan 04: Dashboard Vertical Slice — IncomeBar + MetricCards + /dashboard Route Summary

Phone-readable `/dashboard` showing MTD income against the passive floor (solvency band) and defended line ($3k tick), with in-place surplus↔backfill swap, designed empty state, and `/dashboard` as the index route — completing SC#3 and SC#4.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| RED | Failing tests for IncomeBar (role=meter + aria props) | 457cf77 | IncomeBar.test.tsx |
| GREEN (Task 1) | IncomeBar + MetricCard + BackfillAlertCard | 0385d62 | IncomeBar.tsx, MetricCard.tsx, BackfillAlertCard.tsx |
| Task 2 | DashboardPage + /dashboard route + index redirect + nav | e6d70b3 | DashboardPage.tsx, DashboardPage.test.tsx, App.tsx, AppShell.tsx |

## What Was Built

### IncomeBar (src/components/IncomeBar.tsx)
- `role="meter"` with `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax`, `aria-label="Month-to-date income"`
- Segments: `bg-success` actual fill; `bg-warning/40` ghost projection (only when projected > mtd); dashed `border-text-secondary` passive floor marker + "floor" label; 2px `border-accent` defended-line tick + "$3k" label
- Overflow case: when `projectedMonth > defendedLine × 1.2`, shows "above defended line by $X" below bar
- No animated width transitions (reduced-motion compliance)
- All colors via `tailwind.config.ts` tokens — zero inline hex

### MetricCard (src/components/MetricCard.tsx)
- Props: `label`, `value`, `subtext?`, `variant?: 'default' | 'alert'`, `valueColor?`
- Alert variant: `border-warning bg-warning bg-opacity-10`
- `font-mono text-[20px]` value, `font-sans text-xs text-text-secondary` label
- `exactOptionalPropertyTypes` satisfied via `prop?: T | undefined` signatures

### BackfillAlertCard (src/domains/income/BackfillAlertCard.tsx)
- `role="alert"` — screen readers announce on dynamic appearance
- Label "Backfill alert" in `text-warning`, projected payroll in `font-mono text-[20px]`, subtext "below $3,000 — add sessions to defend"
- Warning border + `bg-warning bg-opacity-10` background tint

### DashboardPage (src/pages/DashboardPage.tsx)
- Section heading: "Income · {Month YYYY}" (`font-display text-[20px]`)
- Reads: `mtdTotalAtom`, `projectedTotalAtom`, `projectedMonthPayrollAtom`, `surplusAtom`, `backfillActiveAtom`, `currentMonthChecksAtom`, `floorsLoadAtom` — all with `{ delay: 0 }` (Pitfall 1 prophylaxis)
- Three-card grid: "Month to date" / "Projected month" / surplus↔BackfillAlertCard (in-place, driven by `backfillActiveAtom`)
- Empty state (no checks): `text-text-disabled` "$0.00" values + "No income recorded for {Month YYYY}. Enter your first check." with Link to `/entry`
- "Add check" `SecondaryButton` linking to `/entry`

### App.tsx + AppShell.tsx
- `/dashboard` route added; index `"/"` and wildcard `"*"` both redirect to `/dashboard`
- `Dashboard` `NavLink` added as first nav item in AppShell

## Test Results

- 114 passing, 7 todo, 0 failing across 13 test files
- `npx tsc -b --noEmit` exits 0
- Grep gate: no inline hex in IncomeBar.tsx, MetricCard.tsx, BackfillAlertCard.tsx — PASS
- `role="meter"` in IncomeBar.tsx — PASS
- `role="alert"` in BackfillAlertCard.tsx — PASS
- `path="/dashboard"` in App.tsx — PASS
- Index redirect targets `/dashboard` — PASS
- `to="/dashboard"` NavLink in AppShell.tsx — PASS
- DashboardPage.test.tsx: 5 tests covering role=alert, role=meter, heading, Add check button, no-crash

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] aria-valuemin type error: string "0" not assignable to number**
- **Found during:** Task 1 GREEN — `npx tsc -b --noEmit`
- **Issue:** `aria-valuemin="0"` (string) assigned to `aria-valuemin: number` in React's HTMLAttributes. TypeScript strict mode rejected it.
- **Fix:** Changed to `aria-valuemin={0}` (number literal).
- **Files modified:** src/components/IncomeBar.tsx
- **Commit:** e6d70b3

**2. [Rule 1 - Bug] exactOptionalPropertyTypes: `string | undefined` not assignable to optional `string`**
- **Found during:** Task 2 — `npx tsc -b --noEmit`
- **Issue:** MetricCard's `valueColor?: string` with `exactOptionalPropertyTypes: true` rejected `string | undefined` being passed from DashboardPage.
- **Fix:** Changed Props type to `valueColor?: string | undefined` (explicit union satisfies exactOptionalPropertyTypes).
- **Files modified:** src/components/MetricCard.tsx
- **Commit:** e6d70b3

**3. [Rule 1 - Bug] bg-[#9a7a2e]/10 introduced inline hex, failing grep gate**
- **Found during:** Task 1 GREEN — grep gate verification
- **Issue:** UI-SPEC suggested `bg-[#9a7a2e]/10` for warning opacity overlay, but this introduces an inline hex value that the plan's grep gate prohibits.
- **Fix:** Replaced with `bg-warning bg-opacity-10` — Tailwind v3's `bg-opacity-*` modifier applies opacity to the `bg-warning` token without embedding the hex literal in the class string. Functionally equivalent visual output.
- **Files modified:** src/components/MetricCard.tsx, src/domains/income/BackfillAlertCard.tsx
- **Commit:** 0385d62

**4. [Rule 1 - Bug] Vitest ReferenceError: top-level variable referenced inside hoisted mock factory**
- **Found during:** Task 2 — DashboardPage.test.tsx run
- **Issue:** `vi.mock` factories are hoisted to the top of the file before variable initialization; referencing `MAY_CHECK` (defined after the `vi.mock` call) caused `ReferenceError: Cannot access 'MAY_CHECK' before initialization`.
- **Fix:** Moved all fixture data inside the `async (importOriginal)` factory so it's defined at factory execution time, not at hoisting time.
- **Files modified:** src/pages/DashboardPage.test.tsx
- **Commit:** e6d70b3

## Known Stubs

None — dashboard renders fully from live derived atoms. All values are wired to real data sources from plan 02-02.

## Threat Flags

All threats from the plan's threat register mitigated:

| Flag | File | Status |
|------|------|--------|
| T-02-04 (Integrity) | DashboardPage.tsx | Renders only read-only derived atoms; no write atoms, no persistence (FOUND-06) |
| T-02-05 (Tampering — backfill) | DashboardPage.tsx + DashboardPage.test.tsx | Swap driven by backfillActiveAtom (payroll-only, D-09); render test asserts role=alert appears for below-defended case |
| T-02-X (XSS) | DashboardPage.tsx | Renders numeric/derived values only; React escapes text; no dangerouslySetInnerHTML |

No new threat surface beyond the plan's threat register.

## Self-Check: PASSED

- src/components/IncomeBar.tsx — FOUND, contains role="meter"
- src/components/MetricCard.tsx — FOUND, variant prop + font-mono value
- src/domains/income/BackfillAlertCard.tsx — FOUND, contains role="alert"
- src/pages/DashboardPage.tsx — FOUND, reads all derived atoms with { delay: 0 }
- src/pages/DashboardPage.test.tsx — FOUND, 5 tests passing
- src/App.tsx contains path="/dashboard" and index redirect to /dashboard — FOUND
- src/components/AppShell.tsx contains NavLink to="/dashboard" — FOUND
- Commits 457cf77 (RED), 0385d62 (GREEN Task 1), e6d70b3 (Task 2) — FOUND in git log
- 114 tests passing, tsc exits 0 — PASS
- Grep gate: no inline hex in three new component files — PASS
