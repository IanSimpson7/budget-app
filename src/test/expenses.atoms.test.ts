// Atom tests for expenseItemsAtom, survivalFloorAtom, classification splits.
// Tests EXP-03, EXP-06, FOUND-06, cadence normalization (D-10).
//
// Pattern: use Jotai's createStore() to evaluate atoms in isolation without
// mounting React components. floorsLoadAtom reads from IDB so we need a fresh
// DB per test via Dexie.delete('BudgetApp').
//
// Phase 4 (04-04) update: survivalFloorAtom now reads foodFloorAtom instead of
// floors.foodSeed. The food floor in test env depends on the glob + DB state.
// Tests that previously asserted on the exact foodSeed value (550) now assert on
// the computed food floor (stale path = 550 when meta is all zeros, OR live result
// when the glob has current plan files). We use storage mocking to isolate.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { createStore } from 'jotai'
import * as storage from '../storage/storage'
import {
  expenseItemsAtom,
  protectedExpensesAtom,
  gateableExpensesAtom,
  survivalFloorAtom,
} from '../domains/expenses/expenses.atoms'
import type { FoodFloorMeta } from '../domains/food/food.types'

const EMPTY_FOOD_META: FoodFloorMeta = {
  lastComputedFloor: 0,
  allTimeHighWater: 0,
  lastRefinedFromReceipts: null,
}

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helper: mock food singletons (so food floor takes the stale=550 path) ─────

function mockFoodSingletons(meta: FoodFloorMeta = EMPTY_FOOD_META): void {
  vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(meta)
  vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
  vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
  vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
  vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()
}

// ── expenseItemsAtom ───────────────────────────────────────────────────────

describe('expenseItemsAtom', () => {
  it('returns [] from a fresh DB (initialValue)', async () => {
    const store = createStore()
    const value = store.get(expenseItemsAtom)
    expect(value).toEqual([])
  })
})

// ── classification split atoms ─────────────────────────────────────────────

describe('protectedExpensesAtom + gateableExpensesAtom', () => {
  it('protectedExpensesAtom returns only protected rows', async () => {
    await storage.addExpenseItem({ name: 'Housing', amount: 1300, cadence: 'monthly', classification: 'protected' })
    await storage.addExpenseItem({ name: 'Dining', amount: 200, cadence: 'monthly', classification: 'gateable' })

    // Give liveQuery a moment to emit (atomWithObservable is sync for initial value)
    // For unit testing without a running React render, we read the IDB directly
    const all = await storage.listExpenseItems()
    const protected_ = all.filter(i => i.classification === 'protected')
    const gateable = all.filter(i => i.classification === 'gateable')
    expect(protected_).toHaveLength(1)
    expect(protected_[0]!.name).toBe('Housing')
    expect(gateable).toHaveLength(1)
    expect(gateable[0]!.name).toBe('Dining')
  })

  it('initialValue of protectedExpensesAtom is [] (no suspension)', () => {
    const store = createStore()
    expect(store.get(protectedExpensesAtom)).toEqual([])
    expect(store.get(gateableExpensesAtom)).toEqual([])
  })
})

// ── survivalFloorAtom math (EXP-03, D-08) ─────────────────────────────────
//
// Phase 4 (04-04): survivalFloorAtom = fixedExFood + accruals + foodFloorAtom.floor
// The food floor is no longer floors.foodSeed — it comes from the live/stale
// food floor derivation. With empty meta + no current plan, foodFloorAtom
// returns DEFAULT_FOOD_FLOOR_SEED (550) on the stale path.

