---
phase: 02-income-model-with-two-floors
plan: 01
subsystem: storage
tags: [schema-migration, income-crud, settings, observable, tdd, wave0-scaffolds]
dependency_graph:
  requires: []
  provides: [income-crud, known-source-settings, estimate-settings, observe-income-checks, schema-v2, migrate-1-to-2, wave0-test-targets]
  affects: [src/storage/schema.ts, src/storage/db.ts, src/storage/migrations.ts, src/storage/storage.ts, src/domains/income/income.types.ts]
tech_stack:
  added: [liveQuery (Dexie v4 Observable)]
  patterns: [settings-singleton, spread-before-add (fake-indexeddb mutation guard), liveQuery-seam (Pitfall 5)]
key_files:
  created:
    - src/domains/income/income.types.ts
    - src/test/storage.income.test.ts
    - src/test/migrations.test.ts
    - src/domains/income/parser/__fixtures__/checking-may-2026.txt
    - src/domains/income/parser/parseStatement.test.ts
    - src/domains/income/classify.test.ts
    - src/domains/income/income.atoms.test.ts
    - src/components/IncomeBar.test.tsx
    - src/domains/income/PasteParseFlow.test.tsx
  modified:
    - src/storage/schema.ts
    - src/storage/db.ts
    - src/storage/migrations.ts
    - src/storage/storage.ts
    - src/test/storage.test.ts
decisions:
  - "Sequential adds in addIncomeChecks (not Promise.all) to avoid fake-indexeddb ConstraintError on auto-increment stores after db delete/reopen cycles"
  - "Spread input objects before db.incomeChecks.add() to prevent fake-indexeddb ObjectStore.storeRecord mutation of caller's object"
  - "Wave 0 test files use inline fixture strings instead of node:fs readFileSync — browser tsconfig has no @types/node"
  - "CURRENT_SCHEMA_VERSION bumped to 2; version(2).stores() uses same indexes as v1 (field-only addition, no new indexes needed per A2)"
metrics:
  duration: "~2 hours (context compacted mid-session)"
  completed: "2026-05-28"
  tasks_completed: 3
  files_changed: 14
---

# Phase 2 Plan 01: Storage v2 + Income CRUD + Wave 0 Scaffolds Summary

Schema v2 with IncomeCheck/KnownSource types, migrate_1_to_2 migration, full income CRUD + settings persistence + db-free reactive observable, and Wave 0 test scaffolds targeting plans 02-02 through 02-05.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Bump schema to v2 + IncomeCheck/KnownSource types + register migrate_1_to_2 | 3130547 | schema.ts, migrations.ts, db.ts, migrations.test.ts, storage.test.ts |
| 2 | Income CRUD + known-source/estimate settings + observeIncomeChecks | 2ded3b0 | storage.ts, db.ts, income.types.ts, storage.income.test.ts |
| 3 | Wave 0 test scaffolds + May-2026 gold fixture | 56f9ebb | 6 new test/fixture files |

## What Was Built

### Schema (schema.ts)
- `CURRENT_SCHEMA_VERSION = 2 as const`
- `Category = 'payroll' | 'gift' | 'other'`
- `IncomeCheck` — D-08 fields (`id?`, `date`, `netAmount`, `source`, `note`, `category`, `taxable`) + D-12 `surplusOverride?`
- `KnownSource` — D-06 fields (`source`, `category`, `taxable`)

### Migration (migrations.ts)
- `migrate_1_to_2`: seeds `settings.knownSources = []` when absent; income rows untouched (v1 had none)
- `MIGRATIONS = { 1: migrate_1_to_2 }` — now registered, so v1 JSON backups import without throwing INVALID_ENVELOPE

### DB (db.ts)
- `incomeChecks` retyped as `Table<IncomeCheck, number>`
- `.version(2).stores(...)` chained — same indexes, version advanced to keep Dexie and import ladder aligned (A2)

### Storage (storage.ts)
- Income CRUD: `addIncomeCheck`, `addIncomeChecks`, `listIncomeChecks`, `updateIncomeCheck`, `deleteIncomeCheck`
- Settings helpers: `getKnownSources`/`saveKnownSources` (D-06), `getEstimatePerCheck`/`saveEstimatePerCheck` (D-11)
- `observeIncomeChecks(): Observable<IncomeCheck[]>` — `liveQuery(() => db.incomeChecks.toArray())` — Pitfall 5 seam
- `collectSchemaV1Data` extended to populate `incomeChecks` from DB
- `replaceAll` extended to re-seed income rows from `data.incomeChecks` on import
- C2/C3 absence still enforced structurally (no credentials/money-move methods; absence proof in storage.test.ts extended with `executeSweep`/`decreaseFoodFloor`)

