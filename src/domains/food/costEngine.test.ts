/**
 * Cost engine tests — TDD RED phase.
 * V3: fallback-high on all three gap triggers (unpriced ingredient, undefined meal, unset flat cost)
 * V4: monthly floor derivation (daily-average × daysInMonth; 1-day and 7-day windows)
 * V5: never-lower stale path — isPlanCurrent + fallbackFloor
 * V6: kind-aware fallback ceiling — classifyMealKind, FALLBACK_CEILING_MEAL, FALLBACK_CEILING_SNACK
 *
 * C1-CRITICAL: every gap path MUST contribute FALLBACK_CEILING_PER_MEAL to the daily sum,
 * never $0 and never a partial undercount. Restriction is the BED clinical trigger.
 */
import { describe, it, expect } from 'vitest'
import {
  computeFloor,
  isPlanCurrent,
  fallbackFloor,
  FALLBACK_CEILING_PER_MEAL,
  FALLBACK_CEILING_MEAL,
  FALLBACK_CEILING_SNACK,
  classifyMealKind,
} from './costEngine'
import type {
  CostEngineInput,
  FloorGap,
} from './costEngine'
import type { MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta } from './food.types'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** A fully-priced decomposed meal: chicken + rice */
const CHICKEN_DEF: MealDefinition = {
  mealName: 'chicken and rice',
  type: 'decomposed',
  ingredients: ['chicken breast', 'rice'],
}

/** A flat-cost meal with a set cost */
const QDOBA_DEF: MealDefinition = {
  mealName: 'qdoba bowl',
  type: 'flat-cost',
  ingredients: [],  // flat-cost meals carry no ingredient list
  flatCost: 11,
}

/** A flat-cost meal with NO cost set — should trigger fallback-high */
const FLAT_NO_COST_DEF: MealDefinition = {
  mealName: 'mystery flat meal',
  type: 'flat-cost',
  ingredients: [],  // flat-cost meals carry no ingredient list
  // flatCost deliberately omitted
}

/** A decomposed meal including a flavor-condiment ingredient */
const SLOP_DEF: MealDefinition = {
  mealName: 'protein slop',
  type: 'decomposed',
  ingredients: ['whey protein', 'syrup'],
}

const UNIT_COSTS: UnitCostEntry[] = [
  { ingredientName: 'chicken breast', costPerUnit: 2.0,  unit: 'lb',   tag: 'macro-bearing' },
  { ingredientName: 'rice',           costPerUnit: 0.5,  unit: 'lb',   tag: 'macro-bearing' },
  { ingredientName: 'whey protein',   costPerUnit: 10.0, unit: 'lb',   tag: 'macro-bearing' },
  { ingredientName: 'syrup',          costPerUnit: 5.0,  unit: 'each', tag: 'flavor-condiment' },
]

const PORTIONS: PortionEntry[] = [
  { ingredientName: 'chicken breast', portionSize: 0.5 },  // 0.5 lb → $1.00
  { ingredientName: 'rice',           portionSize: 0.25 }, // 0.25 lb → $0.125
  { ingredientName: 'whey protein',   portionSize: 0.125 },// 0.125 lb → $1.25
  { ingredientName: 'syrup',          portionSize: 1 },    // 1 each → $5.00 (flavor-tagged, excluded)
]

// chicken breast cost: 0.5 lb × $2.00 = $1.00
// rice cost:          0.25 lb × $0.50 = $0.125
// TOTAL for chicken and rice: $1.125
const CHICKEN_RICE_COST = 0.5 * 2.0 + 0.25 * 0.5 // = 1.125

// whey protein cost: 0.125 lb × $10.00 = $1.25
// syrup is flavor-condiment → excluded
// TOTAL for protein slop (macro-bearing only): $1.25
const PROTEIN_SLOP_MACRO_COST = 0.125 * 10.0 // = 1.25

