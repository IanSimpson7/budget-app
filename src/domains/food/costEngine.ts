/**
 * costEngine.ts — pure cost engine for the protected food floor.
 *
 * C1-CRITICAL: This is the heart of C1. Every uncertainty (unpriced ingredient,
 * undefined meal, unset flat cost) MUST fall back HIGH — never $0, never undercount.
 * Restriction is the BED clinical trigger; an undercount here is the highest-severity
 * failure in the app.
 *
 * PURE: (scheduled meals, meal definitions, unit-cost map, portion model) → result.
 * No I/O, no Dexie, no atoms.
 *
 * Open Question 1 resolution (04-RESEARCH.md A4):
 * FALLBACK_CEILING_MEAL = $15.00 (full meal), FALLBACK_CEILING_SNACK = $5.00 (snack/shake).
 * V6: classifyMealKind selects the ceiling; see classifyMealKind() doc for corpus.
 * Rationale: Qdoba bowl ~$11; a full prep-cooked meal ~$3–5; $15 is conservative-high
 * per meal. Snack/shake ~$2–4; $5 is conservative-high for a light occasion.
 * Static constants (NOT "most-expensive-defined-meal") so the fallback is
 * deterministic even when no meals are defined yet (early setup). Per RESEARCH A4.
 */
import type { MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta } from './food.types'

// ─────────────────────────────────────────────────────────────────────────────
// Fallback ceilings (Open Question 1 — resolved; V6: kind-aware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conservative-high fallback cost for a FULL MEAL.
 * Used when: undefined meal, unset flat cost, or any unpriced ingredient in a
 * decomposed meal triggers a C1-safe fallback (never undercount).
 *
 * Value: $15.00
 * Rationale: Qdoba bowl ~$11; full prep meal ~$3–5; $15 is conservative-high.
 * Static constant (not dynamic "most-expensive-defined-meal") so the fallback is
 * deterministic even before any meals are defined — per RESEARCH Open Question 1 / A4.
 */
export const FALLBACK_CEILING_MEAL = 15

/**
 * Conservative-high fallback cost for a SNACK / SHAKE / LIGHT EATING OCCASION.
 * Applies when classifyMealKind(name) === 'snack' and the meal triggers any gap.
 *
 * Value: $5.00
 * Rationale: protein shake, yogurt, cereal — real cost $2–4; $5 is conservative-high
 * for a light occasion. Always > $0 (C1 invariant: never undercount).
 */
export const FALLBACK_CEILING_SNACK = 5

/**
 * @deprecated Use FALLBACK_CEILING_MEAL. Back-compat alias — external callers that
 * imported FALLBACK_CEILING_PER_MEAL before V6 continue to resolve to FALLBACK_CEILING_MEAL.
 */
export const FALLBACK_CEILING_PER_MEAL = FALLBACK_CEILING_MEAL

// ─────────────────────────────────────────────────────────────────────────────
// classifyMealKind — FALLBACK-ONLY heuristic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a meal name as 'snack' or 'meal' for fallback-ceiling selection.
 *
 * FALLBACK-ONLY: this heuristic affects cost ONLY when a meal already triggers
 * a gap (unpriced/undefined/unset). Once ingredients are priced, the exact
 * portion×cost sum supersedes the fallback ceiling entirely — classifyMealKind
 * plays no role on priced paths.
 *
 * Conservative default = 'meal' for any name that does not match a snack keyword.
 * An unknown name is treated as a full meal (conservative-high per C1).
 *
 * Snack keywords matched against the normalized (lowercased) meal name:
 *   shake, cereal, yogurt, rice cake, cream pie, granola
 *
 * Corpus verification (14-meal corpus, 2026-05-29):
 *   Snacks: Cereal and milk · Greek yogurt with granola and berries ·
 *           Oatmeal cream pie and banana · Protein shake and banana ·
 *           Protein Slop and Granola · Rice cakes with peanut butter and banana
 *   Meals:  Chicken rice broccoli · Eggs and PB toast · French Toast and Eggs ·
 *           Oatmeal and protein slop · Pasta beef cheese · Qdoba bowl ·
 *           Sweet potato beef cheese · Turkey sandwich
 */
