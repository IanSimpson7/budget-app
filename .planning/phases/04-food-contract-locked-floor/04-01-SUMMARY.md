---
phase: 04
plan: 01
subsystem: storage
tags: [food, schema, migration, storage, C1, TDD]
dependency_graph:
  requires: [03-03]
  provides: [food-types, schema-v4, meal-definitions-crud, food-singletons, meal-seed, c1-lock]
  affects: [storage.ts, schema.ts, db.ts, migrations.ts, food.types.ts, main.tsx]
tech_stack:
  added: []
  patterns: [TDD-red-green, seed-sentinel, absence-proof-test, Number.isFinite-guard, pure-migration-function]
key_files:
  created:
    - src/domains/food/food.types.ts
    - src/test/storage.food.test.ts
  modified:
    - src/storage/schema.ts
    - src/storage/db.ts
    - src/storage/migrations.ts
    - src/storage/storage.ts
    - src/main.tsx
    - src/test/migrations.test.ts
    - src/test/storage.test.ts
decisions:
  - "I-07 resolved: ingredient synonyms pre-normalized at seed time (PB→peanut butter); remaining unmapped synonyms are expected gap-list noise until Ian maps via /food/config"
  - "mealDefinitions made optional in SchemaV1Data for backward compat with v1-v3 export envelopes; migrate_3_to_4 nullish-coalesces to []"
  - "SEED_UNIT_COST_MAP seeds 3 macro-bearing entries (bulk whey, 90/10 ground beef, chicken breast) so I-04 EXP-07 handoff is satisfied from first run"
  - "Qdoba bowl seeded as flat-cost with flatCost unset → triggers fallback-high gap flag (D-04)"
  - "flavorLine persisted at seed time with default {amount:50} so getFlavorLine() always returns the configured seed, not the code default"
metrics:
  duration: "7m 29s"
  completed: "2026-05-30"
  tasks: 2
  files: 9
---

# Phase 4 Plan 1: Food Storage Foundation Summary

Schema v4 with `mealDefinitions` Dexie table, four food settings singletons, all food-domain types, seeded data (14 normalized meals + initial unit-cost map), full backup round-trip, and structurally enforced C1 lock proven by V6 absence tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing migration tests | `0432c48` | src/test/migrations.test.ts, src/test/storage.test.ts |
| 1 GREEN | Schema v4 + food types + migrate_3_to_4 | `3813f78` | food.types.ts, schema.ts, db.ts, migrations.ts, storage.ts |
| 2 RED | Failing food storage tests | `db4bae6` | src/test/storage.food.test.ts |
| 2 GREEN | Food CRUD + singletons + seed + round-trip | `d01082c` | storage.ts, main.tsx |

## Verification

- `npx tsc -b` passes with no errors
- Full test suite: 251 tests, 0 failures across 22 test files
- schema.ts: `CURRENT_SCHEMA_VERSION = 4`
- db.ts: `mealDefinitions: '++id, mealName'` in version(4).stores
- migrations.ts: `migrate_3_to_4` registered as `MIGRATIONS[3]`
- food.types.ts exports: MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta, FlavorLine, normalizeMealName
- storage.ts: `observeMealDefinitions` exported; `setFoodFloor` and `decreaseFoodFloor` absent (V6/C1)
- main.tsx: `seedMealDefinitionsIfEmpty` wired alongside existing seeds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] mealDefinitions made optional in SchemaV1Data**
- **Found during:** Task 1 implementation (tsc errors)
- **Issue:** Adding `mealDefinitions: unknown[]` (required) to `SchemaV1Data` broke every existing test that constructs a v1/v2/v3 data object without the field. Old backup envelopes don't have this field.
- **Fix:** Changed to `mealDefinitions?: unknown[]` (optional). The migrate_3_to_4 function already nullish-coalesces to `[]`, so this is correct — old envelopes still migrate cleanly.
- **Files modified:** src/storage/schema.ts
- **Commit:** 3813f78

**2. [Rule 1 - Bug] VERSION_TOO_NEW test updated from schemaVersion:4 to schemaVersion:5**
- **Found during:** Task 1 RED test authoring
- **Issue:** An existing test `importAll of a schemaVersion:4 envelope throws ImportError VERSION_TOO_NEW` was testing behavior that becomes invalid once we bump to v4. After the bump, a schemaVersion:4 envelope is the *current* version and should succeed, not throw.
- **Fix:** Updated the test to use schemaVersion:5 (the next-future-too-new version) and updated the parallel "current version" test from schemaVersion:3 to schemaVersion:4.
- **Files modified:** src/test/migrations.test.ts
- **Commit:** 0432c48

### I-07 Resolution

Meal-definition seeding normalizes the known synonym "PB" → "peanut butter" before storage. This applies to both "Eggs and PB toast" (ingredients: ['eggs', 'peanut butter', 'bread']) and "Rice cakes with peanut butter and banana" (already canonical). Other potential synonyms (e.g. "whey" vs "bulk whey") are left unmapped and will surface as unpriced-ingredient gap flags in the cost engine until Ian maps them via /food/config. This is acceptable expected noise, not a silent undercount (C1 compliant via fallback-high).

## Known Stubs

- **Qdoba bowl flatCost**: seeded as `type: 'flat-cost'` with `flatCost` unset. The cost engine (Plan 04-03) will treat an unset flatCost as a "needs cost" gap flagged for fallback-high (D-04). Ian sets the actual value via /food/config.
- **Unit-cost map is sparse**: seeds only 3 entries (bulk whey, 90/10 ground beef, chicken breast). Most meal ingredients will have no unit cost on first run — they surface as unpriced-ingredient gaps in the cost engine. Ian fills them in via /food/config (§5f manual refinement).
- **Portion model is empty**: seeded as empty []. All ingredients will have no portion size on first run — cost engine treats as zero portion (gap). Ian sets portions via /food/config.

These stubs are intentional and expected per spec §5f ("seed ~$550/mo; refine from receipts"). Plans 04-02 through 04-05 will wire the config UI that lets Ian converge these values.

## Threat Surface

No new network endpoints, auth paths, or trust boundaries introduced. All persistence is local IndexedDB via the storage abstraction. T-04-01 through T-04-03 mitigations from the plan's threat model are implemented:
- T-04-01 (C1 lock): no setFoodFloor/decreaseFoodFloor method on storage.ts; V6 absence-proof tests assert this at runtime and compile time
- T-04-02 (numeric inputs): Number.isFinite guards on costPerUnit, portionSize, flavorLine.amount before persist
- T-04-03 (JSON import): Array.isArray guard on mealDefinitions in replaceAll; whole transaction is atomic

## Self-Check: PASSED

Files created exist:
- src/domains/food/food.types.ts ✓
- src/test/storage.food.test.ts ✓

Commits exist:
- 0432c48 (test RED) ✓
- 3813f78 (feat GREEN task 1) ✓
- db4bae6 (test RED task 2) ✓
- d01082c (feat GREEN task 2) ✓

Full suite: 251/251 passing ✓