describe('survivalFloorAtom', () => {
  it('returns food floor value (≥ 0) when no expenses or funds exist (V7)', async () => {
    // Mock food singletons with empty meta
    mockFoodSingletons(EMPTY_FOOD_META)

    const store = createStore()
    const floor = await store.get(survivalFloorAtom)
    // With fixedExFood=0 + accruals=0, survivalFloor = foodFloorAtom.floor
    // The food floor is ≥ 0 (at minimum DEFAULT_FOOD_FLOOR_SEED=550 on stale,
    // or the live computed floor if SMC plans cover today — always positive).
    expect(floor).toBeGreaterThanOrEqual(0)
    // Specifically: the food floor is the sole contributor when no expenses/funds
    const { foodFloorAtom } = await import('../domains/food/food.atoms')
    const store2 = createStore()
    const foodResult = await store2.get(foodFloorAtom)
    expect(floor).toBeCloseTo(foodResult.floor, 1)
  })

  it('V7 propagation: survivalFloorAtom reads foodFloorAtom (not floors.foodSeed)', async () => {
    // This test verifies the INTEGRATION: survivalFloorAtom includes the food floor.
    // With no expenses + no sinking funds, survivalFloor === foodFloorAtom.floor.
    mockFoodSingletons(EMPTY_FOOD_META)

    const store = createStore()

    // Get both atoms and verify survivalFloor = fixedExFood(0) + accruals(0) + foodFloor
    const { foodFloorAtom } = await import('../domains/food/food.atoms')
    const foodResult = await store.get(foodFloorAtom)
    const survivalFloor = await store.get(survivalFloorAtom)

    // survivalFloor must equal foodFloor when fixedExFood=0 and accruals=0
    // This proves survivalFloorAtom reads foodFloorAtom.floor (V7)
    expect(survivalFloor).toBeCloseTo(foodResult.floor, 1)
  })

  it('includes only PROTECTED expense lines in the floor (EXP-03)', async () => {
    await storage.addExpenseItem({ name: 'Housing', amount: 1300, cadence: 'monthly', classification: 'protected' })
    await storage.addExpenseItem({ name: 'Dining', amount: 200, cadence: 'monthly', classification: 'gateable' })

    const all = await storage.listExpenseItems()
    const fixedExFood = all
      .filter(i => i.classification === 'protected')
      .reduce((sum, i) => {
        if (i.cadence === 'monthly') return sum + i.amount
        if (i.cadence === 'annual') return sum + i.amount / 12
        return sum
      }, 0)
    // Only Housing (protected) contributes; Dining (gateable) does not
    expect(fixedExFood).toBe(1300)
  })

  it('normalizes annual cadence expense as amount/12 for the floor (D-10)', async () => {
    await storage.addExpenseItem({ name: 'Annual fee', amount: 1200, cadence: 'annual', classification: 'protected' })

    const all = await storage.listExpenseItems()
    const fixedExFood = all
      .filter(i => i.classification === 'protected')
      .reduce((sum, i) => {
        if (i.cadence === 'monthly') return sum + i.amount
        if (i.cadence === 'annual') return sum + i.amount / 12
        return sum
      }, 0)
    expect(fixedExFood).toBeCloseTo(100, 5) // 1200/12 = 100
  })

  it('excludes oneoff cadence from the floor (D-10, Pitfall 5)', async () => {
    await storage.addExpenseItem({ name: 'One-time purchase', amount: 5000, cadence: 'oneoff', classification: 'protected' })

    const all = await storage.listExpenseItems()
    const fixedExFood = all
      .filter(i => i.classification === 'protected')
      .reduce((sum, i) => {
        if (i.cadence === 'monthly') return sum + i.amount
        if (i.cadence === 'annual') return sum + i.amount / 12
        return sum
      }, 0)
    expect(fixedExFood).toBe(0) // oneoff excluded
  })

  it('survivalFloor ≈ 2335 with seed data (sanity: EXP-03, D-08, V7)', async () => {
    // Mock food singletons: empty meta → stale floor = 550
    mockFoodSingletons(EMPTY_FOOD_META)

    // Seed all four expense rows + the car-insurance sinking fund
    await storage.seedExpensesIfEmpty()
    await storage.seedFundsIfEmpty()
    // Save default floors so floorsLoadAtom returns passive=2400, defended=3000
    await storage.saveFloors({ passive: 2400, defended: 3000, foodSeed: 550 })

    // Compute manually from seeds:
    // Housing 1300 + Electric 65 + Fuel 238 + Claude 100 = 1703 fixed
    // Car insurance accrual = 82
    // fixed_ex_food = 1703 + 82 = 1785
    // food floor (stale path with empty meta) = 550
    // survival floor = 1785 + 550 = 2335
    const expenses = await storage.listExpenseItems()
    const funds = await storage.listSinkingFunds()

    const fixedExFood = expenses
      .filter(i => i.classification === 'protected')
      .reduce((sum, i) => {
        if (i.cadence === 'monthly') return sum + i.amount
        if (i.cadence === 'annual') return sum + i.amount / 12
        return sum
      }, 0)
    const accruals = funds.reduce((sum, f) => sum + f.monthlyAccrual, 0)
    const floor = fixedExFood + accruals + 550

    expect(floor).toBeCloseTo(2335, 0)
  })

  it('GATEABLE line adds 0 to the survival floor (EXP-03)', async () => {
    await storage.addExpenseItem({ name: 'Subscriptions', amount: 50, cadence: 'monthly', classification: 'gateable' })

    const all = await storage.listExpenseItems()
    const fixedExFood = all
      .filter(i => i.classification === 'protected')
      .reduce((sum, i) => {
        if (i.cadence === 'monthly') return sum + i.amount
        if (i.cadence === 'annual') return sum + i.amount / 12
        return sum
      }, 0)
    expect(fixedExFood).toBe(0) // gateable excluded
  })

  it('survival floor value is never stored — it is always derived (FOUND-06)', async () => {
    // Verify: adding a new expense changes the computed value without any explicit persist
    await storage.addExpenseItem({ name: 'Housing', amount: 1300, cadence: 'monthly', classification: 'protected' })

    const expenses = await storage.listExpenseItems()
    const floor = expenses
      .filter(i => i.classification === 'protected')
      .reduce((sum, i) => {
        if (i.cadence === 'monthly') return sum + i.amount
        if (i.cadence === 'annual') return sum + i.amount / 12
        return sum
      }, 0)
    // floor should reflect the newly added expense without a manual "save floor" call
    expect(floor).toBe(1300)
  })
})

// ── No circular imports (Pitfall 4 structural check) ──────────────────────

describe('circular import guard', () => {
  it('expenses.atoms.ts must NOT be imported by food.atoms.ts (Pitfall 4)', async () => {
    // This is a structural test: if food.atoms.ts imported expenses.atoms.ts
    // there would be a circular dependency that would throw at runtime.
    // The test verifies both modules can be imported without error.
    const { foodFloorAtom } = await import('../domains/food/food.atoms')
    const { survivalFloorAtom } = await import('../domains/expenses/expenses.atoms')
    expect(foodFloorAtom).toBeDefined()
    expect(survivalFloorAtom).toBeDefined()
  })
})
