---
phase: 02-income-model-with-two-floors
plan: 03
subsystem: income-entry-ui
tags: [ui, form, jotai, tdd, aria, autocomplete, surplus-badge, routing]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [check-entry-form, source-autocomplete, entry-tab-bar, entry-page, entry-route]
  affects:
    - src/domains/income/income.atoms.ts
    - src/domains/income/CheckEntryForm.tsx
    - src/domains/income/CheckEntryForm.test.tsx
    - src/domains/income/SourceAutocomplete.tsx
    - src/components/EntryTabBar.tsx
    - src/pages/EntryPage.tsx
    - src/App.tsx
    - src/components/AppShell.tsx
tech_stack:
  added: []
  patterns:
    - draft+validate+save+toast (SettingsPage analog)
    - saveIncomeCheckAtom write-only (no refreshCounterAtom — liveQuery auto-emits)
    - ARIA tabs pattern (tablist/tab/aria-selected + arrow-key navigation)
    - known-source autocomplete with KnownSource callback for category/taxable auto-fill
    - surplus badge derived from currentMonthChecksAtom payroll count
key_files:
  created:
    - src/domains/income/CheckEntryForm.tsx
    - src/domains/income/CheckEntryForm.test.tsx
    - src/domains/income/SourceAutocomplete.tsx
    - src/components/EntryTabBar.tsx
    - src/pages/EntryPage.tsx
  modified:
    - src/domains/income/income.atoms.ts
    - src/App.tsx
    - src/components/AppShell.tsx
decisions:
  - "saveIncomeCheckAtom has no refreshCounterAtom bump — incomeChecksAtom (atomWithObservable/liveQuery) re-emits on IDB write automatically; adding a counter would duplicate reactivity"
  - "Surplus badge uses currentMonthChecksAtom (derived from incomeChecksAtom) with isInLocalMonth keyed on the entered date's month, not just the current month — handles edge case where Ian enters a backdated check"
  - "EntryPage renders CheckEntryForm only when activeTab === 'manual' to avoid mounting the form's Jotai subscriptions while hidden; paste panel is a div with hidden attribute for ARIA correctness"
  - "SourceAutocomplete closes dropdown on blur via 150ms setTimeout to allow mousedown-on-item to register before the blur fires"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 8
---

# Phase 2 Plan 03: Manual Entry UI — CheckEntryForm + EntryTabBar + /entry Route Summary

Manual income check entry form with known-source autocomplete (D-06), 3rd-check surplus badge (D-12), and the /entry route with ARIA two-tab shell — completing SC#1 (Ian can type a check and see it persisted).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| RED | Failing tests for CheckEntryForm | 77ab5a9 | CheckEntryForm.test.tsx |
| GREEN | CheckEntryForm + SourceAutocomplete + saveIncomeCheckAtom | 1d06e66 | CheckEntryForm.tsx, SourceAutocomplete.tsx, income.atoms.ts |
| 2 | EntryTabBar + EntryPage + /entry route and nav | 2d1c7bb | EntryTabBar.tsx, EntryPage.tsx, App.tsx, AppShell.tsx |

## What Was Built

### income.atoms.ts (additions)
- `knownSourcesAtom`: plain async atom reading `storage.getKnownSources()` — no liveQuery (known-source list updates on commit, not real-time)
- `saveIncomeCheckAtom`: write-only atom dispatching `storage.addIncomeCheck`; NO refreshCounterAtom (liveQuery re-emits automatically — PATTERNS §370-372 prohibition honored)

### SourceAutocomplete.tsx
- Text input with live-filtered dropdown of known-source strings
- Dropdown shows on focus (if sources exist) and filters by typed value (case-insensitive include)
- `onSelect` callback returns the full `KnownSource` so CheckEntryForm can auto-fill category + taxable
- ARIA: `aria-autocomplete="list"`, `role="listbox"`, `role="option"`, `aria-selected`
- Each dropdown item: `min-h-[44px]`, tokens-only, `hover:bg-surface-border`
- Blur closes with 150ms delay so mousedown-on-item registers before blur

### CheckEntryForm.tsx
- Local draft state per IncomeCheck field; date defaults to today via `todayISO()`
- Validate-on-blur for text/date; validate-on-change for NumberInput (matches Phase 1 pattern)
- Save disabled when any required field invalid (date, amount > 0, source non-empty)
- Category `<select>` payroll/gift/other; changing category updates taxable default via `defaultTaxable()` but taxable remains user-editable
- Surplus badge: `currentMonthChecksAtom` payroll count ≥ 2 for the entered date's month; uses `isInLocalMonth(c.date, ref)` where `ref = new Date(date + 'T00:00:00')` — handles backdated entries
- On save: dispatches `saveIncomeCheckAtom`, shows "Check saved." Toast (success, auto-dismisses 4s), resets draft, returns focus to Date field
- All inputs: `bg-surface-raised border border-surface-border rounded-sm px-sp-3 py-sp-2 font-sans text-sm text-text-primary min-h-[44px] focus-visible:outline-accent`
- No `import { db }` anywhere in the file; no `refreshCounterAtom`

