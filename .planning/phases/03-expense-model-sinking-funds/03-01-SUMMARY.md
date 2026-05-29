---
phase: 03-expense-model-sinking-funds
plan: "01"
subsystem: storage-atoms
tags: [schema, migration, dexie, jotai, expense, sinking-fund, survival-floor]
dependency_graph:
  requires:
    - 01-01 (Dexie, storage abstraction, migration ladder, schema v1/v2)
    - 02-01 (atomWithObservable + liveQuery pattern validated)
  provides:
    - ExpenseItem + SinkingFund typed end-to-end (schema → db → storage → atoms)
    - survivalFloorAtom live-derived floor (~$2,335 from seeds)
    - Expense + fund CRUD, observables, idempotent seeds, round-trip export/import
    - markFundPaidAtom (annual roll +12mo / oneoff delete — EDGE-06)
  affects:
    - 03-02 (/expenses route consumer of expenseItemsAtom, protectedExpensesAtom, saveExpenseItemAtom)
    - 03-03 (/funds route consumer of sinkingFundsAtom, isOnTrack, markFundPaidAtom)
tech_stack:
  added: []
  patterns:
    - atomWithObservable + liveQuery for reactive expense + fund lists
    - Dual-guard seed (settings sentinel + existing-row check) for Pitfall 4
    - Local Date constructor (year, month-1, 1) for YYYY-MM date arithmetic (Pitfall 2)
    - T-03-01/02 non-finite guards at storage write + import boundaries
key_files:
  created:
    - src/domains/expenses/expenses.atoms.ts
    - src/domains/funds/funds.atoms.ts
    - src/test/storage.expenses.test.ts
    - src/test/storage.funds.test.ts
    - src/test/expenses.atoms.test.ts
    - src/test/funds.atoms.test.ts
  modified:
    - src/storage/schema.ts
    - src/storage/migrations.ts
    - src/storage/db.ts
    - src/storage/storage.ts
    - src/main.tsx
    - src/test/migrations.test.ts
    - src/test/storage.test.ts
decisions:
  - "Dual-guard seed: settings sentinel PLUS existing-row count check (Pitfall 4 — sentinel alone fails when user adds rows manually without triggering seed path)"
  - "survivalFloorAtom is async (floorsLoadAtom is async); Plan 02/03 UIs must wrap in Suspense (Pitfall 3)"
  - "sinkingFundAccrualsAtom exported from funds.atoms.ts and cross-imported by expenses.atoms.ts — clean cross-domain atom dependency, no circular refs"
  - "derivedSurvivalFloorAtom in settings.atoms.ts left as Phase-1 placeholder (= passive floor); real survivalFloorAtom exported from expenses.atoms.ts supersedes it for Phase 3+ consumers"
metrics:
  duration: "~40 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 7
  tests_added: 48
  tests_total_after: 180
---

# Phase 3 Plan 1: Schema v3 + Storage CRUD + Atom Chain Summary

**One-liner:** ExpenseItem + SinkingFund typed end-to-end through schema v3, Dexie v3 tables, storage CRUD with NaN guards and idempotent seeds, and a reactive Jotai atom chain producing the live ~$2,335 survival floor.

---

## What Was Built

### Task 1: Schema v3 types + migration + Dexie typed tables

- `schema.ts`: Added `Classification`, `Cadence`, `SinkingFundCadence` union types; `ExpenseItem` and `SinkingFund` Readonly types following the `IncomeCheck` convention; `toMonthlyEquivalent(amount, cadence)` pure function (monthly as-is, annual/12, oneoff→0); bumped `CURRENT_SCHEMA_VERSION` 2→3.
- `migrations.ts`: Added `migrate_2_to_3` (no-op data transform — tables were empty in v2; nullish-coalesces arrays to `[]`); registered as `MIGRATIONS[2]`. Migration ladder is now contiguous 1→2→3.
- `db.ts`: Retyped `expenseItems!: Table<ExpenseItem, number>` and `sinkingFunds!: Table<SinkingFund, number>`; added `.version(3).stores()` with updated `expenseItems` index (`++id, name, classification, cadence` — replaces the v1 dual-bool `protected` + `category` columns per D-02).
- 9 new migration tests + 4 toMonthlyEquivalent tests; updated 1 stale hardcoded assertion in storage.test.ts.

### Task 2: Storage CRUD + observables + seeds + export/import wiring

