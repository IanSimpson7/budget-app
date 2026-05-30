// food.atoms.test.ts — TDD tests for the food atom chain (04-04 Task 1).
//
// Behaviors tested:
//   - foodFloorAtom: stale path returns max(lastComputed, highWater) with stale-plan gap
//   - FOOD-11/EDGE-02: stale path + planIsCurrent=false
//   - Pitfall 7: stale path uses max(last, highWater) — never below high-water
//   - foodBadgeStatusAtom: gaps → 'needs-attention'
//   - I-03 write-back: gapped result → NO call to saveFoodFloorMeta
//   - I-01: stale path is stable across different months (not scaled by daysInMonth)
//   - All singleton atoms and write atoms are exported

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStore } from 'jotai'
import Dexie from 'dexie'
import {
  foodFloorAtom,
  foodBadgeStatusAtom,
  parsedPlansAtom,
  mealDefinitionsAtom,
  unitCostMapAtom,
  portionModelAtom,
  foodFloorMetaAtom,
  flavorLineAtom,
  saveUnitCostMapAtom,
  savePortionModelAtom,
  saveFlavorLineAtom,
  saveMealDefinitionAtom,
  updateMealDefinitionAtom,
  deleteMealDefinitionAtom,
} from '../domains/food/food.atoms'
import type { FoodFloorResult } from '../domains/food/food.atoms'
import * as storage from '../storage/storage'
import type { FoodFloorMeta } from '../domains/food/food.types'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const EMPTY_META: FoodFloorMeta = {
  lastComputedFloor: 0,
  allTimeHighWater: 0,
  lastRefinedFromReceipts: null,
}

const META_WITH_HISTORY: FoodFloorMeta = {
  lastComputedFloor: 500,
  allTimeHighWater: 600,
  lastRefinedFromReceipts: null,
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Atom exports (existence) ──────────────────────────────────────────────────

describe('food atom exports', () => {
  it('all required atoms are exported', () => {
    expect(foodFloorAtom).toBeDefined()
    expect(foodBadgeStatusAtom).toBeDefined()
    expect(parsedPlansAtom).toBeDefined()
    expect(mealDefinitionsAtom).toBeDefined()
    expect(unitCostMapAtom).toBeDefined()
    expect(portionModelAtom).toBeDefined()
    expect(foodFloorMetaAtom).toBeDefined()
    expect(flavorLineAtom).toBeDefined()
    expect(saveUnitCostMapAtom).toBeDefined()
    expect(savePortionModelAtom).toBeDefined()
    expect(saveFlavorLineAtom).toBeDefined()
    expect(saveMealDefinitionAtom).toBeDefined()
    expect(updateMealDefinitionAtom).toBeDefined()
    expect(deleteMealDefinitionAtom).toBeDefined()
  })
})

// ── foodFloorAtom: result shape ───────────────────────────────────────────────

describe('foodFloorAtom — result shape', () => {
  it('has floor, gaps, isClean, planIsCurrent fields', async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(EMPTY_META)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)

    expect(result).toHaveProperty('floor')
    expect(result).toHaveProperty('gaps')
    expect(result).toHaveProperty('isClean')
    expect(result).toHaveProperty('planIsCurrent')
    expect(Array.isArray(result.gaps)).toBe(true)
    expect(typeof result.isClean).toBe('boolean')
    expect(typeof result.planIsCurrent).toBe('boolean')
    expect(typeof result.floor).toBe('number')
  })
})

// ── foodFloorAtom: stale path (FOOD-11 / EDGE-02) ────────────────────────────

describe('foodFloorAtom — stale path (FOOD-11/EDGE-02)', () => {
  it('returns max(lastComputedFloor, allTimeHighWater) when no plan covers today', async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(META_WITH_HISTORY)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)

    // No current plan (glob = empty in test env) → stale path
    // floor = max(500, 600) = 600
    expect(result.floor).toBe(600)
    expect(result.planIsCurrent).toBe(false)
    expect(result.isClean).toBe(false)
  })

  it('includes a stale-plan gap when no plan covers today (EDGE-02)', async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(META_WITH_HISTORY)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)

    const stalePlanGap = result.gaps.find((g: { type: string }) => g.type === 'stale-plan')
    expect(stalePlanGap).toBeDefined()
  })

  it('uses DEFAULT_FOOD_FLOOR_SEED (550) when meta is all zeros', async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(EMPTY_META)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)

    // max(0, 0) → uses DEFAULT_FOOD_FLOOR_SEED = 550
    expect(result.floor).toBe(550)
    expect(result.planIsCurrent).toBe(false)
  })
})

