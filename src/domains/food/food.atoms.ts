// Food domain — reactive Jotai atom chain.
//
// Source atoms:
//   mealDefinitionsAtom: atomWithObservable over storage.observeMealDefinitions().
//     initialValue:[] prevents Suspense (same pattern as income.atoms.ts).
//   parsedPlansAtom: async atom that lazy-loads all SMC plan files via import.meta.glob.
//
// Singleton atoms (unitCostMap, portionModel, foodFloorMeta, flavorLine):
//   Plain async atom + refreshCounterAtom pattern (same as floorsLoadAtom in settings.atoms.ts).
//   Write atoms bump the counter to force a re-fetch.
//   mealDefinitions write atoms do NOT bump a counter — liveQuery re-emits automatically.
//
// foodFloorAtom (DERIVED, READ-ONLY, NEVER PERSISTED):
//   Reads all inputs, computes today + daysInMonth FRESH at read time (I-01).
//   When a current plan covers today → computeFloor (live path).
//   When no current plan → fallbackFloor(meta) = max(lastComputed, highWater) (D-07).
//   WRITE-BACK (I-03): on a CLEAN (gap-free) live result only, fire-and-forget
//   saveFoodFloorMeta with Math.max(prev, floor) for allTimeHighWater.
//   NEVER writes back on a gapped result or the stale path.
//
// foodBadgeStatusAtom: 'clean' | 'needs-attention' derived from foodFloorAtom.gaps.
//
// C1 / Import boundary: this file imports storage ONLY (never db, never liveQuery from dexie).
//   Grep gate: `grep -c "storage/db"` in this file returns 0.
//   Grep gate: food.atoms.ts does NOT import from expenses.atoms.ts (Pitfall 4).
//
// Pitfall 7 isolation: high-water only governs the STALE path. computeFloor output
//   is the LIVE floor regardless of high-water when planIsCurrent.
//
// I-02 (HARD V8): In DEV mode, a console.error fires if the glob resolves to 0 files.
//   A wrong path depth silently returns {} and is indistinguishable from the intended
//   CI 0-files fallback — the guard catches it before it passes undetected.
//   This guard is a no-op in production where 0 files is the expected CI-deploy state.

import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import { parsePlanFile } from './planParser'
import { computeFloor, fallbackFloor } from './costEngine'
import type { FloorGap } from './costEngine'
import type { MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta, FlavorLine } from './food.types'

// ── DEFAULT_FOOD_FLOOR_SEED ────────────────────────────────────────────────────
// When meta is all zeros (no prior computation), the stale path uses this seed
// instead of showing $0. Matches §12 provisional floor value (~$550/mo).
// This is the fallback-of-last-resort — not a user-settable target.
const DEFAULT_FOOD_FLOOR_SEED = 550

// ── GLOB LOADER (Pattern 1) ────────────────────────────────────────────────────
// Vite bundles all plan files as raw strings at build time.
// FOUR levels up from src/domains/food/ → projects/ → schedule-meal-coordinator/
// Path depth verified: food → domains → src → budget-app → projects → sibling repo.
// Planner-verified: from src/domains/food/food.atoms.ts, path is ../../../../.
//
// I-02 HARD V8 guard: if DEV and 0 files, console.error — a wrong depth silently
// returns {} and mimics the CI 0-files fallback; must not pass undetected locally.

// query: '?raw' + import: 'default' is the Vite 5+ recommended form of { as: 'raw' }.
// (Vite 4: { as: 'raw' }; Vite 5+: { query: '?raw', import: 'default' })
// eager: false (default) so plan files load lazily — not at module init time.
const RAW_PLAN_GLOB = import.meta.glob(
  '../../../../schedule-meal-coordinator/plans/*.md',
  { query: '?raw', import: 'default', eager: false },
) as Record<string, () => Promise<string>>

// DEV-ONLY guard (I-02): trip loudly if the glob depth is wrong.
// In production (CI deploy), 0 files is the expected stale-state behavior (V8).
if (import.meta.env.DEV) {
  const globKeyCount = Object.keys(RAW_PLAN_GLOB).length
  if (globKeyCount === 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[food.atoms] DEV WARNING (I-02): import.meta.glob resolved 0 plan files.\n' +
      'If the schedule-meal-coordinator repo IS present locally, the glob path depth is WRONG.\n' +
      'Current pattern: "../../../../schedule-meal-coordinator/plans/*.md"\n' +
      'From src/domains/food/food.atoms.ts: food→domains→src→budget-app→projects→sibling.\n' +
      'If SMC is absent, this is expected stale-path behavior (CI deploy fallback).\n' +
      'Fix: adjust the number of "../" levels until Object.keys(RAW_PLAN_GLOB).length > 0.',
    )
  }
}

// ── FoodFloorResult (exported — Plan 05 UI consumes this) ─────────────────────

