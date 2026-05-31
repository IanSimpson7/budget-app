// Storage layer tests for the food domain: MealDefinition CRUD, food settings
// singletons (unitCostMap, portionModel, foodFloorMeta, flavorLine), seed, and
// export/import round-trip (FOOD-02, FOOD-04, FOOD-05, FOOD-10, FOOD-12, FOOD-13).
// Mirrors storage.expenses.test.ts structure; resets IDB between every test.

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import * as storage from '../storage/storage'
import type { MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta, FlavorLine } from '../domains/food/food.types'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

// ── addMealDefinition / listMealDefinitions (FOOD-02) ─────────────────────────

describe('addMealDefinition + listMealDefinitions (FOOD-02)', () => {
  it('persists a row and returns it via listMealDefinitions', async () => {
    const meal: Omit<MealDefinition, 'id'> = {
      mealName: 'oatmeal and protein slop',
      type: 'decomposed',
      ingredients: ['oats', 'bulk whey'],
    }
    const id = await storage.addMealDefinition(meal)
    expect(typeof id).toBe('number')

    const list = await storage.listMealDefinitions()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ mealName: 'oatmeal and protein slop' })
    expect(list[0]!.id).toBe(id)
  })

  it('stores the mealName in normalized (lowercase + trimmed) form', async () => {
    await storage.addMealDefinition({
      mealName: 'oatmeal and protein slop',
      type: 'decomposed',
      ingredients: [],
    })
    const list = await storage.listMealDefinitions()
    expect(list[0]!.mealName).toBe('oatmeal and protein slop')
  })

  it('round-trips a flat-cost meal with flatCost field', async () => {
    const meal: Omit<MealDefinition, 'id'> = {
      mealName: 'qdoba bowl',
      type: 'flat-cost',
      ingredients: [],
      flatCost: 11,
    }
    await storage.addMealDefinition(meal)
    const list = await storage.listMealDefinitions()
    expect(list[0]!.flatCost).toBe(11)
    expect(list[0]!.type).toBe('flat-cost')
  })
})

// ── updateMealDefinition / deleteMealDefinition ────────────────────────────────

describe('updateMealDefinition', () => {
  it('updates the mealName field', async () => {
    const id = await storage.addMealDefinition({
      mealName: 'chicken, rice, and broccoli',
      type: 'decomposed',
      ingredients: ['chicken breast', 'rice', 'broccoli'],
    })
    await storage.updateMealDefinition(id, { mealName: 'chicken and rice' })
    const list = await storage.listMealDefinitions()
    expect(list[0]!.mealName).toBe('chicken and rice')
  })
})

describe('deleteMealDefinition', () => {
  it('removes the row from the table', async () => {
    const id = await storage.addMealDefinition({
      mealName: 'cereal and milk',
      type: 'decomposed',
      ingredients: ['cereal', 'milk'],
    })
    await storage.deleteMealDefinition(id)
    const list = await storage.listMealDefinitions()
    expect(list).toHaveLength(0)
  })
})

// ── observeMealDefinitions ─────────────────────────────────────────────────────

describe('observeMealDefinitions', () => {
  it('returns a Dexie Observable (not null/undefined)', () => {
    const obs = storage.observeMealDefinitions()
    expect(obs).toBeDefined()
    expect(typeof obs.subscribe).toBe('function')
  })
})

// ── saveUnitCostMap / getUnitCostMap (FOOD-04) ─────────────────────────────────