// ── Pitfall 7 ─────────────────────────────────────────────────────────────────

describe('Pitfall 7 — stale path uses max(last, highWater)', () => {
  it('shows high-water (700) not lastComputedFloor (300) when high-water is higher', async () => {
    const lowLastMeta: FoodFloorMeta = {
      lastComputedFloor: 300,
      allTimeHighWater: 700,
      lastRefinedFromReceipts: null,
    }
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(lowLastMeta)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)

    // max(300, 700) = 700; not 300
    expect(result.floor).toBe(700)
  })

  it('shows lastComputedFloor (800) not allTimeHighWater (600) when last is higher', async () => {
    const highLastMeta: FoodFloorMeta = {
      lastComputedFloor: 800,
      allTimeHighWater: 600,
      lastRefinedFromReceipts: null,
    }
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(highLastMeta)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)

    // max(800, 600) = 800
    expect(result.floor).toBe(800)
  })
})

// ── foodBadgeStatusAtom ───────────────────────────────────────────────────────

describe('foodBadgeStatusAtom', () => {
  it("returns 'needs-attention' when stale (gaps present)", async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(META_WITH_HISTORY)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const status = await store.get(foodBadgeStatusAtom)
    expect(status).toBe('needs-attention')
  })

  it("also returns 'needs-attention' when meta is all zeros (no plan, no data)", async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(EMPTY_META)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const status = await store.get(foodBadgeStatusAtom)
    expect(status).toBe('needs-attention')
  })
})

// ── I-03 write-back: gapped result → no write ─────────────────────────────────

describe('I-03 write-back', () => {
  it('does NOT call saveFoodFloorMeta when result has gaps (stale path)', async () => {
    const saveSpy = vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(META_WITH_HISTORY)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })

    const store = createStore()
    await store.get(foodFloorAtom)

    // Stale path has gaps — saveFoodFloorMeta MUST NOT be called
    expect(saveSpy).not.toHaveBeenCalled()
  })

  it('high-water is never lower in stale path: max(500,600)=600 not 500', async () => {
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(META_WITH_HISTORY)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    const store = createStore()
    const result: FoodFloorResult = await store.get(foodFloorAtom)
    // allTimeHighWater=600 wins over lastComputedFloor=500
    expect(result.floor).toBe(600)
  })
})

// ── I-01 month-boundary: stale floor stable across months ────────────────────

describe('I-01 month-boundary', () => {
  it('stale floor (600) is unchanged regardless of which month it is (not scaled by daysInMonth)', async () => {
    // The stale path returns Math.max(last, highWater) directly — not scaled.
    // daysInMonth only affects the LIVE computeFloor path.
    vi.spyOn(storage, 'getFoodFloorMeta').mockResolvedValue(META_WITH_HISTORY)
    vi.spyOn(storage, 'getUnitCostMap').mockResolvedValue([])
    vi.spyOn(storage, 'getPortionModel').mockResolvedValue([])
    vi.spyOn(storage, 'getFlavorLine').mockResolvedValue({ amount: 50 })
    vi.spyOn(storage, 'saveFoodFloorMeta').mockResolvedValue()

    // Test 1: April (30 days)
    const mockDateApril = new Date('2026-04-15T12:00:00')
    vi.setSystemTime(mockDateApril)
    const store1 = createStore()
    const result1: FoodFloorResult = await store1.get(foodFloorAtom)
    expect(result1.floor).toBe(600)

    // Test 2: May (31 days) — should still be 600
    const mockDateMay = new Date('2026-05-15T12:00:00')
    vi.setSystemTime(mockDateMay)
    const store2 = createStore()
    const result2: FoodFloorResult = await store2.get(foodFloorAtom)
    expect(result2.floor).toBe(600)

    vi.useRealTimers()
  })
})