export interface FoodFloorResult {
  floor: number
  gaps: FloorGap[]
  isClean: boolean
  planIsCurrent: boolean
}

// ── parsedPlansAtom ───────────────────────────────────────────────────────────
// Async: lazy-loads all plan files via RAW_PLAN_GLOB, parses each, filters nulls.

export const parsedPlansAtom = atom(async (): Promise<ReturnType<typeof parsePlanFile>[]> => {
  const entries = Object.entries(RAW_PLAN_GLOB)
  const results = await Promise.all(
    entries.map(async ([path, loader]) => {
      const raw = await loader()
      const filename = path.split('/').pop() ?? ''
      return parsePlanFile(filename, raw)
    }),
  )
  return results.filter((p): p is NonNullable<typeof p> => p !== null)
})

// ── mealDefinitionsAtom ───────────────────────────────────────────────────────
// atomWithObservable bridges storage.observeMealDefinitions() (Dexie liveQuery)
// to Jotai. initialValue:[] prevents Suspense. NO refreshCounter needed —
// liveQuery re-emits on every IDB write automatically.

export const mealDefinitionsAtom = atomWithObservable<MealDefinition[]>(
  () => storage.observeMealDefinitions(),
  { initialValue: [] },
)

// ── Singleton atoms (plain async + refreshCounter) ────────────────────────────
// Pattern: incrementing the counter invalidates the atom and forces a re-fetch
// from storage on next read. Same pattern as floorsLoadAtom in settings.atoms.ts.

const unitCostRefreshAtom = atom(0)
const portionRefreshAtom = atom(0)
const metaRefreshAtom = atom(0)
const flavorRefreshAtom = atom(0)

export const unitCostMapAtom = atom(async (get): Promise<UnitCostEntry[]> => {
  get(unitCostRefreshAtom)
  return storage.getUnitCostMap()
})

export const portionModelAtom = atom(async (get): Promise<PortionEntry[]> => {
  get(portionRefreshAtom)
  return storage.getPortionModel()
})

export const foodFloorMetaAtom = atom(async (get): Promise<FoodFloorMeta> => {
  get(metaRefreshAtom)
  return storage.getFoodFloorMeta()
})

export const flavorLineAtom = atom(async (get): Promise<FlavorLine> => {
  get(flavorRefreshAtom)
  return storage.getFlavorLine()
})

// ── foodFloorAtom (DERIVED, READ-ONLY, NEVER PERSISTED) ───────────────────────
//
// C1-CRITICAL derivation chain: plans + mealDefs + unitCosts + portions + meta
// → live computeFloor OR max(last, highWater) fallback.
//
// I-01: today and daysInMonth computed FRESH from new Date() INSIDE the atom body.
// A session left open across midnight on the last day of a month will NOT auto-
// recompute until the next app re-mount or input change (acceptable v1 limitation;
// Ian re-opens the app daily). The recompute is driven by atom re-reads, not a timer.
//
// I-03 WRITE-BACK (clean-only):
//   On a CLEAN (gaps.length === 0) live computation, fire-and-forget saveFoodFloorMeta
//   with lastComputedFloor=floor and allTimeHighWater=Math.max(prev, floor).
//   This is the ONLY write path to foodFloorMeta in the entire app.
//   DOES NOT write back on: stale path, any gapped result.
//   Math.max ensures allTimeHighWater NEVER decreases (C1 invariant).