function makeInput(overrides: Partial<CostEngineInput> = {}): CostEngineInput {
  return {
    scheduledMeals: ['chicken and rice'],
    mealDefinitions: [CHICKEN_DEF],
    unitCostMap: UNIT_COSTS,
    portionModel: PORTIONS,
    daysInMonth: 30,
    windowDays: 1,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK_CEILING_PER_MEAL constant
// ─────────────────────────────────────────────────────────────────────────────

describe('FALLBACK_CEILING_PER_MEAL', () => {
  it('is 15 (Open Question 1 resolution)', () => {
    expect(FALLBACK_CEILING_PER_MEAL).toBe(15)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V3a — unpriced ingredient (FOOD-08, EDGE-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — V3a unpriced ingredient', () => {
  it('missing from unitCostMap → fallback-high, gap entry', () => {
    const unpricedMeal: MealDefinition = {
      mealName: 'meal with unknown',
      type: 'decomposed',
      ingredients: ['known ingredient', 'unknown ingredient'],
    }
    const partialCosts: UnitCostEntry[] = [
      { ingredientName: 'known ingredient', costPerUnit: 2.0, unit: 'lb', tag: 'macro-bearing' },
      // 'unknown ingredient' intentionally absent
    ]
    const partialPortions: PortionEntry[] = [
      { ingredientName: 'known ingredient', portionSize: 0.5 },
    ]
    const input = makeInput({
      scheduledMeals: ['meal with unknown'],
      mealDefinitions: [unpricedMeal],
      unitCostMap: partialCosts,
      portionModel: partialPortions,
    })
    const result = computeFloor(input)

    // Entire meal should fall back high — not the partial priced sum
    const dailyAvg = FALLBACK_CEILING_PER_MEAL / 1 // windowDays=1
    expect(result.floor).toBeCloseTo(dailyAvg * 30, 5)
    expect(result.isClean).toBe(false)
    const gap = result.gaps.find(
      (g): g is Extract<FloorGap, { type: 'unpriced-ingredient' }> =>
        g.type === 'unpriced-ingredient'
    )
    expect(gap).toBeDefined()
    expect(gap?.ingredientName).toBe('unknown ingredient')
  })

  it('costPerUnit === 0 → treated as unpriced, fallback-high, gap entry', () => {
    const zeroMeal: MealDefinition = {
      mealName: 'zero cost meal',
      type: 'decomposed',
      ingredients: ['zero ingredient'],
    }
    const zeroCosts: UnitCostEntry[] = [
      { ingredientName: 'zero ingredient', costPerUnit: 0, unit: 'lb', tag: 'macro-bearing' },
    ]
    const zeroPortions: PortionEntry[] = [
      { ingredientName: 'zero ingredient', portionSize: 0.5 },
    ]
    const input = makeInput({
      scheduledMeals: ['zero cost meal'],
      mealDefinitions: [zeroMeal],
      unitCostMap: zeroCosts,
      portionModel: zeroPortions,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_PER_MEAL * 30, 5)
    expect(result.isClean).toBe(false)
    const gap = result.gaps.find(
      (g): g is Extract<FloorGap, { type: 'unpriced-ingredient' }> =>
        g.type === 'unpriced-ingredient'
    )
    expect(gap).toBeDefined()
    expect(gap?.ingredientName).toBe('zero ingredient')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V3b — undefined meal
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — V3b undefined meal', () => {
  it('no MealDefinition row → fallback-high, gap entry', () => {
    const input = makeInput({
      scheduledMeals: ['completely undefined meal'],
      mealDefinitions: [], // no definitions at all
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_PER_MEAL * 30, 5)
    expect(result.isClean).toBe(false)
    const gap = result.gaps.find(
      (g): g is Extract<FloorGap, { type: 'undefined-meal' }> =>
        g.type === 'undefined-meal'
    )
    expect(gap).toBeDefined()
    expect(gap?.mealName).toBe('completely undefined meal')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V3c — unset flat cost
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — V3c unset flat cost', () => {
  it('flat-cost meal with flatCost undefined → fallback-high, gap entry', () => {
    const input = makeInput({
      scheduledMeals: ['mystery flat meal'],
      mealDefinitions: [FLAT_NO_COST_DEF],
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_PER_MEAL * 30, 5)
    expect(result.isClean).toBe(false)
    const gap = result.gaps.find(
      (g): g is Extract<FloorGap, { type: 'unset-flat-cost' }> =>
        g.type === 'unset-flat-cost'
    )
    expect(gap).toBeDefined()
    expect(gap?.mealName).toBe('mystery flat meal')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// D-05 — flavor-condiment exclusion
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — D-05 flavor-condiment exclusion', () => {
  it('flavor-tagged ingredient excluded from per-meal sum; macro-bearing only', () => {
    const input = makeInput({
      scheduledMeals: ['protein slop'],
      mealDefinitions: [SLOP_DEF],
      unitCostMap: UNIT_COSTS,
      portionModel: PORTIONS,
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    // Only whey protein ($1.25) should be in the sum — syrup is flavor-condiment
    const expectedDailyAvg = PROTEIN_SLOP_MACRO_COST
    expect(result.floor).toBeCloseTo(expectedDailyAvg * 30, 5)
    expect(result.isClean).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FOOD-06 / FOOD-09 — fully priced decomposed meal
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — FOOD-06/09 fully-priced decomposed meal', () => {
  it('sums portion × unitCost over macro-bearing ingredients exactly', () => {
    const input = makeInput({
      scheduledMeals: ['chicken and rice'],
      mealDefinitions: [CHICKEN_DEF],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(CHICKEN_RICE_COST * 30, 5)
    expect(result.isClean).toBe(true)
    expect(result.gaps).toHaveLength(0)
  })

  it('flat-cost meal with cost set → uses flatCost, no gap', () => {
    const input = makeInput({
      scheduledMeals: ['qdoba bowl'],
      mealDefinitions: [QDOBA_DEF],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(11 * 30, 5)
    expect(result.isClean).toBe(true)
    expect(result.gaps).toHaveLength(0)
  })

  it('new meal built from already-priced ingredients → prices automatically, no gaps', () => {
    // A "new" meal using ingredients that are already in unitCostMap + portionModel
    const newMeal: MealDefinition = {
      mealName: 'new meal with chicken',
      type: 'decomposed',
      ingredients: ['chicken breast'], // already priced
    }
    const input = makeInput({
      scheduledMeals: ['new meal with chicken'],
      mealDefinitions: [newMeal],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    const expectedCost = 0.5 * 2.0 // chicken breast: 0.5 lb × $2.00
    expect(result.floor).toBeCloseTo(expectedCost * 30, 5)
    expect(result.isClean).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V4 — monthly derivation: 1-day and 7-day windows
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — V4 monthly derivation', () => {
  it('1-day window: floor ≈ singleDayCost × daysInMonth (not singleDayCost alone)', () => {
    const input = makeInput({
      scheduledMeals: ['chicken and rice'],
      mealDefinitions: [CHICKEN_DEF],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    const expectedFloor = CHICKEN_RICE_COST * 30
    expect(result.floor).toBeCloseTo(expectedFloor, 5)
    // Prove it's NOT just the single-day cost
    expect(result.floor).toBeGreaterThan(CHICKEN_RICE_COST)
  })

  it('7-day window: floor = total7DayCost / 7 × daysInMonth', () => {
    // 7 meals: 3× chicken and rice + 4× qdoba bowl
    const sevenDayMeals = [
      'chicken and rice', 'chicken and rice', 'chicken and rice',
      'qdoba bowl', 'qdoba bowl', 'qdoba bowl', 'qdoba bowl',
    ]
    const total7 = 3 * CHICKEN_RICE_COST + 4 * 11
    const dailyAvg = total7 / 7
    const expectedFloor = dailyAvg * 30

    const input = makeInput({
      scheduledMeals: sevenDayMeals,
      mealDefinitions: [CHICKEN_DEF, QDOBA_DEF],
      windowDays: 7,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(expectedFloor, 5)
  })

  it('floor scales with daysInMonth (I-01 contract)', () => {
    const input30 = makeInput({ windowDays: 1, daysInMonth: 30 })
    const input31 = makeInput({ windowDays: 1, daysInMonth: 31 })
    const result30 = computeFloor(input30)
    const result31 = computeFloor(input31)
    // 31-day month floor should be larger than 30-day month floor
    expect(result31.floor).toBeGreaterThan(result30.floor)
    // Ratio should be 31/30
    expect(result31.floor / result30.floor).toBeCloseTo(31 / 30, 5)
  })

  it('1-day window vs 7-day window: same daily average → same floor', () => {
    // If all 7 days have identical meals, the 7-day average = single-day cost
    const sevenSame = Array(7).fill('chicken and rice')
    const result1 = computeFloor(makeInput({ windowDays: 1, daysInMonth: 30 }))
    const result7 = computeFloor(makeInput({
      scheduledMeals: sevenSame,
      mealDefinitions: [CHICKEN_DEF],
      windowDays: 7,
      daysInMonth: 30,
    }))
    expect(result1.floor).toBeCloseTo(result7.floor, 5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isClean invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — isClean invariant', () => {
  it('isClean === true when gaps.length === 0', () => {
    const result = computeFloor(makeInput())
    expect(result.isClean).toBe(result.gaps.length === 0)
  })

  it('isClean === false when gaps.length > 0', () => {
    const result = computeFloor(makeInput({
      scheduledMeals: ['completely undefined meal'],
      mealDefinitions: [],
    }))
    expect(result.isClean).toBe(false)
    expect(result.isClean).toBe(result.gaps.length === 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Multiple meals in same input — gap deduplication
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — gap deduplication', () => {
  it('same undefined meal scheduled twice → single undefined-meal gap entry', () => {
    const input = makeInput({
      scheduledMeals: ['ghost meal', 'ghost meal'],
      mealDefinitions: [],
      windowDays: 2,
    })
    const result = computeFloor(input)
    const undefinedGaps = result.gaps.filter(g => g.type === 'undefined-meal')
    expect(undefinedGaps).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V5 — isPlanCurrent (D-08)
// ─────────────────────────────────────────────────────────────────────────────

describe('isPlanCurrent — D-08 staleness detection', () => {
  it('today falls within a plan window → true', () => {
    const plans = [{ windowStart: '2026-05-01', windowEnd: '2026-05-31', meals: [], mealDays: 31 }]
    expect(isPlanCurrent(plans, '2026-05-15')).toBe(true)
  })

  it('today is on windowStart boundary → true (inclusive)', () => {
    const plans = [{ windowStart: '2026-05-25', windowEnd: '2026-05-31', meals: [], mealDays: 7 }]
    expect(isPlanCurrent(plans, '2026-05-25')).toBe(true)
  })

  it('today is on windowEnd boundary → true (inclusive)', () => {
    const plans = [{ windowStart: '2026-05-25', windowEnd: '2026-05-31', meals: [], mealDays: 7 }]
    expect(isPlanCurrent(plans, '2026-05-31')).toBe(true)
  })

  it('today is before windowStart → false', () => {
    const plans = [{ windowStart: '2026-05-25', windowEnd: '2026-05-31', meals: [], mealDays: 7 }]
    expect(isPlanCurrent(plans, '2026-05-24')).toBe(false)
  })

  it('today is after windowEnd → false', () => {
    const plans = [{ windowStart: '2026-05-25', windowEnd: '2026-05-31', meals: [], mealDays: 7 }]
    expect(isPlanCurrent(plans, '2026-06-01')).toBe(false)
  })

  it('single-day window (windowStart === windowEnd): today matches → true', () => {
    const plans = [{ windowStart: '2026-05-21', windowEnd: '2026-05-21', meals: [], mealDays: 1 }]
    expect(isPlanCurrent(plans, '2026-05-21')).toBe(true)
  })

  it('single-day window: different day → false', () => {
    const plans = [{ windowStart: '2026-05-21', windowEnd: '2026-05-21', meals: [], mealDays: 1 }]
    expect(isPlanCurrent(plans, '2026-05-22')).toBe(false)
  })

  it('empty plans array → false (stale)', () => {
    expect(isPlanCurrent([], '2026-05-15')).toBe(false)
  })

  it('multiple plans: today in any one window → true', () => {
    const plans = [
      { windowStart: '2026-05-01', windowEnd: '2026-05-07', meals: [], mealDays: 7 },
      { windowStart: '2026-05-15', windowEnd: '2026-05-21', meals: [], mealDays: 7 },
    ]
    expect(isPlanCurrent(plans, '2026-05-16')).toBe(true)
    expect(isPlanCurrent(plans, '2026-05-10')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V5 — fallbackFloor (D-07): never-lower invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('fallbackFloor — D-07 never-lower stale path', () => {
  it('returns max(lastComputedFloor, allTimeHighWater)', () => {
    const meta: FoodFloorMeta = { lastComputedFloor: 450, allTimeHighWater: 600, lastRefinedFromReceipts: null }
    expect(fallbackFloor(meta)).toBe(600)
  })

  it('lastComputedFloor > allTimeHighWater → returns lastComputedFloor', () => {
    const meta: FoodFloorMeta = { lastComputedFloor: 700, allTimeHighWater: 600, lastRefinedFromReceipts: null }
    expect(fallbackFloor(meta)).toBe(700)
  })

  it('both equal → returns that value', () => {
    const meta: FoodFloorMeta = { lastComputedFloor: 550, allTimeHighWater: 550, lastRefinedFromReceipts: null }
    expect(fallbackFloor(meta)).toBe(550)
  })

  it('property-style invariant: result is always >= max(last, highWater)', () => {
    const pairs: [number, number][] = [
      [0, 0], [100, 200], [200, 100], [550, 550],
      [0, 550], [550, 0], [999, 1], [1, 999],
    ]
    for (const [last, highWater] of pairs) {
      const meta: FoodFloorMeta = {
        lastComputedFloor: last,
        allTimeHighWater: highWater,
        lastRefinedFromReceipts: null,
      }
      const result = fallbackFloor(meta)
      expect(result).toBeGreaterThanOrEqual(last)
      expect(result).toBeGreaterThanOrEqual(highWater)
    }
  })

  it('property-style invariant: result is never less than either input', () => {
    // Extended pairs including edge cases
    const testPairs: [number, number][] = [
      [0, 0.01], [0.01, 0], [1234.56, 789.01], [789.01, 1234.56],
    ]
    for (const [last, highWater] of testPairs) {
      const meta: FoodFloorMeta = {
        lastComputedFloor: last,
        allTimeHighWater: highWater,
        lastRefinedFromReceipts: null,
      }
      const result = fallbackFloor(meta)
      expect(result).toBeGreaterThanOrEqual(Math.max(last, highWater))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pitfall 7 — fallbackFloor does NOT clamp the live computeFloor result
// ─────────────────────────────────────────────────────────────────────────────

describe('Pitfall 7 — high-water does not ratchet live floor', () => {
  it('computeFloor output is independent of meta high-water values', () => {
    // Produce a live floor result
    const input = makeInput({
      scheduledMeals: ['chicken and rice'],
      mealDefinitions: [CHICKEN_DEF],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    const expectedFloor = CHICKEN_RICE_COST * 30

    // computeFloor takes no meta argument — its output is purely from meal/cost data
    // Any high-water or fallback logic lives in the atom layer, not the engine
    expect(result.floor).toBeCloseTo(expectedFloor, 5)

    // fallbackFloor with a high meta value does NOT affect the live floor
    const highMeta: FoodFloorMeta = { lastComputedFloor: 5000, allTimeHighWater: 10000, lastRefinedFromReceipts: null }
    const fallback = fallbackFloor(highMeta)
    // The two are completely independent functions
    expect(result.floor).not.toBe(fallback)
    expect(result.floor).toBeCloseTo(expectedFloor, 5) // unchanged
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V6 — FALLBACK_CEILING_MEAL and FALLBACK_CEILING_SNACK constants
// ─────────────────────────────────────────────────────────────────────────────

describe('FALLBACK_CEILING_MEAL / FALLBACK_CEILING_SNACK constants', () => {
  it('FALLBACK_CEILING_MEAL is 15 (full-meal ceiling, unchanged)', () => {
    expect(FALLBACK_CEILING_MEAL).toBe(15)
  })

  it('FALLBACK_CEILING_SNACK is 5 (snack/shake/light occasion ceiling)', () => {
    expect(FALLBACK_CEILING_SNACK).toBe(5)
  })

  it('FALLBACK_CEILING_PER_MEAL (back-compat alias) equals FALLBACK_CEILING_MEAL', () => {
    expect(FALLBACK_CEILING_PER_MEAL).toBe(FALLBACK_CEILING_MEAL)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V6 — classifyMealKind: 14-meal corpus coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyMealKind — corpus coverage', () => {
  // Snack corpus — exactly 6 entries from the 14-meal corpus that classify as snack
  it.each([
    ['Cereal and milk',                             'snack'],  // contains 'cereal'
    ['Greek yogurt with granola and berries',        'snack'],  // contains 'yogurt', 'granola'
    ['Oatmeal cream pie and banana',                 'snack'],  // contains 'cream pie'
    ['Protein shake and banana',                     'snack'],  // contains 'shake'
    ['Protein Slop and Granola',                     'snack'],  // contains 'granola'
    ['Rice cakes with peanut butter and banana',     'snack'],  // contains 'rice cake'
  ])('classifyMealKind(%s) === %s', (mealName, expected) => {
    expect(classifyMealKind(mealName)).toBe(expected)
  })

  // Meal corpus — all remaining 8 entries classify as 'meal'
  it.each([
    ['Chicken, rice, and broccoli',                  'meal'],
    ['Eggs and PB toast',                            'meal'],
    ['French Toast and Eggs',                        'meal'],
    ['Oatmeal and protein slop',                     'meal'],
    ['Pasta, beef, cheese, green beans',             'meal'],
    ['Qdoba bowl',                                   'meal'],
    ['Sweet potato, beef, cheese, green beans',      'meal'],
    ['Turkey sandwich with cheese and green beans',  'meal'],
  ])('classifyMealKind(%s) === %s', (mealName, expected) => {
    expect(classifyMealKind(mealName)).toBe(expected)
  })

  it('unknown/arbitrary name defaults to meal (conservative)', () => {
    expect(classifyMealKind('completely unknown dish')).toBe('meal')
    expect(classifyMealKind('')).toBe('meal')
  })

  it('matching is case-insensitive (normalized via lowercase)', () => {
    expect(classifyMealKind('PROTEIN SHAKE')).toBe('snack')
    expect(classifyMealKind('Greek YOGURT bowl')).toBe('snack')
    expect(classifyMealKind('RICE CAKE crumble')).toBe('snack')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CR-02 — windowDays must reflect distinct days-with-meals (mealDays), not span
// ─────────────────────────────────────────────────────────────────────────────

describe('CR-02 — mealDays denominator: 7-day window with 3 meal-days divides by 3', () => {
  // Scenario: a 7-day calendar span (windowStart..windowEnd) but only 3 days have meals.
  // The correct denominator is 3 (mealDays), not 7 (calendar span).
  // Using 7 would understate the daily average by 57% — a C1 failure.
  it('3-meal-day plan in a 7-day window: windowDays=3 gives correct floor', () => {
    // 3 identical chicken-and-rice meals across 3 days (out of a 7-day window)
    const input = makeInput({
      scheduledMeals: ['chicken and rice', 'chicken and rice', 'chicken and rice'],
      mealDefinitions: [CHICKEN_DEF],
      unitCostMap: UNIT_COSTS,
      portionModel: PORTIONS,
      windowDays: 3,  // mealDays — correct denominator
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    // floor = (3 × CHICKEN_RICE_COST / 3) × 30 = CHICKEN_RICE_COST × 30
    const expectedFloor = CHICKEN_RICE_COST * 30
    expect(result.floor).toBeCloseTo(expectedFloor, 5)
    expect(result.isClean).toBe(true)
  })

  it('if windowDays=7 were used instead of 3, floor would be WRONG (57% undercount)', () => {
    // This proves why the denominator matters
    const correctInput = makeInput({
      scheduledMeals: ['chicken and rice', 'chicken and rice', 'chicken and rice'],
      mealDefinitions: [CHICKEN_DEF],
      unitCostMap: UNIT_COSTS,
      portionModel: PORTIONS,
      windowDays: 3,   // correct: meal-days
      daysInMonth: 30,
    })
    const wrongInput = makeInput({
      scheduledMeals: ['chicken and rice', 'chicken and rice', 'chicken and rice'],
      mealDefinitions: [CHICKEN_DEF],
      unitCostMap: UNIT_COSTS,
      portionModel: PORTIONS,
      windowDays: 7,   // wrong: calendar span (understates floor)
      daysInMonth: 30,
    })
    const correct = computeFloor(correctInput)
    const wrong   = computeFloor(wrongInput)
    // Correct floor is (3/3) × cost × 30 = cost × 30
    // Wrong  floor is (3/7) × cost × 30 = 0.43 × cost × 30 — understated
    expect(correct.floor).toBeGreaterThan(wrong.floor)
    // Ratio should be 7/3
    expect(correct.floor / wrong.floor).toBeCloseTo(7 / 3, 5)
  })

  it('ParsedPlan interface in costEngine now includes mealDays field', () => {
    // The costEngine ParsedPlan mirror must include mealDays to match the parser
    // This is a compile-time check — verified via type assignment in the test
    const plan: import('./costEngine').ParsedPlan = {
      windowStart: '2026-06-01',
      windowEnd:   '2026-06-07',
      meals:       ['chicken and rice'],
      mealDays:    3,  // must exist on the interface
    }
    expect(plan.mealDays).toBe(3)
    expect(plan.meals).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// V6 — kind-aware fallback in computeFloor
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFloor — V6 kind-aware fallback', () => {
  it('snack-classified undefined meal contributes FALLBACK_CEILING_SNACK (5), not 15', () => {
    const input = makeInput({
      scheduledMeals: ['protein shake and banana'],
      mealDefinitions: [], // undefined → fallback path
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_SNACK * 30, 5)
    expect(result.isClean).toBe(false)
    const gap = result.gaps.find((g): g is Extract<FloorGap, { type: 'undefined-meal' }> => g.type === 'undefined-meal')
    expect(gap).toBeDefined()
    expect(gap?.mealName).toBe('protein shake and banana')
  })

  it('meal-classified undefined meal contributes FALLBACK_CEILING_MEAL (15)', () => {
    const input = makeInput({
      scheduledMeals: ['qdoba bowl'],
      mealDefinitions: [], // undefined → fallback path
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_MEAL * 30, 5)
    expect(result.isClean).toBe(false)
  })

  it('snack with unpriced ingredient falls back at FALLBACK_CEILING_SNACK (C1: never $0)', () => {
    // C1 regression: snack fallback is never $0 — just lower than the full-meal ceiling
    const snackDef: MealDefinition = {
      mealName: 'cereal and milk',
      type: 'decomposed',
      ingredients: ['cereal', 'milk'], // unpriced ingredients
    }
    const input = makeInput({
      scheduledMeals: ['cereal and milk'],
      mealDefinitions: [snackDef],
      unitCostMap: [], // no pricing
      portionModel: [],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    // Must NOT be $0 (C1) — uses snack ceiling
    expect(result.floor).toBeGreaterThan(0)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_SNACK * 30, 5)
    expect(result.isClean).toBe(false)
  })

  it('snack with unset flat cost falls back at FALLBACK_CEILING_SNACK', () => {
    const snackFlatDef: MealDefinition = {
      mealName: 'protein shake and banana',
      type: 'flat-cost',
      ingredients: [],
      // flatCost deliberately omitted
    }
    const input = makeInput({
      scheduledMeals: ['protein shake and banana'],
      mealDefinitions: [snackFlatDef],
      windowDays: 1,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    expect(result.floor).toBeCloseTo(FALLBACK_CEILING_SNACK * 30, 5)
    expect(result.isClean).toBe(false)
  })

  it('mixed snack + meal schedule: each contributes its respective ceiling when gapped', () => {
    // 1 snack gapped + 1 meal gapped in a 2-day window
    const input = makeInput({
      scheduledMeals: ['protein shake and banana', 'qdoba bowl'],
      mealDefinitions: [], // both undefined
      windowDays: 2,
      daysInMonth: 30,
    })
    const result = computeFloor(input)
    const totalCost = FALLBACK_CEILING_SNACK + FALLBACK_CEILING_MEAL
    const expectedFloor = (totalCost / 2) * 30
    expect(result.floor).toBeCloseTo(expectedFloor, 5)
  })
})