export function classifyMealKind(mealName: string): 'meal' | 'snack' {
  const lower = mealName.toLowerCase()
  const snackKeywords = ['shake', 'cereal', 'yogurt', 'rice cake', 'cream pie', 'granola']
  for (const kw of snackKeywords) {
    if (lower.includes(kw)) return 'snack'
  }
  return 'meal'
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A named gap in the cost computation — each gap triggers fallback-high on
 * the affected meal and surfaces a specific, individually-identifiable flag (D-11).
 */
export type FloorGap =
  | { type: 'unpriced-ingredient'; ingredientName: string }
  | { type: 'undefined-meal';      mealName: string }
  | { type: 'unset-flat-cost';     mealName: string }
  | { type: 'stale-plan';          lastKnownDate: string | null }

/**
 * Inputs to the pure cost engine.
 *
 * CONTRACT (I-01): The CALLER (foodFloorAtom, Plan 04) MUST compute daysInMonth
 * from the current date at READ time, never a memoized write-time value.
 * computeFloor is pure: it trusts the daysInMonth it is given.
 */
export interface CostEngineInput {
  scheduledMeals:  string[]          // normalized meal names (from ParsedPlan.meals)
  mealDefinitions: MealDefinition[]
  unitCostMap:     UnitCostEntry[]
  portionModel:    PortionEntry[]
  daysInMonth:     number            // days in the CURRENT calendar month (28–31), caller-supplied
  windowDays:      number            // distinct days the current plan(s) cover
}

export interface CostEngineResult {
  floor:   number      // D-06: dailyAverage × daysInMonth
  gaps:    FloorGap[]
  isClean: boolean     // gaps.length === 0
}

// ─────────────────────────────────────────────────────────────────────────────
// ParsedPlan (Plan-02 contract mirror)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal ParsedPlan shape needed by isPlanCurrent.
 * Matches the interface that planParser.ts (Plan 04-02) exports.
 * Defined here to keep costEngine.ts compilable before planParser.ts lands in
 * parallel Wave-2 builds; once both plans merge this remains compatible.
 */
export interface ParsedPlan {
  windowStart: string   // YYYY-MM-DD
  windowEnd:   string   // YYYY-MM-DD
  meals:       string[] // normalized meal-name strings
}

// ─────────────────────────────────────────────────────────────────────────────
// computeFloor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the protected food floor from the current plan data.
 *
 * Algorithm (D-06):
 *   1. For each scheduled meal, compute its cost:
 *      - decomposed: Σ (portionSize × costPerUnit) over MACRO-BEARING ingredients only (D-05)
 *        If any macro-bearing ingredient is unpriced (missing or costPerUnit === 0):
 *          → use classifyMealKind-aware ceiling for the WHOLE meal + add gap (C1-critical)
 *      - flat-cost: use flatCost field
 *        If flatCost is unset (undefined):
 *          → use classifyMealKind-aware ceiling + add gap
 *      - undefined (no MealDefinition row):
 *          → use classifyMealKind-aware ceiling + add gap
 *      Ceiling selection: classifyMealKind(name)==='snack' → FALLBACK_CEILING_SNACK (5)
 *                         otherwise                        → FALLBACK_CEILING_MEAL  (15)
 *   2. dailyAverage = totalScheduledCost / windowDays
 *   3. floor = dailyAverage × daysInMonth  (I-01: daysInMonth is caller-supplied)
 *   4. Dedupe gaps by (type, name)
 *
 * C1 guarantee: every gap path contributes FALLBACK_CEILING_MEAL or FALLBACK_CEILING_SNACK, never $0.
 */
export function computeFloor(input: CostEngineInput): CostEngineResult {
  const { scheduledMeals, mealDefinitions, unitCostMap, portionModel, daysInMonth, windowDays } = input

  // Build O(1) lookup maps
  const mealByName = new Map<string, MealDefinition>(
    mealDefinitions.map(m => [m.mealName, m])
  )
  const costByIngredient = new Map<string, UnitCostEntry>(
    unitCostMap.map(e => [e.ingredientName, e])
  )
  const portionByIngredient = new Map<string, PortionEntry>(
    portionModel.map(p => [p.ingredientName, p])
  )

  const rawGaps: FloorGap[] = []
  let totalScheduledCost = 0

  for (const mealName of scheduledMeals) {
    const def = mealByName.get(mealName)

    if (!def) {
      // V3b: undefined meal — no MealDefinition row
      // V6: kind-aware ceiling — snack keywords get FALLBACK_CEILING_SNACK, others FALLBACK_CEILING_MEAL
      rawGaps.push({ type: 'undefined-meal', mealName })
      totalScheduledCost += classifyMealKind(mealName) === 'snack' ? FALLBACK_CEILING_SNACK : FALLBACK_CEILING_MEAL
      continue
    }

    if (def.type === 'flat-cost') {
      if (def.flatCost === undefined || def.flatCost === null) {
        // V3c: unset flat cost
        // V6: kind-aware ceiling
        rawGaps.push({ type: 'unset-flat-cost', mealName: def.mealName })
        totalScheduledCost += classifyMealKind(def.mealName) === 'snack' ? FALLBACK_CEILING_SNACK : FALLBACK_CEILING_MEAL
      } else {
        totalScheduledCost += def.flatCost
      }
      continue
    }

    // type === 'decomposed'
    // Identify macro-bearing ingredients (D-05: skip flavor-condiment entries).
    // An ingredient absent from the cost map is treated as unpriced macro-bearing
    // (conservative default per I-05 — will trigger gap below).
    const macroBearingIngredients = def.ingredients.filter(ingName => {
      const entry = costByIngredient.get(ingName)
      if (!entry) return true  // not in map → unpriced macro-bearing (gap follows)
      return entry.tag === 'macro-bearing'
    })

    // Check each macro-bearing ingredient for pricing (missing or zero = unpriced)
    let mealHasGap = false
    for (const ingName of macroBearingIngredients) {
      const entry = costByIngredient.get(ingName)
      if (!entry || entry.costPerUnit === 0) {
        // V3a: unpriced ingredient
        rawGaps.push({ type: 'unpriced-ingredient', ingredientName: ingName })
        mealHasGap = true
      }
    }

    if (mealHasGap) {
      // C1-CRITICAL: entire meal falls back high — NEVER the partial sum that omits
      // the unpriced ingredient as $0. A partial sum would undercount the floor.
      // V6: kind-aware ceiling — snack-classified meals use the snack ceiling
      totalScheduledCost += classifyMealKind(mealName) === 'snack' ? FALLBACK_CEILING_SNACK : FALLBACK_CEILING_MEAL
    } else {
      // All macro-bearing ingredients are priced — sum portion × costPerUnit
      let mealCost = 0
      for (const ingName of macroBearingIngredients) {
        const entry = costByIngredient.get(ingName)!
        const portion = portionByIngredient.get(ingName)
        mealCost += (portion?.portionSize ?? 0) * entry.costPerUnit
      }
      totalScheduledCost += mealCost
    }
  }

  // Deduplicate gaps: same (type, name) from a meal scheduled multiple times → single entry
  const gaps = dedupeGaps(rawGaps)

  // D-06: floor = dailyAverage × daysInMonth
  // Guard against division by zero (empty schedule → floor = 0)
  const dailyAverage = windowDays > 0 ? totalScheduledCost / windowDays : 0
  const floor = dailyAverage * daysInMonth

  return {
    floor,
    gaps,
    isClean: gaps.length === 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// isPlanCurrent — D-08 staleness detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true iff some plan in `plans` has a window [windowStart, windowEnd]
 * that includes `today` (YYYY-MM-DD, inclusive both ends).
 *
 * Lexicographic string comparison is correct for ISO 8601 YYYY-MM-DD dates.
 * Returns false for an empty array (→ stale/missing, use fallbackFloor).
 *
 * D-08: staleness trigger = no plan window covers today.
 */
export function isPlanCurrent(plans: ParsedPlan[], today: string): boolean {
  return plans.some(p => p.windowStart <= today && today <= p.windowEnd)
}

// ─────────────────────────────────────────────────────────────────────────────
// fallbackFloor — D-07 never-lower stale path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The STALE-PATH value: max(lastComputedFloor, allTimeHighWater).
 *
 * ONLY used when the live plan is not current (D-08). When a live plan IS current,
 * computeFloor output is used directly — high-water does NOT clamp the live result
 * (Pitfall 7 isolation). The display logic lives in the atom layer:
 *   planIsCurrent ? computeFloor(input).floor : fallbackFloor(meta)
 *
 * D-07 guarantee: displayed floor is never lower than max(last, highWater) on a gap.
 */
export function fallbackFloor(meta: FoodFloorMeta): number {
  return Math.max(meta.lastComputedFloor ?? 0, meta.allTimeHighWater ?? 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deduplicate gaps by their (type, name) key.
 * A meal scheduled multiple times should produce only one gap entry per type+name.
 */
function dedupeGaps(gaps: FloorGap[]): FloorGap[] {
  const seen = new Set<string>()
  const result: FloorGap[] = []
  for (const gap of gaps) {
    const key = gapKey(gap)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(gap)
    }
  }
  return result
}

function gapKey(gap: FloorGap): string {
  switch (gap.type) {
    case 'unpriced-ingredient': return `unpriced-ingredient:${gap.ingredientName}`
    case 'undefined-meal':      return `undefined-meal:${gap.mealName}`
    case 'unset-flat-cost':     return `unset-flat-cost:${gap.mealName}`
    case 'stale-plan':          return `stale-plan:${gap.lastKnownDate ?? 'null'}`
  }
}
