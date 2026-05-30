// Pure types + constants for the food domain. NO Dexie or storage imports here.
// Mirrors src/storage/schema.ts Readonly + discriminated-union style.

export type MealType = 'decomposed' | 'flat-cost'

/**
 * C1 DEFAULT (I-05): any newly-created UnitCostEntry MUST default its tag to
 * 'macro-bearing' (included in the per-meal floor cost sum). NEVER default to
 * 'flavor-condiment' — flavor defaults would silently exclude the ingredient
 * from the cost sum, causing an undercount of the protected floor. That is a
 * C1 risk (restriction is the BED clinical trigger).
 *
 * Ian opts INTO 'flavor-condiment' explicitly for e.g. syrups/sauces. Any new
 * ingredient is conservative (included) until Ian re-tags it.
 */
export type IngredientTag = 'macro-bearing' | 'flavor-condiment'

/**
 * App-owned meal definition. Each meal is either ingredient-decomposed (type='decomposed')
 * with a list of macro-bearing ingredients, OR a flat-cost item (type='flat-cost') with an
 * optional flatCost field (e.g. "Qdoba bowl"). Unset flatCost triggers fallback-high (D-04).
 *
 * mealName is the SMC-join key. NORMALIZATION CONTRACT: mealName is always stored as
 * normalizeMealName(s) = s.trim().toLowerCase(). SMC meal names must be normalized the
 * same way before join lookup (Pitfall 5 avoidance).
 */
export type MealDefinition = Readonly<{
  id?: number
  mealName: string       // NORMALIZED: lowercase + trimmed — the SMC-join key
  type: MealType
  ingredients: string[]  // macro-bearing ingredient names; [] for flat-cost meals
  flatCost?: number      // required when type === 'flat-cost'; unset triggers fallback-high
}>

/**
 * A unit-cost map entry. costPerUnit === 0 is treated as "unpriced" and triggers
 * fallback-high (FOOD-08). The tag controls whether this ingredient is included
 * in per-meal cost Σ:
 *
 * C1 DEFAULT (I-05): NEW entries MUST default tag to 'macro-bearing' (included in floor).
 * Defaulting to 'flavor-condiment' would silently exclude the ingredient from the
 * per-meal sum — undercount = C1 risk.
 */
export type UnitCostEntry = Readonly<{
  ingredientName: string  // key space shared with PortionEntry + MealDefinition.ingredients[]
  costPerUnit: number     // $/unit; 0 treated as unpriced → fallback-high (FOOD-08)
  unit: string            // 'lb' | 'oz' | 'each' | ...
  tag: IngredientTag      // 'macro-bearing' = included in per-meal sum; 'flavor-condiment' = excluded (D-05)
}>

/**
 * Per-ingredient portion size. portionSize is expressed in the same unit as
 * UnitCostEntry.unit. Portions are GLOBAL per ingredient (D-03) — one value
 * reused across all meals.
 */
export type PortionEntry = Readonly<{
  ingredientName: string
  portionSize: number    // in same unit as UnitCostEntry.unit
}>

/**
 * C1: FoodFloorMeta has NO writable floor field. Only engine-written metadata:
 * lastComputedFloor (written by the cost engine after a successful computation),
 * allTimeHighWater (ratchets up; never down), and lastRefinedFromReceipts (FOOD-13 timestamp).
 *
 * saveFoodFloorMeta persists only these fields — there is NO setFoodFloor method
 * anywhere on the storage surface (V6 absence-proof).
 */
export type FoodFloorMeta = Readonly<{
  lastComputedFloor: number
  allTimeHighWater: number
  lastRefinedFromReceipts: string | null  // ISO datetime or null
}>

/**
 * Monthly PROTECTED flavor/condiment budget (FOOD-10). This is a separate fixed
 * amount excluded from per-meal cost pricing. Seed: ~$50/mo. Editable upward.
 */
export type FlavorLine = Readonly<{
  amount: number  // monthly protected flavor/condiment budget
}>

/**
 * SMC-join normalization contract (Pitfall 5 avoidance).
 * All meal names stored in the meal-definition table use this normalization.
 * SMC meal names from plan files MUST be normalized the same way before lookup.
 */
export function normalizeMealName(s: string): string {
  return s.trim().toLowerCase()
}