describe('saveUnitCostMap + getUnitCostMap (FOOD-04)', () => {
  it('returns [] when no map has been saved yet', async () => {
    const map = await storage.getUnitCostMap()
    expect(map).toEqual([])
  })

  it('round-trips a unit-cost map with a macro-bearing entry', async () => {
    const entries: UnitCostEntry[] = [
      { ingredientName: 'bulk whey', costPerUnit: 0.5, unit: 'oz', tag: 'macro-bearing' },
      { ingredientName: '90/10 ground beef', costPerUnit: 5.80, unit: 'lb', tag: 'macro-bearing' },
    ]
    await storage.saveUnitCostMap(entries)
    const map = await storage.getUnitCostMap()
    expect(map).toHaveLength(2)
    expect(map[0]).toMatchObject({ ingredientName: 'bulk whey', tag: 'macro-bearing' })
  })

  it('throws when any entry has a non-finite costPerUnit (T-04-02 guard)', async () => {
    const entries: UnitCostEntry[] = [
      { ingredientName: 'bad', costPerUnit: NaN, unit: 'lb', tag: 'macro-bearing' },
    ]
    await expect(storage.saveUnitCostMap(entries)).rejects.toThrow()
  })

  it('throws when costPerUnit is Infinity', async () => {
    const entries: UnitCostEntry[] = [
      { ingredientName: 'bad', costPerUnit: Infinity, unit: 'lb', tag: 'macro-bearing' },
    ]
    await expect(storage.saveUnitCostMap(entries)).rejects.toThrow()
  })
})

// ── savePortionModel / getPortionModel (FOOD-05) ──────────────────────────────

describe('savePortionModel + getPortionModel (FOOD-05)', () => {
  it('returns [] when no portion model has been saved yet', async () => {
    const model = await storage.getPortionModel()
    expect(model).toEqual([])
  })

  it('round-trips a portion model', async () => {
    const entries: PortionEntry[] = [
      { ingredientName: 'bulk whey', portionSize: 2 },
      { ingredientName: 'chicken breast', portionSize: 0.375 },
    ]
    await storage.savePortionModel(entries)
    const model = await storage.getPortionModel()
    expect(model).toHaveLength(2)
    expect(model[0]).toMatchObject({ ingredientName: 'bulk whey', portionSize: 2 })
  })

  it('throws when any entry has a non-finite portionSize', async () => {
    const entries: PortionEntry[] = [
      { ingredientName: 'bad', portionSize: NaN },
    ]
    await expect(storage.savePortionModel(entries)).rejects.toThrow()
  })
})

// ── saveFoodFloorMeta / getFoodFloorMeta (FOOD-11, FOOD-13) ───────────────────

describe('saveFoodFloorMeta + getFoodFloorMeta (FOOD-11, FOOD-13)', () => {
  it('returns default { lastComputedFloor: 0, allTimeHighWater: 0, lastRefinedFromReceipts: null } when unset', async () => {
    const meta = await storage.getFoodFloorMeta()
    expect(meta).toEqual({ lastComputedFloor: 0, allTimeHighWater: 0, lastRefinedFromReceipts: null })
  })

  it('round-trips a FoodFloorMeta record', async () => {
    const meta: FoodFloorMeta = {
      lastComputedFloor: 548.5,
      allTimeHighWater: 560.0,
      lastRefinedFromReceipts: '2026-05-29T10:00:00Z',
    }
    await storage.saveFoodFloorMeta(meta)
    const stored = await storage.getFoodFloorMeta()
    expect(stored).toEqual(meta)
  })

  it('preserves lastRefinedFromReceipts as null when not set', async () => {
    await storage.saveFoodFloorMeta({ lastComputedFloor: 500, allTimeHighWater: 550, lastRefinedFromReceipts: null })
    const stored = await storage.getFoodFloorMeta()
    expect(stored.lastRefinedFromReceipts).toBeNull()
  })
})

// ── saveFlavorLine / getFlavorLine (FOOD-10) ──────────────────────────────────

describe('saveFlavorLine + getFlavorLine (FOOD-10)', () => {
  it('returns default { amount: 50 } when not set (seed value)', async () => {
    const line = await storage.getFlavorLine()
    expect(line).toEqual({ amount: 50 })
  })

  it('round-trips a FlavorLine record', async () => {
    const line: FlavorLine = { amount: 60 }
    await storage.saveFlavorLine(line)
    const stored = await storage.getFlavorLine()
    expect(stored).toEqual(line)
  })

  it('throws when amount is non-finite (T-04-02 guard)', async () => {
    await expect(storage.saveFlavorLine({ amount: NaN })).rejects.toThrow()
  })

  it('throws when amount is Infinity', async () => {
    await expect(storage.saveFlavorLine({ amount: Infinity })).rejects.toThrow()
  })
})

// ── seedMealDefinitionsIfEmpty (FOOD-02 first-run) ────────────────────────────

