// Expense domain — reactive Jotai atom chain.
//
// Source atom: atomWithObservable over storage.observeExpenseItems().
//   initialValue:[] prevents Suspense (Pitfall 1 / React 19 re-suspension bug).
//
// survivalFloorAtom: the headline output of Phase 3, updated in Phase 4 (04-04, 04-06).
//   survival_floor = fixed_ex_food + Σ(sinking-fund monthlyAccruals) + foodFloorAtom.solvencyFloor
//   Phase 4 (04-04): floors.foodSeed replaced by the live/reactive food floor (V7).
//   Phase 4 (04-06): switched from foodFloorAtom.floor to foodFloorAtom.solvencyFloor (V8).
//     Rationale: the displayed floor (FoodFloorResult.floor) is conservatively inflated when any
//     meal falls back to the ceiling ($15 or $5). With only 3 of ~15 ingredients seeded, all
//     16 slots hit the ceiling → floor ≈ $2,480, pushing survivalFloor to $4,265 — a solvency
//     number hostage to an unconfigured cost map. solvencyFloor is the REALISTIC food estimate:
//       gapped-live: max(lastComputedFloor, allTimeHighWater, DEFAULT_FOOD_FLOOR_SEED)
//       clean-live:  equals floor (real computed value)
//       stale:       equals floor (already realistic)
//     Understating food in solvency is the clinically-safe direction; overstating it breaks
//     the dashboard. /food still displays the conservative-high floor (C1 unchanged).
//   Import direction: expenses → food (one-way; food never imports expenses — Pitfall 4).
//   Async because foodFloorAtom is async (IDB + glob load on first access).
//   NEVER stored (FOUND-06) — always derived from source atoms.
//
// Boundary: this file imports `storage` and schema types only — NEVER `db`.
//   Grep gate enforced by plan 03-01 acceptance criteria.

import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import { toMonthlyEquivalent } from '../../storage/schema'
import { sinkingFundAccrualsAtom } from '../funds/funds.atoms'
import { foodFloorAtom } from '../food/food.atoms'
import type { ExpenseItem } from '../../storage/schema'

// ── Source atom ────────────────────────────────────────────────────────────────

export const expenseItemsAtom = atomWithObservable<ExpenseItem[]>(
  () => storage.observeExpenseItems(),
  { initialValue: [] },
)

// ── Classification split atoms (for /expenses categorized view — Plan 02) ──────

export const protectedExpensesAtom = atom((get): ExpenseItem[] =>
  get(expenseItemsAtom).filter((i) => i.classification === 'protected'),
)

export const gateableExpensesAtom = atom((get): ExpenseItem[] =>
  get(expenseItemsAtom).filter((i) => i.classification === 'gateable'),
)

// ── fixed_ex_food: PROTECTED expense lines normalised to monthly (D-08, D-10) ──
// Only PROTECTED lines feed the floor; GATEABLE and oneoff-cadence lines do not.

const fixedExFoodAtom = atom((get): number =>
  get(protectedExpensesAtom).reduce(
    (sum, i) => sum + toMonthlyEquivalent(i.amount, i.cadence),
    0,
  ),
)

// ── survivalFloorAtom (EXP-03, D-08, V8) ─────────────────────────────────────
// survival_floor = fixed_ex_food + Σ(monthlyAccruals) + foodFloorAtom.solvencyFloor
//
// Phase 4 (04-04): floors.foodSeed replaced by the computed food floor (V7).
// Phase 4 (04-06): switched to solvencyFloor instead of floor (V8).
//   solvencyFloor is the REALISTIC food estimate — never the fallback-inflated
//   displayed floor. An unconfigured cost map cannot inflate solvency.
//   /food still displays the conservative-high floor (C1 unchanged).
// foodFloorAtom is async (glob load + IDB reads on first access).
//
// Import direction: food.atoms → this file (expenses → food, never reverse).
// Pitfall 4: food.atoms.ts does NOT import expenses.atoms.ts. One-way.
//
// Solvency math uses the PASSIVE floor (via income surplusAtom), NEVER the
// defended line ($3,000) or average. survivalFloorAtom is the food-inclusive
// monthly floor — the minimum income needed to avoid negative solvency.
//
// Pitfall 3: wrap in <Suspense> in any component that reads this atom.

export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const { solvencyFloor } = await get(foodFloorAtom)   // REALISTIC food estimate (V8); displayed floor unchanged
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + solvencyFloor
})

// ── Write atoms ────────────────────────────────────────────────────────────────
// Write-only. No refresh counter — liveQuery re-emits automatically on IDB write.

export const saveExpenseItemAtom = atom(
  null,
  async (_get, _set, item: Omit<ExpenseItem, 'id'>): Promise<void> => {
    await storage.addExpenseItem(item)
  },
)

export const updateExpenseItemAtom = atom(
  null,
  async (_get, _set, { id, patch }: { id: number; patch: Partial<ExpenseItem> }): Promise<void> => {
    await storage.updateExpenseItem(id, patch)
  },
)

export const deleteExpenseItemAtom = atom(
  null,
  async (_get, _set, id: number): Promise<void> => {
    await storage.deleteExpenseItem(id)
  },
)