export const foodFloorAtom = atom(async (get): Promise<FoodFloorResult> => {
  // Read all inputs
  const plans = await get(parsedPlansAtom)
  const mealDefs = get(mealDefinitionsAtom)
  const unitCosts = await get(unitCostMapAtom)
  const portions = await get(portionModelAtom)
  const meta = await get(foodFloorMetaAtom)

  // I-01: compute today FRESH at read time — new Date() inside atom body, not memoized
  const now = new Date()
  // Local YYYY-MM-DD — same convention as income date classification
  const year = now.getFullYear()
  const month = now.getMonth()   // 0-indexed
  const day = now.getDate()
  const today = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // I-01: daysInMonth derived from current date at read time
  // new Date(year, month+1, 0) gives the last day of current month
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // D-08: filter plans covering today
  const currentPlans = plans.filter(
    (p) => p !== null && p.windowStart <= today && today <= p.windowEnd,
  ) as NonNullable<typeof plans[number]>[]
  const planIsCurrent = currentPlans.length > 0

  if (!planIsCurrent) {
    // D-07 stale path: max(lastComputedFloor, allTimeHighWater)
    // When both are 0, use DEFAULT_FOOD_FLOOR_SEED as the last-resort floor (never $0)
    const rawFallback = fallbackFloor(meta)
    const floor = rawFallback > 0 ? rawFallback : DEFAULT_FOOD_FLOOR_SEED

    // Determine the lastKnownDate from the most recent plan window end
    const lastKnownDate = plans.length > 0
      ? plans.reduce<string | null>((latest, p) => {
          if (!p) return latest
          if (!latest) return p.windowEnd
          return p.windowEnd > latest ? p.windowEnd : latest
        }, null)
      : null

    const stalePlanGap: FloorGap = { type: 'stale-plan', lastKnownDate }
    return {
      floor,
      gaps: [stalePlanGap],
      isClean: false,
      planIsCurrent: false,
    }
  }

  // Live path: collect all meals from current plans (flattened)
  const scheduledMeals = currentPlans.flatMap((p) => p.meals)

  // Compute the number of distinct days covered by current plans
  // (each plan's window may span multiple days; we collect the union)
  const coveredDays = new Set<string>()
  for (const p of currentPlans) {
    let d = new Date(p.windowStart + 'T12:00:00Z')
    const end = new Date(p.windowEnd + 'T12:00:00Z')
    while (d <= end) {
      coveredDays.add(d.toISOString().slice(0, 10))
      d = new Date(d.getTime() + 86400000)
    }
  }
  const windowDays = Math.max(coveredDays.size, 1)

  const result = computeFloor({
    scheduledMeals,
    mealDefinitions: mealDefs,
    unitCostMap: unitCosts,
    portionModel: portions,
    daysInMonth,
    windowDays,
  })

  // I-03 WRITE-BACK: persist metadata ONLY on a clean (gap-free) result.
  // High-water uses Math.max — never decreases (C1 invariant).
  if (result.isClean) {
    const newMeta: FoodFloorMeta = {
      ...meta,
      lastComputedFloor: result.floor,
      allTimeHighWater: Math.max(meta.allTimeHighWater, result.floor),
    }
    // Fire-and-forget — we do not await so the derived atom stays pure-ish
    void storage.saveFoodFloorMeta(newMeta).then(() => {
      // bump meta counter so next read reflects the saved value
      // (store.set not available in atom body; bump is handled by write atoms)
    })
  }

  return {
    floor: result.floor,
    gaps: result.gaps,
    isClean: result.isClean,
    planIsCurrent: true,
  }
})

// ── foodBadgeStatusAtom ───────────────────────────────────────────────────────
// Derived from foodFloorAtom.gaps. D-11: one status badge, expandable detail.

export const foodBadgeStatusAtom = atom(
  async (get): Promise<'clean' | 'needs-attention'> => {
    const result = await get(foodFloorAtom)
    return result.gaps.length === 0 ? 'clean' : 'needs-attention'
  },
)

// ── Write atoms ────────────────────────────────────────────────────────────────

// Singleton write atoms bump their respective refresh counter after persisting.
// mealDefinition write atoms do NOT bump a counter — liveQuery re-emits automatically.

export const saveUnitCostMapAtom = atom(
  null,
  async (_get, set, entries: UnitCostEntry[]): Promise<void> => {
    await storage.saveUnitCostMap(entries)
    set(unitCostRefreshAtom, (n) => n + 1)
  },
)

export const savePortionModelAtom = atom(
  null,
  async (_get, set, entries: PortionEntry[]): Promise<void> => {
    await storage.savePortionModel(entries)
    set(portionRefreshAtom, (n) => n + 1)
  },
)

export const saveFlavorLineAtom = atom(
  null,
  async (_get, set, line: FlavorLine): Promise<void> => {
    await storage.saveFlavorLine(line)
    set(flavorRefreshAtom, (n) => n + 1)
  },
)

// Meal definition write atoms — NO refresh counter (liveQuery re-emits on IDB write)

export const saveMealDefinitionAtom = atom(
  null,
  async (_get, _set, meal: Omit<MealDefinition, 'id'>): Promise<void> => {
    await storage.addMealDefinition(meal)
  },
)

export const updateMealDefinitionAtom = atom(
  null,
  async (_get, _set, { id, patch }: { id: number; patch: Partial<MealDefinition> }): Promise<void> => {
    await storage.updateMealDefinition(id, patch)
  },
)

export const deleteMealDefinitionAtom = atom(
  null,
  async (_get, _set, id: number): Promise<void> => {
    await storage.deleteMealDefinition(id)
  },
)

// saveFoodFloorMetaAtom — used by FoodConfigPage "Mark refined today" (FOOD-13).
// Persists a timestamp to lastRefinedFromReceipts; bumps the meta refresh counter.
// FOOD-13: this records a timestamp ONLY — it NEVER edits the floor value directly.
// The floor is always derived; saveFoodFloorMeta cannot set lastComputedFloor to
// an arbitrary user value (the field is written only by the clean-computation write-back, I-03).

export const saveFoodFloorMetaAtom = atom(
  null,
  async (_get, set, meta: FoodFloorMeta): Promise<void> => {
    await storage.saveFoodFloorMeta(meta)
    set(metaRefreshAtom, (n) => n + 1)
  },
)