- `storage.ts`: Added full CRUD + observe for expenses (`addExpenseItem`, `listExpenseItems`, `updateExpenseItem`, `deleteExpenseItem`, `observeExpenseItems`) and sinking funds (identical set). Non-finite guards on financial fields (T-03-02). `seedExpensesIfEmpty` inserts 4 PROTECTED rows (Housing/Electric/Fuel/Claude — no car insurance, no whey) with dual-guard idempotency. `seedFundsIfEmpty` inserts the car-insurance annual fund instance. `collectSchemaV1Data` stubs replaced with real `db.expenseItems.toArray()` + `db.sinkingFunds.toArray()`. `replaceAll` now restores both tables with id-strip + T-03-01 non-finite validation on import.
- 14 storage.expenses tests + 12 storage.funds tests covering EXP-01/02/04/05/07, non-finite guards, export round-trips, no-double-count (no /insurance/i in expense seed), no-whey.

### Task 3: Reactive atom chain + seed wiring in main.tsx

- `funds.atoms.ts`: `sinkingFundsAtom` (atomWithObservable, initialValue:[]), `sinkingFundAccrualsAtom` (exported sum for cross-domain import), `monthsUntilPayout` (local Date constructor — Pitfall 2), `isOnTrack` (D-06 projection formula), `markFundPaidAtom` (annual: reset balance + advance payoutDate via `setFullYear` +1; oneoff: delete — EDGE-06), `saveFundAtom`/`updateFundAtom`/`deleteFundAtom`.
- `expenses.atoms.ts`: `expenseItemsAtom` (atomWithObservable), `protectedExpensesAtom`/`gateableExpensesAtom` (classification filters for Plan 02), `fixedExFoodAtom` (sum of PROTECTED lines via toMonthlyEquivalent), `survivalFloorAtom` (async: fixedExFood + accruals + floors.foodSeed), `saveExpenseItemAtom`/`updateExpenseItemAtom`/`deleteExpenseItemAtom`.
- `main.tsx`: fire-and-forget `seedExpensesIfEmpty()` + `seedFundsIfEmpty()` before render.
- 10 expenses.atoms tests + 12 funds.atoms tests covering EXP-03, FOUND-06, cadence normalisation, survivalFloor≈2335 sanity, markFundPaid annual roll, YYYY-13 guard, oneoff delete.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dual-guard for seed idempotency**
- **Found during:** Task 2 (storage tests)
- **Issue:** Settings-sentinel-only approach fails when a user adds rows manually without triggering the seed path — the sentinel is never written, so the next `seedExpensesIfEmpty()` call would still fire and double-insert rows.
- **Fix:** Added a second guard: `db.expenseItems.where('classification').equals('protected').count() > 0` for expenses; `db.sinkingFunds.count() > 0` for funds. Both conditions independently halt seeding.
- **Files modified:** `src/storage/storage.ts`
- **Commit:** 548ea54

**2. [Rule 1 - Bug] Hardcoded `toBe(2)` in storage.test.ts became stale after schema bump**
- **Found during:** Task 1 full-suite run
- **Issue:** `storage.test.ts` line 53 had `expect(envelope.schemaVersion).toBe(2)` which failed after bumping to v3.
- **Fix:** Updated to `toBe(3)`.
- **Files modified:** `src/test/storage.test.ts`
- **Commit:** e4a7f90

**3. [Rule 1 - Bug] migrations.test.ts had stale VERSION_TOO_NEW test using schemaVersion:3**
- **Found during:** Task 1 test design
- **Issue:** `schemaVersion:3` was used as "too new" but once we bump to v3 that version is current and the import succeeds rather than throwing.
- **Fix:** Updated test to use `schemaVersion:4` as the too-new value.
- **Files modified:** `src/test/migrations.test.ts`
- **Commit:** e4a7f90

---

## Threat Flags

No new threat surface introduced beyond what was already in the plan's threat model (T-03-01 through T-03-04). All mitigations implemented:
- T-03-01: non-finite validation in `replaceAll` import loops — throws `ImportError('INVALID_ENVELOPE')`.
- T-03-02: non-finite guards in `addExpenseItem` and `addSinkingFund`.
- T-03-03: no credential/money-movement methods added; existing absence proofs still pass.
- T-03-04: accepted (Dexie key-based settings write, low risk).

---

## Known Stubs

None. All stub patterns from the Phase 2 storage.ts (`expenseItems: []`, `sinkingFunds: []`) have been replaced with real IDB queries. The plan's goal is fully achieved.

---

## Self-Check: PASSED

All 12 created/modified source files found on disk. All 3 task commits present (e4a7f90, 548ea54, b40c952). 180 tests passing, `npx tsc -b` clean.
