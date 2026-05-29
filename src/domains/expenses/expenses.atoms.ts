// Expense domain — reactive Jotai atom chain.
//
// Source atom: atomWithObservable over storage.observeExpenseItems().
//   initialValue:[] prevents Suspense (Pitfall 1 / React 19 re-suspension bug).
//
// survivalFloorAtom: the headline output of Phase 3.
//   survival_floor = fixed_ex_food + Σ(sinking-fund monthlyAccruals) + floors.foodSeed
//   Async because floorsLoadAtom reads from IndexedDB on first load (D-08).
//   NEVER stored (FOUND-06) — always derived from source atoms.
//
// Boundary: this file imports `storage` and schema types only — NEVER `db`.
//   Grep gate enforced by plan 03-01 acceptance criteria.

import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import { floorsLoadAtom } from '../settings/settings.atoms'
import { toMonthlyEquivalent } from '../../storage/schema'
import { sinkingFundAccrualsAtom } from '../funds/funds.atoms'
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

// ── survivalFloorAtom (EXP-03, D-08) ──────────────────────────────────────────
// survival_floor = fixed_ex_food + Σ(monthlyAccruals) + floors.foodSeed
// Async because floorsLoadAtom is async (IDB read on first access).
// Pitfall 3: wrap in <Suspense> in any component that reads this atom.

export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const floors = await get(floorsLoadAtom)
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + floors.foodSeed
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
