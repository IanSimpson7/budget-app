---
phase: 04-food-contract-locked-floor
plan: "07"
subsystem: food-floor
tags: [c1-fix, cr-01, cr-02, wr-05, wr-02, tdd, gap-closure]
dependency_graph:
  requires: [01, 02, 03, 04, 06]
  provides: [cr-01-ratchet, cr-02-meal-days, wr-05-import-guard, wr-02-catch]
  affects: [food.atoms.ts, planParser.ts, costEngine.ts, storage.ts]
tech_stack:
  added: []
  patterns:
    - Math.max ratchet for C1 display floor (CR-01 Reading A)
    - mealDays field on ParsedPlan for correct daily-average denominator (CR-02)
    - Pre-transaction validation for import tamper guard (WR-05)
    - Fire-and-forget .catch pattern for IDB write-back (WR-02)
key_files:
  created: []
  modified:
    - src/domains/food/food.atoms.ts
    - src/test/food.atoms.test.ts
    - src/domains/food/planParser.ts
    - src/domains/food/planParser.test.ts
    - src/domains/food/costEngine.ts
    - src/domains/food/costEngine.test.ts
    - src/storage/storage.ts
    - src/test/storage.food.test.ts
decisions:
  - WR-02 lag: documented eventual-consistency over observable refactor (lower risk; CR-01 ratchet makes lag safe)
  - WR-05 attack surface: null/string values in JSON (not NaN/Infinity which serialize to null)
  - CR-02 mealDays: computed by splitting body on ## ...YYYY-MM-DD headers per section
metrics:
  duration: 12m
  completed: "2026-05-31T00:13:26Z"
  tasks_completed: 4
  tasks_total: 4
  files_changed: 8
  tests_before: 929
  tests_after: 960
  tests_added: 31
---

# Phase 04 Plan 07: Gap Closure (CR-01, CR-02, WR-05, WR-02) Summary

Four fixes from the Phase 4 deep code review — two C1 blockers and two warnings — closing the gap in the protected food floor chain before re-review.

## What Was Built

**CR-01 — Displayed floor ratcheted to allTimeHighWater (Reading A, C1 blocker)**

The live `foodFloorAtom` now returns `Math.max(result.floor, meta.allTimeHighWater ?? 0)` on BOTH the clean-live and gapped-live paths. Before this fix, a shorter month (28 vs 31 days) with identical meals would show a lower protected floor — exactly the restriction signal C1 forbids. The ratchet is strictly one-directional: `solvencyFloor` stays realistic (not ratcheted), and the write-back still uses `result.floor` (the raw computed value, not the clamped display). High-water is written only on clean results so it is always a real, uninfluenced value.

**CR-02 — Divide by days-with-meals, not calendar span (C1 blocker)**

Added `ParsedPlan.mealDays: number` — count of distinct calendar days with ≥1 meal slot. The parser splits the body on `## ...YYYY-MM-DD` section headers (works for both table-format and prose-format batch files) and counts sections that carry at least one meal row. Single-day files return `mealDays = 1`. The `foodFloorAtom` now uses `Math.max(selectedPlan.mealDays, 1)` as the `windowDays` argument to `computeFloor` instead of the raw `planDaySpan`. `planDaySpan` is retained only for the overlap-guard selection (narrowest-window reduce). Dividing by a smaller, correct denominator keeps the floor conservative — skipping a day raises the daily average, never lowers it.

**WR-05 — Import validates food-field finiteness (C1-adjacent)**

Added `validateFoodSettingsForImport()` in `storage.ts`, called BEFORE opening the Dexie transaction in `replaceAll`. This ensures a failed validation leaves the database completely untouched (no partial write). Validates: `foodFloorMeta.lastComputedFloor` and `allTimeHighWater` must be finite numbers (not null, not strings); `unitCostMap[].costPerUnit` and `portionModel[].portionSize` likewise. Note: standard JSON cannot represent NaN or Infinity (they serialize to `null`) — the real attack vector is `null` or non-numeric types in financial fields, which are now rejected.

**WR-02 — Robust write-back `.catch` + lag documented**

Replaced the empty `.then(() => {})` on the fire-and-forget `saveFoodFloorMeta` write-back with `.catch((err) => { console.warn(...) })`. A failed IDB write (quota, blocked upgrade, closed connection) no longer creates an unhandled promise rejection. The one-cycle lag (allTimeHighWater not visible to the very next read) is documented as safe: CR-01's ratchet ensures `Math.max(result.floor, meta.allTimeHighWater)` on every read prevents any visual floor drop even during the lag window. The lower-risk documented approach was chosen over converting `foodFloorMetaAtom` to `atomWithObservable`.

## Decisions Made

1. **WR-02: documented lag over observable refactor.** The `atomWithObservable` approach would eliminate the lag but introduces higher change risk (new reactive path, new storage observable, React 19 interaction concern from Phase 1). The lag is safe because CR-01's per-cycle ratchet absorbs it. Recorded in SUMMARY for re-review.

2. **WR-05: null/string is the attack surface, not NaN.** `JSON.stringify` converts NaN and Infinity to `null`. The guard rejects any non-finite-number value for financial fields — covering the actual JSON attack vectors.

3. **CR-02: section-header parsing.** The `## ...YYYY-MM-DD` heading regex (`/^##\s+(?:\w+\s+)?(\d{4}-\d{2}-\d{2})/gm`) covers both SMC batch formats (table: `## Monday 2026-05-25`, prose: `## 2026-05-29 (Friday)`). Verified against all 5 fixture files.

## Deviations from Plan

**1. [Rule 1 - Bug] Removed unused `makeLivePlanStore` helper from food.atoms.test.ts**
- **Found during:** Task 1 (tsc -b cleanup)
- **Issue:** Helper declared but never used — tsc error TS6133
- **Fix:** Removed the dead helper function
- **Files modified:** src/test/food.atoms.test.ts

**2. [Rule 1 - Bug] Added `mealDays` to costEngine.test.ts isPlanCurrent fixtures**
- **Found during:** Task 4 (tsc -b after Task 2)
- **Issue:** isPlanCurrent test plan literals missing `mealDays` field after CR-02 added it to ParsedPlan — tsc error TS2345
- **Fix:** Added `mealDays: N` to all plan object literals in isPlanCurrent tests
- **Files modified:** src/domains/food/costEngine.test.ts

**3. [Rule 2 - Correctness] WR-05 test approach updated from NaN injection to null injection**
- **Found during:** Task 3 GREEN phase
- **Issue:** JSON.stringify converts NaN/Infinity to null, so tests injecting `NaN` via `JSON.stringify` were not actually testing the real attack vector
- **Fix:** Rewrote tests to use raw JSON strings injecting `null` and string `"NaN"` — the actual JSON attack vectors
- **Files modified:** src/test/storage.food.test.ts

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The import validation (WR-05) narrows the existing threat surface rather than expanding it.

## Known Stubs

None. All 4 fixes are fully wired and exercised by tests.

## Self-Check: PASSED

- [x] `src/domains/food/food.atoms.ts` exists and contains `Math.max(result.floor, meta.allTimeHighWater ?? 0)` (CR-01)
- [x] `src/domains/food/planParser.ts` exists and contains `mealDays` (CR-02)
- [x] `src/storage/storage.ts` exists and contains `validateFoodSettingsForImport` (WR-05)
- [x] Commits exist: 6e711a9 (CR-01), ae21607 (CR-02), 763f227 (WR-05), 59d2aec (WR-02)
- [x] Full vitest suite: 960 passed (71 files)
- [x] `tsc -b`: clean (0 errors)