### EntryTabBar.tsx
- `role="tablist"`, two `role="tab"` buttons with `aria-selected`, `aria-controls` pointing to panel IDs
- Arrow-key navigation: ArrowLeft/ArrowRight cycles between tabs
- Active: `border-b-2 border-accent bg-surface-raised text-text-primary`; inactive: `border-b-2 border-transparent text-text-secondary hover:text-text-primary`
- `min-h-[44px]` on each tab; controlled via `value`/`onChange` props

### EntryPage.tsx
- Section heading "Add Income" — `font-display text-[20px]`
- `max-w-[480px] mx-auto` centered layout
- `EntryTabBar` controlling `<CheckEntryForm />` (manual, default) and paste placeholder
- Each tab panel: `role="tabpanel"`, `aria-labelledby` pointing to tab ID, `hidden` attribute when inactive
- Paste panel has clearly-labelled `// MOUNT POINT: PasteParseFlow goes here in plan 02-05` comment

### App.tsx / AppShell.tsx
- `<Route path="/entry" element={<EntryPage />} />` added — 3 named routes + wildcard (well within SKELETON 6-route cap)
- `<NavLink to="/entry" className={navClasses}>Entry</NavLink>` added to nav

## Test Results

- 104 passing, 15 todo, 0 failing across 12 test files
- `npx tsc -b --noEmit` exits 0
- Grep gate: `import { db }` does NOT appear in income.atoms.ts or CheckEntryForm.tsx — PASS
- Grep gate: `refreshCounterAtom` does NOT appear in income.atoms.ts save path — PASS
- CheckEntryForm.test.tsx: 8 tests covering save path, disabled states, surplus badge, reset on save

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS exactOptionalPropertyTypes: vi.fn spread argument type errors in test file**
- **Found during:** Task 1 GREEN — `npx tsc -b --noEmit`
- **Issue:** `vi.fn(async () => 1)` inferred as `MockedFunction<() => Promise<number>>` but called with `(check: unknown)` argument. Multiple TS2554/TS2556 errors due to strict mock type inference.
- **Fix:** Typed mock functions explicitly with `(_check: any)` parameter; cast `mock.calls` to `Array<[unknown]>` for the assertion; added `// eslint-disable-next-line` comments where `any` was intentional in test code.
- **Files modified:** src/domains/income/CheckEntryForm.test.tsx
- **Commit:** 1d06e66

## Known Stubs

**Paste & parse tab placeholder** — `src/pages/EntryPage.tsx`, paste panel renders `<p>Paste & parse — coming up</p>`. This is intentional per plan 02-03 spec: "paste tab placeholder (`<div>` with text... REPLACED by PasteParseFlow in 02-05; leave a clearly-labelled mount point)". The placeholder does not block SC#1 (manual entry). Plan 02-05 wires the full PasteParseFlow.

## Threat Flags

All threats in the plan's threat register mitigated:

| Threat | File | Status |
|--------|------|--------|
| T-02-V (Input Validation) | CheckEntryForm.tsx | Save disabled on invalid date / amount ≤ 0 / empty source; validate-on-blur for text |
| T-02-X (XSS) | CheckEntryForm.tsx, SourceAutocomplete.tsx | React auto-escapes all JSX text; no dangerouslySetInnerHTML; Toast copy never concatenates user input |
| T-02-06 (Tampering) | income.atoms.ts | Save goes through storage.addIncomeCheck only; no credential/money-move method |

No new threat surface introduced beyond the plan's threat register.

## Self-Check: PASSED

- src/domains/income/CheckEntryForm.tsx — FOUND
- src/domains/income/SourceAutocomplete.tsx — FOUND
- src/components/EntryTabBar.tsx — FOUND
- src/pages/EntryPage.tsx — FOUND
- income.atoms.ts contains saveIncomeCheckAtom and knownSourcesAtom — FOUND
- App.tsx contains path="/entry" — FOUND
- AppShell.tsx contains NavLink to="/entry" — FOUND
- Commits 77ab5a9 (RED), 1d06e66 (GREEN), 2d1c7bb (Task 2) — FOUND in git log
- 104 tests passing, tsc exits 0 — PASS
- Grep gate: no `import { db }` in income.atoms.ts or CheckEntryForm.tsx — PASS
