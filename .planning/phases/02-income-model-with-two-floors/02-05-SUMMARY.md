---
phase: 02-income-model-with-two-floors
plan: 05
subsystem: income-entry-ui
tags: [ui, paste-parse, tdd, jotai, confirm-table, state-machine, known-sources, settings]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [paste-parse-flow, confirm-table, commit-checked-rows-atom, estimate-per-check-settings]
  affects:
    - src/domains/income/PasteParseFlow.tsx
    - src/domains/income/ConfirmTable.tsx
    - src/domains/income/income.atoms.ts
    - src/domains/income/PasteParseFlow.test.tsx
    - src/pages/EntryPage.tsx
    - src/pages/SettingsPage.tsx
tech_stack:
  added: []
  patterns:
    - explicit-step-state-machine (BackupPage analog — type Step literal union + conditional render)
    - commitCheckedRowsAtom write-only (no refreshCounterAtom — liveQuery re-emits)
    - D-05 conservative auto-check (defaultChecked only PAYROLL/known-source credits)
    - D-06 known-source memory (dedup by source on every commit)
    - D-11 estimatePerCheck OVERRIDE (0 = derive from most recent payroll check)
key_files:
  created:
    - src/domains/income/PasteParseFlow.tsx
    - src/domains/income/ConfirmTable.tsx
  modified:
    - src/domains/income/income.atoms.ts
    - src/domains/income/PasteParseFlow.test.tsx
    - src/pages/EntryPage.tsx
    - src/pages/SettingsPage.tsx
decisions:
  - "ConfirmTable uses aria-label 'Select row N' on row-select checkboxes to distinguish them from per-row taxable checkboxes in tests and a11y trees"
  - "PasteParseFlow uses useNavigate for 'View dashboard' navigation — test wrapper uses MemoryRouter (Rule 3 auto-fix)"
  - "SettingsPage loads estimatePerCheck on mount via useEffect; does not write on mount (D-11: 0 means derive-by-default); saves only on explicit 'Save settings' click"
  - "commitCheckedRowsAtom deduplicates knownSources by source string; existing entry is overwritten with committed category/taxable values (D-06 update semantics)"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 6
---

# Phase 2 Plan 05: Paste-Parse Flow + ConfirmTable + Settings Estimate Field Summary

Paste → parse → confirm → commit vertical slice: Ian pastes a checking-statement block, the pure parser (02-02) turns it into 6 candidate rows, D-05 conservative auto-check pre-ticks only the 2 PAYROLL rows, a ConfirmTable lets him review/edit, and committing persists only checked rows while remembering sources. The Settings "Income parameters" section adds the editable estimatePerCheck override field (D-11).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| RED | Failing tests for PasteParseFlow | 263f632 | PasteParseFlow.test.tsx (9 tests) |
| GREEN | ConfirmTable + PasteParseFlow + commitCheckedRowsAtom | 3e61689 | ConfirmTable.tsx, PasteParseFlow.tsx, income.atoms.ts |
| 2 | Wire PasteParseFlow into EntryPage + Settings estimate field | fe7f8aa | EntryPage.tsx, SettingsPage.tsx |

## What Was Built

### ConfirmTable.tsx
- Controlled editable table: `rows`/`onChange` props; no local state, no I/O
- Columns: checkbox (row-select), date (read-only), amount (credit = `text-success`, debit = `text-text-secondary`), source (inline editable `<input>`), category `<select>`, taxable checkbox, note (truncated 40 chars)
- Unchecked rows dimmed `text-text-disabled` — not hidden (visibility required for user review)
- `min-h-[44px]` on every interactive element; tokens only; `font-mono tabular-nums` on amounts
- ARIA: `aria-label="Select row N"` / `aria-label="Taxable for row N"` on checkboxes; `scope="col"` on `<th>`
- No `import { db }`, no `dangerouslySetInnerHTML`, no `refreshCounterAtom`

### PasteParseFlow.tsx
- `type Step = 'input' | 'confirm' | 'committing' | 'done'` — mirrors BackupPage step-machine pattern
- Step 1: `<textarea min-h-[160px] resize-y>` + "Parse entries" (disabled when empty); inline error on empty parse result stays on step 1
- Step 2: `<ConfirmTable>` + count summary "{N} of {total} entries selected" + "Commit {N} checks" (reactive, disabled at 0) + "Back — re-paste"
- Step 3 (done): "N checks saved successfully." + "Add more" (resets to step 1) + "View dashboard" (navigates `/dashboard`)
- Toast: fixed template `Saved ${n} checks.` — never concatenates parsed content (T-02-X)
- No `import { db }`, no `refreshCounterAtom`