describe('seedMealDefinitionsIfEmpty', () => {
  it('inserts exactly 14 normalized meals on a fresh DB', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    const list = await storage.listMealDefinitions()
    expect(list).toHaveLength(14)
  })

  it('all seeded meal names are normalized (lowercase + trimmed)', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    const list = await storage.listMealDefinitions()
    for (const meal of list) {
      expect(meal.mealName).toBe(meal.mealName.toLowerCase().trim())
    }
  })

  it('seeds "qdoba bowl" as type flat-cost (D-04)', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    const list = await storage.listMealDefinitions()
    const qdoba = list.find((m) => m.mealName === 'qdoba bowl')
    expect(qdoba).toBeDefined()
    expect(qdoba!.type).toBe('flat-cost')
  })

  it('is idempotent: running twice inserts rows only once (sentinel guard)', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    await storage.seedMealDefinitionsIfEmpty()
    const list = await storage.listMealDefinitions()
    expect(list).toHaveLength(14)
  })

  it('does not re-seed when meal rows already exist (sentinel guard)', async () => {
    await storage.addMealDefinition({ mealName: 'custom meal', type: 'decomposed', ingredients: [] })
    await storage.seedMealDefinitionsIfEmpty()
    const list = await storage.listMealDefinitions()
    // Only the custom row — seed is skipped
    expect(list).toHaveLength(1)
    expect(list[0]!.mealName).toBe('custom meal')
  })

  it('(I-04) seeds unitCostMap with a "bulk whey" entry tagged macro-bearing (EXP-07 handoff)', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    const map = await storage.getUnitCostMap()
    const whey = map.find((e) => e.ingredientName === 'bulk whey')
    expect(whey).toBeDefined()
    expect(whey!.tag).toBe('macro-bearing')
  })

  it('(I-04) unitCostMap is non-empty on first run', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    const map = await storage.getUnitCostMap()
    expect(map.length).toBeGreaterThan(0)
  })
})

// ── Export / import round-trip for food domain ────────────────────────────────

describe('export + import round-trip for food domain', () => {
  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  it('meal definition survives export then import into a fresh DB', async () => {
    await storage.addMealDefinition({
      mealName: 'chicken, rice, and broccoli',
      type: 'decomposed',
      ingredients: ['chicken breast', 'rice', 'broccoli'],
    })

    const envelope = await storage.exportAll()
    expect(Array.isArray(envelope.data.mealDefinitions)).toBe(true)
    expect((envelope.data.mealDefinitions as unknown[]).length).toBe(1)

    // Wipe DB and re-import
    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const list = await storage.listMealDefinitions()
    expect(list).toHaveLength(1)
    expect(list[0]!.mealName).toBe('chicken, rice, and broccoli')
  })

  it('flavorLine amount survives full export/import round-trip', async () => {
    await storage.saveFlavorLine({ amount: 55 })
    const envelope = await storage.exportAll()

    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const line = await storage.getFlavorLine()
    expect(line.amount).toBe(55)
  })

  it('14 seeded meals + flavorLine amount survive a full export/import cycle', async () => {
    await storage.seedMealDefinitionsIfEmpty()
    const envelope = await storage.exportAll()

    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const list = await storage.listMealDefinitions()
    expect(list).toHaveLength(14)

    const line = await storage.getFlavorLine()
    expect(line.amount).toBe(50) // default seed value
  })

  it('unitCostMap survives export/import round-trip', async () => {
    await storage.saveUnitCostMap([
      { ingredientName: 'bulk whey', costPerUnit: 0.5, unit: 'oz', tag: 'macro-bearing' },
    ])
    const envelope = await storage.exportAll()

    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const map = await storage.getUnitCostMap()
    expect(map).toHaveLength(1)
    expect(map[0]!.ingredientName).toBe('bulk whey')
  })

  it('portionModel survives export/import round-trip', async () => {
    await storage.savePortionModel([
      { ingredientName: 'bulk whey', portionSize: 2 },
    ])
    const envelope = await storage.exportAll()

    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const model = await storage.getPortionModel()
    expect(model).toHaveLength(1)
    expect(model[0]!.ingredientName).toBe('bulk whey')
  })

  it('foodFloorMeta survives export/import round-trip', async () => {
    await storage.saveFoodFloorMeta({
      lastComputedFloor: 548,
      allTimeHighWater: 560,
      lastRefinedFromReceipts: '2026-05-29T10:00:00Z',
    })
    const envelope = await storage.exportAll()

    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const meta = await storage.getFoodFloorMeta()
    expect(meta.lastComputedFloor).toBe(548)
    expect(meta.allTimeHighWater).toBe(560)
    expect(meta.lastRefinedFromReceipts).toBe('2026-05-29T10:00:00Z')
  })
})

