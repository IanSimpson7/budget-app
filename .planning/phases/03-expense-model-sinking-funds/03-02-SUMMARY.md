---
phase: 03-expense-model-sinking-funds
plan: "02"
subsystem: ui-expenses-dashboard
tags: [expenses, dashboard, survival-floor, form-primitives, routing, nav, sc1, sc2, exp-07]
dependency_graph:
  requires:
    - 03-01 (expenseItemsAtom, protectedExpensesAtom, gateableExpensesAtom, survivalFloorAtom, saveExpenseItemAtom, updateExpenseItemAtom, deleteExpenseItemAtom)
    - 01-01 (NumberInput, PrimaryButton, SecondaryButton, DestructiveButton, AppShell, MetricCard)
  provides:
    - /expenses route — add/edit/delete expense lines, categorized PROTECTED/GATEABLE view (SC#1)
    - Survival floor MetricCard on /dashboard (SC#2)
    - TextInput, SelectInput, ClassificationToggle reusable form primitives
    - Expenses + Funds nav links in AppShell
  affects:
    - 03-03 (/funds route consumer — Funds nav link already registered; HashRouter * fallback until Plan 03 adds the route)
    - 02-04 (DashboardPage extended with 4th MetricCard — grid-cols-3 → grid-cols-4)
tech_stack:
  added: []
  patterns:
    - vi.mock factory with async import('jotai') to avoid hoisting TDZ in test mocks
    - getByRole('heading', { level: 3 }) to disambiguate column headings from toggle button text
    - within(column) scoped queries for two-column categorized view tests
key_files:
  created:
    - src/components/TextInput.tsx
    - src/components/SelectInput.tsx
    - src/components/ClassificationToggle.tsx
    - src/pages/ExpensesPage.tsx
    - src/test/ExpensesPage.test.tsx
    - src/test/DashboardPage.test.tsx
  modified:
    - src/App.tsx
    - src/components/AppShell.tsx
    - src/pages/DashboardPage.tsx
    - src/pages/DashboardPage.test.tsx
decisions:
  - "vi.mock factory must create Jotai atoms inline (async import jotai inside factory) to avoid hoisting TDZ — top-level atom() calls are captured before vi.mock hoisting"
  - "DashboardPage test for survivalFloorAtom uses sync atom mock (atom(2335)) not async atom — avoids Suspense stall without a real IDB setup"
  - "grid-cols-3 expanded to grid-cols-2 sm:grid-cols-4 to accommodate 4th survival-floor card without replacing any existing card"
  - "Column headings queried via getByRole('heading', { level: 3 }) not getByText to avoid ambiguity with ClassificationToggle button text"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 4
  tests_added: 12
  tests_total_after: 192
---

# Phase 3 Plan 2: ExpensesPage + Dashboard Survival Floor Card Summary

**One-liner:** /expenses vertical slice (add/edit/delete expense lines, PROTECTED/GATEABLE two-column view, EXP-07 soft advisory) plus a live Survival floor MetricCard on the dashboard — SC#1 and SC#2 fully delivered.

---

## What Was Built

### Task 1: Form primitives — TextInput, SelectInput, ClassificationToggle

- `TextInput.tsx`: Mirrors NumberInput exactly — same border/focus/label/helper/error markup and htmlFor/id pairing. `type="text"`, `value: string`, `onChange: (next: string) => void`. No inline hex.
- `SelectInput.tsx`: Styled `<select>` with `bg-surface-raised text-text-primary font-sans text-sm border border-surface-border rounded-sm min-h-[44px] px-[12px] focus:border-accent`. Label matching NumberInput. Options array prop.
- `ClassificationToggle.tsx`: Two `min-h-[44px]` buttons (Protected/Gateable). Active: `bg-surface-raised border border-accent text-text-primary font-semibold`. Inactive: `bg-transparent border border-surface-border text-text-secondary`. Wrapper `role="group" aria-label="Classification"`, each button `aria-pressed`. Token-only.

### Task 2: ExpensesPage + /expenses route + both nav links

- `ExpensesPage.tsx`: `max-w-[640px] mx-auto flex flex-col gap-sp-6`. Add-expense inline form (TextInput + NumberInput + SelectInput + ClassificationToggle). PrimaryButton "Add expense" disabled until name + amount filled. Cadence helper copy per UI-SPEC. EXP-07 advisory on /whey|supplement/i — helper text shown, submit never disabled (C1 clinical-safety posture). Categorized view: `grid grid-cols-1 sm:grid-cols-2 gap-sp-4` with PROTECTED/GATEABLE columns. Each row: name, `font-mono text-[20px]` amount + cadence badge ("/ mo", "/ yr", "one-off"). Inline edit (replaces row with pre-filled mini-form, Save/Cancel) and delete with inline confirmation ("Remove [name]? This will update the survival floor."). Empty state per Copywriting Contract.
- `App.tsx`: Added `/expenses` route → `<ExpensesPage />`. FundsPage NOT imported (Plan 03-03 owns it).
- `AppShell.tsx`: Added "Expenses" (`to="/expenses"`) and "Funds" (`to="/funds"`) NavLinks using existing `navClasses`. Funds link safe — HashRouter `*` fallback renders /dashboard until Plan 03-03 registers /funds.

### Task 3: Dashboard survival-floor metric card

- `DashboardPage.tsx`: Import `survivalFloorAtom` from `expenses.atoms`. `useAtomValue(survivalFloorAtom, { delay: 0 })`. MetricCard `label="Survival floor"` `subtext="fixed + food seed"` `variant="default"`. Zero-floor renders `valueColor="text-text-disabled"`. Grid expanded from `grid-cols-3` to `grid-cols-2 sm:grid-cols-4` — all three existing cards intact, survival floor added additively.
- Existing `DashboardPage.test.tsx` extended with mock for `expenses.atoms` so the 5 pre-existing tests remain green.
- New `test/DashboardPage.test.tsx`: 5 tests — card label, subtext, existing cards intact, value renders at mocked $2,335.00, all 4 cards present.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test query ambiguity: "Protected" matches both h3 column heading and ClassificationToggle button**
- **Found during:** Task 2 (first test run)
- **Issue:** `screen.getByText(/^protected$/i)` found two elements — the `<h3>` column heading and the `<button aria-pressed="true">` toggle. `within(column)` query couldn't be scoped without first finding the column.
- **Fix:** Changed test query to `screen.getByRole('heading', { name: /^protected$/i, level: 3 })` to target only the h3.
- **Files modified:** `src/test/ExpensesPage.test.tsx`
- **Commit:** f3fa9b6

**2. [Rule 1 - Bug] Vitest vi.mock hoisting TDZ error for top-level atom() calls in test**
- **Found during:** Task 3 (first DashboardPage test attempt)
- **Issue:** `vi.mock` is hoisted to top of file before `const syncSurvivalFloorAtom = atom(2335)` executes, causing ReferenceError.
- **Fix:** Moved all atom() creation inside the `vi.mock(path, async () => { const { atom } = await import('jotai'); ... })` factory.
- **Files modified:** `src/test/DashboardPage.test.tsx`
- **Commit:** ef8257d

**3. [Rule 1 - Bug] Suspense never resolves in DashboardPage tests because survivalFloorAtom is async**
- **Found during:** Task 3 (first DashboardPage test run)
- **Issue:** `survivalFloorAtom` is `atom(async (get) => ...)` — always returns a Promise, always triggers Suspense. The real IDB path wouldn't resolve in the test environment even with fake-indexeddb.
- **Fix:** Mock `expenses.atoms` entirely in the new test file with a sync `atom(2335)`. SC#2 recompute behaviour is already proven at atom level in `expenses.atoms.test.ts` (Plan 03-01, 10 tests). Also added `expenses.atoms` mock to the existing `src/pages/DashboardPage.test.tsx` so it doesn't break from the new import.
- **Files modified:** `src/test/DashboardPage.test.tsx`, `src/pages/DashboardPage.test.tsx`
- **Commit:** ef8257d

---

## Known Stubs

None. All UI surfaces are wired to real atoms from Plan 03-01. The seeded PROTECTED starter rows (Housing/Electric/Fuel/Claude) appear on first run via `seedExpensesIfEmpty()` in `main.tsx` (wired in Plan 03-01 Task 3).

---

## Threat Flags

No new threat surface beyond the plan's threat model. T-03-05 (NaN/empty amount propagation) mitigated by `canAdd` guard (`Number.isFinite(amount) && amount > 0`) in both the add form and the inline edit form. T-03-06 (EXP-07 advisory must not block) verified by two tests asserting `addBtn` remains enabled. T-03-07 (survivalFloorAtom Suspense) covered by existing App.tsx `<Suspense>` wrapper + `{ delay: 0 }` in DashboardPage.

---

## Self-Check: PASSED

All 6 created files and 4 modified files confirmed on disk. All 3 task commits present (5bd2d30, f3fa9b6, ef8257d). 192 tests passing, `npx tsc -b` clean.