### income.atoms.ts (addition)
- `commitCheckedRowsAtom`: write-only atom, receives `CandidateRow[]`, filters to checked, maps to `Omit<IncomeCheck,'id'>` (D-07: note = raw block text), calls `storage.addIncomeChecks` then `storage.saveKnownSources` (dedup/overwrite by source, D-06)
- No `refreshCounterAtom` — liveQuery source atom re-emits on IDB write automatically

### EntryPage.tsx
- 02-03 paste-tab placeholder replaced with `<PasteParseFlow />`; placeholder text "coming up" gone

### SettingsPage.tsx
- New "Income parameters" section card (same `bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6` pattern)
- `NumberInput` "Estimate per check" with helper "Used to project monthly payroll when fewer than 2 checks are in."
- Initial value loaded from `storage.getEstimatePerCheck()` on mount via `useEffect` (not auto-written)
- Persisted via `storage.saveEstimatePerCheck` in existing "Save settings" handler

## Test Results

- 122 passing, 15 todo, 0 failing across 13 test files
- `npx tsc -b --noEmit` exits 0
- Grep gates: no `import { db }` in PasteParseFlow.tsx or ConfirmTable.tsx — PASS
- Grep gate: no `refreshCounterAtom` in commit path — PASS
- Gold fixture (9 tests): 2 of 6 rows auto-checked; VANGUARD SELL + both Venmo rows excluded from commit; GLI remembered in knownSources; empty parse stays on step 1 with inline error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] useNavigate requires Router context in tests**
- **Found during:** Task 1 GREEN — test run (all 9 tests failing with "useNavigate() may be used only in the context of a `<Router>` component")
- **Issue:** `PasteParseFlow` calls `useNavigate()` for "View dashboard" navigation. Test render helper had no Router context.
- **Fix:** Wrapped test `renderFlow()` helper in `<MemoryRouter>` from react-router-dom. PasteParseFlow keeps real `useNavigate()` for production navigation.
- **Files modified:** src/domains/income/PasteParseFlow.test.tsx
- **Commit:** 3e61689

**2. [Rule 1 - Bug] Test targeting ambiguity: `getAllByRole('checkbox')` matched both row-select and taxable checkboxes**
- **Found during:** Task 1 GREEN — test assertions for "exactly 2 rows checked" found 8 checked (2 row-select + 6 taxable-defaulted-true)
- **Issue:** `getAllByRole('checkbox')` returned 12 total checkboxes (6 row-select + 6 taxable); taxable defaults to true for payroll/other categories, inflating the "checked" count.
- **Fix:** Updated test assertions to use `getByRole('checkbox', { name: /select row N/i })` pattern — targets only the row-select checkboxes via their distinct `aria-label`.
- **Files modified:** src/domains/income/PasteParseFlow.test.tsx
- **Commit:** 3e61689

## Known Stubs

None — all four truths from the plan's `must_haves` are fully implemented:
- Paste → parse → confirm → commit works end-to-end
- D-05 conservative auto-check verified by gold-fixture test
- Known-source memory wired and tested
- Settings "Estimate per check" field implemented and wired

## Threat Surface Scan

All threats from the plan's `<threat_model>` addressed:

| Flag | File | Status |
|------|------|--------|
| T-02-D (DoS) | PasteParseFlow.tsx | parseStatement (02-02) handles DoS cap (>1M chars → RangeError); empty result → inline error path, no hang |
| T-02-03 (Integrity / conservative auto-check) | PasteParseFlow.tsx | D-05 + gold-fixture test: $3,000 asset sale + gift excluded from committed set |
| T-02-X (XSS) | PasteParseFlow.tsx, ConfirmTable.tsx | React auto-escapes all JSX text; no `dangerouslySetInnerHTML`; toast = fixed template |
| T-02-06 (Tampering) | income.atoms.ts | commitCheckedRowsAtom calls only addIncomeChecks + saveKnownSources — no credential/money-move method |

No new threat surface introduced beyond the plan's threat register.

## Self-Check: PASSED

- src/domains/income/PasteParseFlow.tsx — FOUND
- src/domains/income/ConfirmTable.tsx — FOUND
- src/domains/income/income.atoms.ts contains commitCheckedRowsAtom — FOUND
- src/pages/EntryPage.tsx imports PasteParseFlow, placeholder text gone — PASS
- src/pages/SettingsPage.tsx contains "Income parameters" heading and saveEstimatePerCheck — PASS
- Commits 263f632 (RED), 3e61689 (GREEN), fe7f8aa (Task 2) — FOUND in git log
- 122 tests passing, tsc exits 0 — PASS
- Grep gates: no `import { db }` in PasteParseFlow.tsx/ConfirmTable.tsx — PASS