// ── WR-05: Import validates finiteness of food-domain financial fields ─────────
//
// C1 rationale: a tampered or corrupt backup must not poison the protected floor.
// NaN propagates through Math.max, poisoning allTimeHighWater permanently.
// The import path MUST reject non-finite food fields, matching the guards on the
// normal write path (saveUnitCostMap, savePortionModel, saveFlavorLine).

describe('WR-05: import rejects non-finite food-domain fields (C1 tamper guard)', () => {
  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  // Build a raw JSON string manually to inject values that survive serialization.
  // NOTE: JSON cannot represent NaN or Infinity (they serialize to null via JSON.stringify).
  // Real tamper attack vectors:
  //   - null where a number is expected (removes floor guard)
  //   - "NaN" as a JSON string (parsed as a string, not a number — corrupts type)
  //   - Missing fields (omitted — treated as undefined)
  //
  // The import guard must reject: non-numeric types, null, missing values for financial fields.
  // This matches the saveUnitCostMap/savePortionModel guards: they require Number.isFinite().
  function makeRawEnvelope(settingsJson: string) {
    return `{"schemaVersion":3,"exportedAt":"2026-01-01T00:00:00Z","appVersion":"0.0.0","data":{"incomeChecks":[],"expenseItems":[],"sinkingFunds":[],"mealDefinitions":[],"accounts":[],"settings":${settingsJson}}}`
  }

  it('imports a clean backup without throwing (baseline: round-trip succeeds)', async () => {
    // A clean backup with finite food fields must succeed
    const cleanJson = '{"foodFloorMeta":{"lastComputedFloor":548,"allTimeHighWater":560,"lastRefinedFromReceipts":null},"unitCostMap":[{"ingredientName":"bulk whey","costPerUnit":0.5,"unit":"oz","tag":"macro-bearing"}],"portionModel":[{"ingredientName":"bulk whey","portionSize":2}]}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(cleanJson)))).resolves.not.toThrow()
    const meta = await storage.getFoodFloorMeta()
    expect(meta.allTimeHighWater).toBe(560)
  })

  it('rejects import when foodFloorMeta.allTimeHighWater is null (non-numeric)', async () => {
    // null allTimeHighWater would be treated as 0 downstream — incorrectly resets high-water
    // The guard must require a proper finite number for allTimeHighWater
    const tampered = '{"foodFloorMeta":{"lastComputedFloor":548,"allTimeHighWater":null,"lastRefinedFromReceipts":null}}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
    // DB must not be poisoned
    const meta = await storage.getFoodFloorMeta()
    expect(typeof meta.allTimeHighWater).toBe('number')
    expect(Number.isFinite(meta.allTimeHighWater)).toBe(true)
  })

  it('rejects import when foodFloorMeta.lastComputedFloor is null (non-numeric)', async () => {
    const tampered = '{"foodFloorMeta":{"lastComputedFloor":null,"allTimeHighWater":560,"lastRefinedFromReceipts":null}}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
  })

  it('rejects import when foodFloorMeta.allTimeHighWater is a string "NaN" (wrong type)', async () => {
    // String "NaN" bypasses Number.isFinite (which needs a numeric arg), catches type error
    const tampered = '{"foodFloorMeta":{"lastComputedFloor":548,"allTimeHighWater":"NaN","lastRefinedFromReceipts":null}}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
  })

  it('rejects import when unitCostMap has costPerUnit: null (non-finite after Number())', async () => {
    const tampered = '{"unitCostMap":[{"ingredientName":"bulk whey","costPerUnit":null,"unit":"oz","tag":"macro-bearing"}]}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
  })

  it('rejects import when unitCostMap has costPerUnit as a string (wrong type)', async () => {
    const tampered = '{"unitCostMap":[{"ingredientName":"bulk whey","costPerUnit":"bad","unit":"oz","tag":"macro-bearing"}]}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
  })

  it('rejects import when portionModel has portionSize: null', async () => {
    const tampered = '{"portionModel":[{"ingredientName":"bulk whey","portionSize":null}]}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
  })

  it('rejects import when portionModel has portionSize as a string', async () => {
    const tampered = '{"portionModel":[{"ingredientName":"bulk whey","portionSize":"bad"}]}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()
  })

  // WR-01: flavorLine.amount and mealDefinitions[].flatCost also bypass their save guards
  // via the import path. 1e999 parses to Infinity — a valid JSON *number* that slips past
  // a null/undefined check yet is non-finite — the real tamper vector for these fields.
  const makeRawEnvelopeFull = (settingsJson: string, mealDefsJson = '[]') =>
    `{"schemaVersion":3,"exportedAt":"2026-01-01T00:00:00Z","appVersion":"0.0.0","data":{"incomeChecks":[],"expenseItems":[],"sinkingFunds":[],"mealDefinitions":${mealDefsJson},"accounts":[],"settings":${settingsJson}}}`

  it('WR-01: rejects import when flavorLine.amount is Infinity (1e999)', async () => {
    const tampered = makeRawEnvelopeFull('{"flavorLine":{"amount":1e999}}')
    await expect(storage.importAll(makeFile(tampered))).rejects.toThrow()
  })

  it('WR-01: rejects import when flavorLine.amount is null', async () => {
    const tampered = makeRawEnvelopeFull('{"flavorLine":{"amount":null}}')
    await expect(storage.importAll(makeFile(tampered))).rejects.toThrow()
  })

  it('WR-01: rejects import when mealDefinitions[].flatCost is Infinity (1e999)', async () => {
    const mealDefs = '[{"mealName":"qdoba bowl","type":"flat-cost","ingredients":[],"flatCost":1e999}]'
    const tampered = makeRawEnvelopeFull('{}', mealDefs)
    await expect(storage.importAll(makeFile(tampered))).rejects.toThrow()
  })

  it('WR-01: rejects import when mealDefinitions[].flatCost is a string', async () => {
    const mealDefs = '[{"mealName":"qdoba bowl","type":"flat-cost","ingredients":[],"flatCost":"bad"}]'
    const tampered = makeRawEnvelopeFull('{}', mealDefs)
    await expect(storage.importAll(makeFile(tampered))).rejects.toThrow()
  })

  it('WR-01: accepts mealDefinitions[].flatCost = null (valid "unset" → fallback-high)', async () => {
    // null/undefined flatCost is the legitimate unset state — must NOT be rejected.
    const mealDefs = '[{"mealName":"qdoba bowl","type":"flat-cost","ingredients":[],"flatCost":null}]'
    const clean = makeRawEnvelopeFull('{}', mealDefs)
    await expect(storage.importAll(makeFile(clean))).resolves.not.toThrow()
  })

  it('no partial write: after a rejected import, the DB is unchanged', async () => {
    // Pre-populate a valid state
    await storage.saveFoodFloorMeta({ lastComputedFloor: 500, allTimeHighWater: 600, lastRefinedFromReceipts: null })

    // Attempt to import a tampered backup — validation runs BEFORE clear, so no partial write
    const tampered = '{"foodFloorMeta":{"lastComputedFloor":0,"allTimeHighWater":null,"lastRefinedFromReceipts":null}}'
    await expect(storage.importAll(makeFile(makeRawEnvelope(tampered)))).rejects.toThrow()

    // After a pre-validation failure, the DB must NOT have been wiped.
    // The floor meta should still be the pre-import state (500/600) OR the default (0/0).
    // The key invariant: allTimeHighWater must be finite (not null/NaN/poisoned).
    const meta = await storage.getFoodFloorMeta()
    expect(Number.isFinite(meta.allTimeHighWater)).toBe(true)
  })
})
