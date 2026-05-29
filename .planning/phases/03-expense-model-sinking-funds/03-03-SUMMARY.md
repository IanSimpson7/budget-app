---
phase: 03-expense-model-sinking-funds
plan: "03"
subsystem: ui-funds-dashboard
tags: [funds, sinking-fund, progress-bar, mark-paid, routing, sc3, sc4, sc5, exp-04, exp-05, exp-06, ui-04, edge-06]
dependency_graph:
  requires:
    - 03-01 (sinkingFundsAtom, isOnTrack, monthsUntilPayout, saveFundAtom, updateFundAtom, deleteFundAtom, markFundPaidAtom)
    - 03-02 (TextInput, SelectInput, NumberInput, PrimaryButton, SecondaryButton, DestructiveButton, AppShell Funds nav link)
  provides:
    - FundCard component: name+status, progress bar, 3-col metrics, payout date, provisional flag, action affordances
    - FundsPage: /funds vertical slice — card list, add-fund form, mark-paid/edit/delete, empty state
    - /funds route registered in App.tsx
  affects:
    - 05-xx (EF progress section appended to /funds in Phase 5; surface is ready)
tech_stack:
  added: []
  patterns:
    - vi.mock async-import factory (Plan 02 pattern) for Jotai atoms in FundsPage tests
    - Inline confirmation state (editing/confirmingPaid/confirmingRemove) per ExpensesPage pattern
    - Local Date constructor (year, month-1, 1) for YYYY-MM → "Month YYYY" formatting (Pitfall 2)
    - role=progressbar with aria-valuenow/min/max for accessible progress
key_files:
  created:
    - src/components/FundCard.tsx
    - src/pages/FundsPage.tsx
    - src/test/FundCard.test.tsx
    - src/test/FundsPage.test.tsx
  modified:
    - src/App.tsx
decisions:
  - "FundCardWithActions wraps FundCard with local state (editing/confirmingPaid/confirmingRemove) — keeps FundCard a pure display component and FundsPage handlers clean"
  - "Monthly accrual auto-populated to annualAmount/12 on target change, stays editable — matches D-06 (Ian adjusts accrual himself)"
  - "FundsPage test mocks sinkingFundsAtom as a sync atom (not async) to avoid Suspense stall — behaviour proven at atom level in funds.atoms.test.ts (Plan 03-01)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 16
  tests_total_after: 208
---

# Phase 3 Plan 3: FundCard + FundsPage + /funds Route Summary

**One-liner:** /funds vertical slice — FundCard with isOnTrack-driven progress bar + status badge, FundsPage with add-fund form + inline mark-paid/edit/delete confirmations + empty state, and /funds route registration in App.tsx; delivers SC#3, SC#4, SC#5, UI-04, and EDGE-06.

---

## What Was Built

### Task 1: FundCard component

- `FundCard.tsx`: `bg-surface-raised border border-surface-border rounded-sm p-sp-4 flex flex-col gap-sp-3`. Top row: fund name (`font-sans text-sm font-semibold`) + status badge ("On track" `text-success` / "Behind" `text-warning`) computed from `isOnTrack(fund)`. Progress bar: outer `w-full h-[6px] rounded-sm bg-surface-border`, inner fill `bg-success`/`bg-warning`, capped at 100%; `role="progressbar" aria-valuenow={balance} aria-valuemin={0} aria-valuemax={annualAmount}`. Metrics row `grid grid-cols-3 gap-sp-2`: Current/Target/accrual each with `font-mono text-[20px]` value and `text-xs text-text-secondary` label. Payout date `text-xs text-text-secondary` "Due [Month YYYY]" via local Date constructor. Provisional advisory `text-xs text-warning` when `fund.provisional`. Actions row: Edit + Mark paid (`SecondaryButton`) + Remove (`DestructiveButton`), all `min-h-[44px]`. C3 enforced: no transfer/execute/move-money affordance.
- 7 tests: renders all fields, "Behind" status for zero-balance fund, progressbar aria attributes, provisional advisory presence/absence, "On track" when fully funded, C3 structural check.