### Wave 0 Test Scaffolds
- `checking-may-2026.txt`: tab-delimited fixture with 2 PAYROLL checks + VANGUARD SELL + 2x VENMO + Cashback (NOTE: constructed from 02-CONTEXT.md figures, not from Ian's raw paste — must be reconciled against real paste during UAT)
- `parseStatement.test.ts`: 1 assertion + 6 todos → target for plan 02-02
- `classify.test.ts`: 1 assertion + 5 todos → target for plan 02-02
- `income.atoms.test.ts`: 1 assertion (total = 2424.10) + 8 todos → target for plan 02-03
- `IncomeBar.test.tsx`: smoke + 8 todos → target for plan 02-04
- `PasteParseFlow.test.tsx`: 1 assertion + 7 todos → target for plan 02-05

## Test Results

- 47 passing, 34 todo, 0 failing across 11 test files
- `npx tsc -b --noEmit` exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fake-indexeddb object mutation causing ConstraintError on addIncomeChecks**
- **Found during:** Task 2 debugging
- **Issue:** fake-indexeddb's `ObjectStore.storeRecord` calls `Object.defineProperty(inputObject, 'id', ...)` on the caller's object when assigning the auto-increment key, mutating module-level constants like `SAMPLE_CHECK`. On subsequent tests, spread objects inherit `id: 1`, and the second add fails with ConstraintError when that id already exists.
- **Fix:** Spread input objects before passing to `add()`: `db.incomeChecks.add({ ...check } as IncomeCheck)` in both `addIncomeCheck` and `addIncomeChecks`
- **Files modified:** src/storage/storage.ts
- **Commit:** 2ded3b0

**2. [Rule 3 - Blocking] addIncomeChecks uses sequential adds, not Promise.all**
- **Found during:** Task 2 (plan specified Promise.all; sequential was required for correctness)
- **Issue:** `Promise.all` over sequential `db.incomeChecks.add()` calls on a fake-indexeddb store that has been delete/reopened causes ConstraintError (known fake-indexeddb v6 + Dexie v4 issue with auto-increment stores). In production real IDB, sequential adds are fast enough and safe.
- **Fix:** Implemented `for...of` loop with `await` instead of `Promise.all`; documented in code comment
- **Files modified:** src/storage/storage.ts
- **Commit:** 2ded3b0

**3. [Rule 3 - Blocking] Wave 0 scaffolds use inline fixture strings instead of node:fs**
- **Found during:** Task 3 — TypeScript compilation
- **Issue:** Project tsconfig has no `@types/node`; `node:fs`/`node:path`/`__dirname` cause TS2307/TS2304 errors in test files
- **Fix:** Replaced `readFileSync` + `__dirname` with inline fixture string literals in parseStatement.test.ts and PasteParseFlow.test.tsx
- **Files modified:** src/domains/income/parser/parseStatement.test.ts, src/domains/income/PasteParseFlow.test.tsx
- **Commit:** 56f9ebb

## Known Stubs

None — this plan is a persistence/infrastructure layer. No UI components were built; all test placeholders are `it.todo()` (intentional Wave 0 scaffolds, not stubs in the data-flow sense).

**Fixture reconciliation required at UAT:** `checking-may-2026.txt` is constructed from documented figures, not Ian's actual bank statement paste. Before plan 02-02's parser is considered production-ready, compare the fixture format against the real paste and update if the column order, delimiter, or metadata block format differs.

## Threat Flags

No new threat surface beyond T-02-01/T-02-02 already in the plan's threat model. `importAll` validation unchanged; C2/C3 absence proof extended and green.

## Self-Check: PASSED

- src/storage/schema.ts — FOUND, contains `CURRENT_SCHEMA_VERSION = 2`
- src/storage/migrations.ts — FOUND, contains `migrate_1_to_2`
- src/storage/storage.ts — FOUND, contains `observeIncomeChecks`
- src/domains/income/income.types.ts — FOUND
- src/domains/income/parser/__fixtures__/checking-may-2026.txt — FOUND
- src/test/storage.income.test.ts — FOUND
- Commits 3130547, 2ded3b0, 56f9ebb — FOUND in git log
