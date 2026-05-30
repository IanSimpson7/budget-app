---
phase: 04-food-contract-locked-floor
plan: "03"
subsystem: food-domain
tags: [cost-engine, tdd, c1-critical, pure-function, food-floor]
dependency_graph:
  requires: [04-01]
  provides: [computeFloor, isPlanCurrent, fallbackFloor, FALLBACK_CEILING_PER_MEAL, FloorGap, CostEngineResult]
  affects: [04-04, 04-05]
tech_stack:
  added: []
  patterns: [table-driven-tdd, discriminated-union-gaps, property-style-invariant-tests]
key_files:
  created:
    - src/domains/food/costEngine.ts
    - src/domains/food/costEngine.test.ts
  modified: []
decisions:
  - "FALLBACK_CEILING_PER_MEAL = 15: static constant (not dynamic most-expensive-meal) for deterministic fallback before any meals are defined (RESEARCH A4)"
  - "ParsedPlan interface defined locally in costEngine.ts to allow parallel Wave-2 compilation without hard dependency on planParser.ts"
  - "Entire meal falls back to FALLBACK_CEILING_PER_MEAL on any unpriced ingredient — never the partial sum (C1-critical; partial sum would silently undercount the floor)"
  - "flavor-condiment tagged ingredients absent from cost map treated as unpriced macro-bearing (conservative I-05 default) not silently excluded"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-30T11:02:20Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 03: Cost Engine (Locked Floor) Summary

Pure cost engine turning (scheduled meals + meal definitions + unit-cost map + portion model) into the protected floor number and an itemized gap list — fallback-high on every uncertainty, with `max(last, high-water)` stale path — proven by 31 table-driven unit tests.

## What Was Built

**`src/domains/food/costEngine.ts`** — Pure function module, zero Dexie/React/jotai imports.

Exports:
- `FALLBACK_CEILING_PER_MEAL = 15` — Open Question 1 resolved; $15 conservative-high constant
- `computeFloor(input: CostEngineInput): CostEngineResult` — the C1-critical math
- `isPlanCurrent(plans, today): boolean` — D-08 staleness detection
- `fallbackFloor(meta): number` — D-07 never-lower stale path
- Types: `FloorGap`, `CostEngineInput`, `CostEngineResult`, `ParsedPlan`

**`src/domains/food/costEngine.test.ts`** — 31 tests covering:
- V3a: unpriced ingredient (missing from cost map, or costPerUnit === 0)
- V3b: undefined meal (no MealDefinition row)
- V3c: unset flat cost (flat-cost meal without flatCost field)
- D-05: flavor-condiment exclusion (macro-bearing-only sum)
- FOOD-06/09: fully-priced decomposed + flat-cost meals, new meals from existing ingredients
- V4: monthly derivation (1-day and 7-day windows; daysInMonth scaling proves I-01 contract)
- V5 / D-08: isPlanCurrent — all boundary conditions (start, end, single-day, multi-plan)
- V5 / D-07: fallbackFloor — max(last, highWater) with property-style never-lower invariant
- Pitfall 7: computeFloor independent of meta high-water (live floor not clamped by stale value)

## Open Question 1 — Resolved

**FALLBACK_CEILING_PER_MEAL = $15.00**

Rationale: Qdoba bowl ~$11; a full prep-cooked meal ~$3–5. $15 is conservative-high per meal. Chosen as a static module constant (not "most-expensive-defined-meal") so the fallback is deterministic even before Ian defines any meals in early setup. Per RESEARCH Open Question 1 / A4.

## C1 Guarantee

Every gap path contributes `FALLBACK_CEILING_PER_MEAL` to the total scheduled cost — never $0, never a partial sum that omits the unpriced ingredient. The engine's gap identification and fallback-high logic directly mitigates T-04-08 (Tampering: floor computation undercount).

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED  | `753bd1e` | test(04-03): 30 failing + 1 passing (constant test) |
| GREEN | `08a8569` | feat(04-03): 31/31 passing, tsc clean |
| REFACTOR | — | Not required; implementation is clean |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `753bd1e` | test | RED — failing tests for cost engine V3/V4/V5 |
| `08a8569` | feat | GREEN — full implementation, 31/31 pass, tsc clean |

## Deviations from Plan

**1. [Rule 3 - Blocking] food.types.ts not yet in worktree**

- **Found during:** Task 1 setup (Wave 2 parallel execution)
- **Issue:** Plan 01 agent committed food.types.ts to its own worktree; it wasn't available in this worktree at build time
- **Fix:** Copied food.types.ts from the main repo (where Plan 01's initial commit landed) into the worktree. Content is identical to Plan 01's output.
- **Files modified:** `src/domains/food/food.types.ts` (added to worktree, not changed)

**2. [Rule 1 - Bug] Missing `ingredients` field on flat-cost MealDefinition fixtures**

- **Found during:** TypeScript compile check after GREEN
- **Issue:** MealDefinition type requires `ingredients: string[]` on all meal rows (including flat-cost), but test fixtures for QDOBA_DEF and FLAT_NO_COST_DEF omitted it
- **Fix:** Added `ingredients: []` to both flat-cost fixtures in costEngine.test.ts
- **Files modified:** `src/domains/food/costEngine.test.ts`

**3. [Rule 1 - Bug] Unused `CostEngineResult` import in test file**

- **Found during:** TypeScript compile check after GREEN
- **Issue:** `CostEngineResult` was imported as a type but unused
- **Fix:** Removed from import list
- **Files modified:** `src/domains/food/costEngine.test.ts`

**4. [Design decision] ParsedPlan defined locally in costEngine.ts**

- **Found during:** Task 1 planning
- **Issue:** Plan 02 (planParser.ts) runs in the same Wave 2; planParser.ts may not be committed when costEngine.ts compiles
- **Fix:** Defined a local `ParsedPlan` interface in costEngine.ts matching the Plan-02 contract. Once both plans merge, the types are compatible (same fields). No duplicate behavior — just the minimal type needed by `isPlanCurrent`.

## Known Stubs

None. The cost engine is fully implemented with no placeholder logic.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. costEngine.ts is a pure computation module. Threat mitigations T-04-08, T-04-09, and T-04-10 are all addressed:

| Threat | Mitigation | Verified by |
|--------|-----------|-------------|
| T-04-08: floor undercount | FALLBACK_CEILING_PER_MEAL on all three gap types | V3a/V3b/V3c tests |
| T-04-09: stale-plan undercount | fallbackFloor = max(last, highWater) | V5 property-style invariant |
| T-04-10: high-water ratchets live floor | computeFloor independent of meta | Pitfall 7 test |

## Self-Check: PASSED

- `src/domains/food/costEngine.ts` — exists in worktree
- `src/domains/food/costEngine.test.ts` — exists in worktree
- Commit `753bd1e` — RED gate (test commit)
- Commit `08a8569` — GREEN gate (feat commit)
- 31/31 tests pass, `tsc -b` clean
