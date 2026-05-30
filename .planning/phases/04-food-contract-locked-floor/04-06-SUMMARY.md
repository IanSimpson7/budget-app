---
phase: 04-food-contract-locked-floor
plan: "06"
subsystem: food-floor-engine
tags: [gap-closure, solvency, cost-engine, fallback, tdd]
dependency_graph:
  requires: [04-01, 04-03, 04-04]
  provides: [FALLBACK_CEILING_SNACK, classifyMealKind, FoodFloorResult.solvencyFloor, survivalFloorAtom-V8]
  affects: [survivalFloorAtom, costEngine, food.atoms, expenses.atoms]
tech_stack:
  added: []
  patterns: [kind-aware-fallback, solvency-decoupling, most-specific-plan-selection]
key_files:
  created: []
  modified:
    - src/domains/food/costEngine.ts
    - src/domains/food/costEngine.test.ts
    - src/domains/food/food.atoms.ts
    - src/test/food.atoms.test.ts
    - src/domains/expenses/expenses.atoms.ts
    - src/test/expenses.atoms.test.ts
decisions:
  - "FALLBACK_CEILING_SNACK=5 for snack/shake occasions; FALLBACK_CEILING_MEAL=15 for full meals (FALLBACK_CEILING_PER_MEAL kept as @deprecated alias)"
  - "classifyMealKind: fallback-only heuristic; exact pricing supersedes it once ingredients are priced"
  - "solvencyFloor on gapped-live = max(lastComputedFloor, allTimeHighWater, DEFAULT_FOOD_FLOOR_SEED); floor itself unchanged (C1)"
  - "Most-specific-plan selection: narrowest window span wins; tie-break latest windowStart; removes flat-map double-count"
  - "V8 note added to survivalFloorAtom: solvencyFloor is realistic; floor is conservative-high for display"
metrics:
  duration: "596 seconds (~10 minutes)"
  completed_date: "2026-05-30"
  tasks: 3
  files_modified: 6
---

# Phase 4 Plan 06: Gap Closure (b/c/d) Summary

Three independent solvency correctness fixes: kind-aware fallback ceiling, decouple solvency from fallback-high, overlap double-count guard.

## Tasks Completed

| Task | Name | RED Commit | GREEN Commit |
|------|------|-----------|-------------|
| 1 | (b) Kind-aware fallback ceiling — classifyMealKind, FALLBACK_CEILING_SNACK | `aafa57f` | `0b5d94e` |
| 2 | (c+d) solvencyFloor field + single most-specific plan selection | `302f867` | `a05f20f` |
| 3 | (c) wire — survivalFloorAtom consumes solvencyFloor | `d086300` | `1ccdf01` |

Fix commit (Rule 1): `6c1ff85` — TypeScript object literal fixtures needed `solvencyFloor` field after interface extension.

## What Was Built

**Task 1 — Kind-aware fallback ceiling**
- `FALLBACK_CEILING_MEAL = 15` (full meal, unchanged conservative value)
- `FALLBACK_CEILING_SNACK = 5` (snack/shake/light occasion, conservative-high for a light item)
- `FALLBACK_CEILING_PER_MEAL` kept as `@deprecated` back-compat alias = `FALLBACK_CEILING_MEAL`
- `classifyMealKind(mealName): 'meal' | 'snack'` — pure fallback-only heuristic using 6 snack keywords: `shake`, `cereal`, `yogurt`, `rice cake`, `cream pie`, `granola`
- Corpus-verified against all 14 known meal strings: exactly 6 classify as snack, 8 as meal
- All 3 fallback paths in `computeFloor` now use `classifyMealKind`-aware ceiling

**Task 2 — solvencyFloor + overlap guard**
- `FoodFloorResult.solvencyFloor: number` added
  - Clean-live: `solvencyFloor = floor` (real computed value)
  - Gapped-live: `solvencyFloor = max(lastComputedFloor, allTimeHighWater, DEFAULT_FOOD_FLOOR_SEED)` — NOT the fallback-inflated floor
  - Stale: `solvencyFloor = floor` (stale floor already realistic)
  - `floor` itself UNCHANGED on every path (C1 invariant preserved)
- Replaced flat-map + union-of-days with single most-specific-plan selection:
  - Narrowest window span wins; tie-break: latest `windowStart`; final: last in array
  - Single-plan case is unchanged (common path, no regression)

**Task 3 — survivalFloorAtom V8 wire**
- `expenses.atoms.ts`: `const { solvencyFloor } = await get(foodFloorAtom)` — uses realistic estimate
- Header comment updated: V8 note explains why solvency uses `solvencyFloor`, clinical rationale documented

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FoodFloorResult object literal fixtures missing solvencyFloor field**
- **Found during:** After task 3 GREEN, during `tsc -b` clean-up
- **Issue:** Two `FoodFloorResult` object literals in `food.atoms.test.ts` were constructed without `solvencyFloor`, causing TS2741 errors after `solvencyFloor` was made required on the interface
- **Fix:** Added `solvencyFloor` to both fixtures (value = `floor`, which is correct for those paths)
- **Files modified:** `src/test/food.atoms.test.ts`
- **Commit:** `6c1ff85`

**2. [Rule 1 - Bug] Two existing V7 tests asserted survivalFloor ≈ foodResult.floor**
- **Found during:** Task 3 GREEN — tests failed after wire change because they still compared to `.floor` not `.solvencyFloor`
- **Issue:** Tests `'returns food floor value (V7)'` and `'V7 propagation'` used `foodResult.floor` as the expected value; with V8 the correct comparator is `foodResult.solvencyFloor`
- **Fix:** Updated test descriptions to V8 and changed comparisons to `solvencyFloor`
- **Files modified:** `src/test/expenses.atoms.test.ts`
- **Commit:** Part of `1ccdf01`

## Verification Results

- Full vitest suite: **929 tests, all passing** (71 test files)
- `tsc -b`: clean (0 errors)
- `grep solvencyFloor src/domains/expenses/expenses.atoms.ts`: 4 occurrences (header + destructure + return)
- `grep FALLBACK_CEILING_SNACK src/domains/food/costEngine.ts`: present and used in all 3 computeFloor fallback paths
- C1 unchanged: `FoodFloorResult.floor` on gapped paths is NOT lowered; `solvencyFloor` is NEW field

## Known Stubs

None. All three fixes are fully implemented and wired end-to-end.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes. All changes are pure computation within existing atoms and the cost engine.

## Self-Check: PASSED

- Files: costEngine.ts, food.atoms.ts, expenses.atoms.ts — all present
- Commits: all 7 commits found in git log (aafa57f, 0b5d94e, 302f867, a05f20f, d086300, 1ccdf01, 6c1ff85)
