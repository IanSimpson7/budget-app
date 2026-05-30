/**
 * costEngine.ts — STUB (RED phase: tests should fail until implementation is added)
 *
 * C1-CRITICAL: This is the heart of C1. Every uncertainty (unpriced ingredient,
 * undefined meal, unset flat cost) MUST fall back HIGH — never $0, never undercount.
 * Restriction is the BED clinical trigger.
 *
 * Open Question 1 resolution (04-RESEARCH.md A4):
 * FALLBACK_CEILING_PER_MEAL = $15.00
 * Rationale: Qdoba bowl ~$11; a full prep-cooked meal ~$3–5; $15 is conservative-high
 * per meal. A static constant (NOT "most-expensive-defined-meal") so the fallback is
 * deterministic even when no meals are defined yet. Per RESEARCH Open Question 1 / A4.
 */
import type { MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta } from './food.types'

export const FALLBACK_CEILING_PER_MEAL = 15

export type FloorGap =
  | { type: 'unpriced-ingredient'; ingredientName: string }
  | { type: 'undefined-meal';      mealName: string }
  | { type: 'unset-flat-cost';     mealName: string }
  | { type: 'stale-plan';          lastKnownDate: string | null }

export interface CostEngineInput {
  scheduledMeals:  string[]
  mealDefinitions: MealDefinition[]
  unitCostMap:     UnitCostEntry[]
  portionModel:    PortionEntry[]
  daysInMonth:     number
  windowDays:      number
}

export interface CostEngineResult {
  floor:   number
  gaps:    FloorGap[]
  isClean: boolean
}

export interface ParsedPlan {
  windowStart: string
  windowEnd:   string
  meals:       string[]
}

// Stub implementations — tests will fail
export function computeFloor(_input: CostEngineInput): CostEngineResult {
  throw new Error('not implemented')
}

export function isPlanCurrent(_plans: ParsedPlan[], _today: string): boolean {
  throw new Error('not implemented')
}

export function fallbackFloor(_meta: FoodFloorMeta): number {
  throw new Error('not implemented')
}