### Task 2: FundsPage + /funds route

- `FundsPage.tsx`: `max-w-[640px] mx-auto flex flex-col gap-sp-6`. Reads `sinkingFundsAtom`; maps each fund through `FundCardWithActions` (inline editing/confirmation state wrapper). `FundCardWithActions` manages three exclusive states: normal → `FundCard`; editing → `EditForm` (pre-filled, calls `updateFundAtom`); confirmingPaid → annual copy "Balance resets..." / oneoff copy "...will be archived"; confirmingRemove → "Accruals will no longer feed the survival floor." — `DestructiveButton` calls `deleteFundAtom`. Empty state per Copywriting Contract: heading, body, CTA that focuses the add form. Add-fund form: TextInput (name), NumberInput (annual target — auto-populates monthly accrual to target/12, editable), NumberInput (monthly accrual), NumberInput (current balance), `type="month"` input (payout date), SelectInput (cadence Annual/One-off); PrimaryButton "Add fund" disabled until name + target + payout date filled. Helper under annual target: "Provisional targets can be updated anytime."
- `App.tsx`: `<Route path="/funds" element={<FundsPage />} />` added; `FundsPage` imported. The "Funds" NavLink was already present from Plan 02.
- 9 tests: SC#3 (car-insurance fund renders), SC#5 (two cards independently), EDGE-06 mark-paid confirmation "Balance resets", oneoff "archived" copy, markFundPaidAtom called on confirm, empty state, C3, add button disabled state, saveFundAtom called with correct data.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] exactOptionalPropertyTypes: `provisional: undefined` spread fails TSC**
- **Found during:** Task 1 (tsc check)
- **Issue:** TypeScript `exactOptionalPropertyTypes` rejects `{ ...fund, provisional: undefined }` — explicitly setting an optional property to `undefined` is disallowed.
- **Fix:** Used destructuring to omit the property: `const { provisional: _omit, ...rest } = carInsuranceFund`.
- **Files modified:** `src/test/FundCard.test.tsx`
- **Commit:** 0172568

**2. [Rule 1 - Bug] `mock.calls[0][0]` possibly undefined under strictNullChecks**
- **Found during:** Task 2 (tsc check)
- **Issue:** `mockSaveFund.mock.calls[0][0]` typed as `unknown[]` element — accessing without optional chaining fails strict null checks.
- **Fix:** Changed to `mockSaveFund.mock.calls[0]?.[0]`.
- **Files modified:** `src/test/FundsPage.test.tsx`
- **Commit:** 011669f

---

## Threat Flags

No new threat surface beyond the plan's threat model. T-03-08 (C3 erosion via FundCard/FundsPage) mitigated: all FundCard actions are prop callbacks; FundsPage calls only save/update/delete/markFundPaid (DB record actions). T-03-09 (NaN/negative fields): `canAdd` guard enforces `Number.isFinite(annualAmount) && annualAmount > 0`; Plan 01 storage layer throws on non-finite writes. T-03-10 (provisional lock): provisional advisory is informational only; Edit always exposes annualAmount for update.

---

## Known Stubs

None. FundsPage is fully wired to `sinkingFundsAtom` (live IDB via Plan 03-01). The seeded car-insurance fund appears on first run via `seedFundsIfEmpty()` in `main.tsx` (wired in Plan 03-01 Task 3).

---

## Self-Check: PASSED

- `src/components/FundCard.tsx` — found
- `src/pages/FundsPage.tsx` — found
- `src/test/FundCard.test.tsx` — found
- `src/test/FundsPage.test.tsx` — found
- `src/App.tsx` contains `<Route path="/funds"` — confirmed
- Task 1 commit `0172568` — present
- Task 2 commit `011669f` — present
- 208/208 tests passing; `npx tsc -b` clean
