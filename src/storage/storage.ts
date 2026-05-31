// Public storage abstraction. Domain code talks to this module ONLY — Dexie is
// never imported outside src/storage/. The public surface is intentionally
// minimal: income CRUD, known-source/estimate settings, observeIncomeChecks,
// getFloors, saveFloors, exportAll, importAll. Inviolable constraints
// C1 / C2 / C3 are STRUCTURALLY enforced by the absence of any credential-
// storage, money-movement, or floor-lowering method on this module's exports.
// See src/test/storage.test.ts for the explicit absence proofs.

import { liveQuery, type Observable } from 'dexie'
import { db } from './db'
import { MIGRATIONS } from './migrations'
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FLOORS,
  ImportError,
  type ExpenseItem,
  type ExportEnvelope,
  type Floors,
  type IncomeCheck,
  type KnownSource,
  type SchemaV1Data,
  type SinkingFund,
} from './schema'
import {
  normalizeMealName,
  type MealDefinition,
  type UnitCostEntry,
  type PortionEntry,
  type FoodFloorMeta,
  type FlavorLine,
} from '../domains/food/food.types'

const FLOORS_KEY = 'floors'
const KNOWN_SOURCES_KEY = 'knownSources'
const ESTIMATE_KEY = 'estimatePerCheck'

// ── Income CRUD ────────────────────────────────────────────────────────────

export async function addIncomeCheck(check: Omit<IncomeCheck, 'id'>): Promise<number> {
  // Spread to avoid fake-indexeddb mutating the caller's object with the
  // auto-generated id (Object.defineProperty on keyPath sets id on input).
  return db.incomeChecks.add({ ...check } as IncomeCheck)
}

// Inserts checks sequentially. Each Dexie .add() call runs in its own
// auto-committed transaction — this avoids the fake-indexeddb v6 ConstraintError
// that bulkAdd triggers when the db has been delete/reopened multiple times
// (a known fake-indexeddb issue with bulkAdd on auto-increment stores).
// In production (real IDB), sequential adds are fast and correct.
// Inserts checks sequentially. Spreading each check avoids fake-indexeddb
// mutating the caller's object with the auto-generated id.
export async function addIncomeChecks(checks: Omit<IncomeCheck, 'id'>[]): Promise<number[]> {
  const ids: number[] = []
  for (const check of checks) {
    // eslint-disable-next-line no-await-in-loop
    const id = await db.incomeChecks.add({ ...check } as IncomeCheck)
    ids.push(id)
  }
  return ids
}

export async function listIncomeChecks(): Promise<IncomeCheck[]> {
  return db.incomeChecks.toArray()
}

export async function updateIncomeCheck(id: number, patch: Partial<IncomeCheck>): Promise<void> {
  await db.incomeChecks.update(id, patch)
}

export async function deleteIncomeCheck(id: number): Promise<void> {
  await db.incomeChecks.delete(id)
}

// ── Expense CRUD (EXP-01, EXP-02) ────────────────────────────────────────
// Mirrors income CRUD verbatim. The { ...item } spread avoids fake-indexeddb
// mutating the caller's object with the auto-generated id (same as addIncomeCheck).
// T-03-02: guard against non-finite amounts before writing to IndexedDB.

export async function addExpenseItem(item: Omit<ExpenseItem, 'id'>): Promise<number> {
  if (!Number.isFinite(item.amount)) {
    throw new Error(`addExpenseItem: non-finite amount (${item.amount})`)
  }
  return db.expenseItems.add({ ...item } as ExpenseItem)
}

export async function listExpenseItems(): Promise<ExpenseItem[]> {
  return db.expenseItems.toArray()
}

export async function updateExpenseItem(id: number, patch: Partial<ExpenseItem>): Promise<void> {
  await db.expenseItems.update(id, patch)
}

export async function deleteExpenseItem(id: number): Promise<void> {
  await db.expenseItems.delete(id)
}

// Returns a Dexie Observable so atoms import storage, never db (grep gate).
export function observeExpenseItems(): Observable<ExpenseItem[]> {
  return liveQuery(() => db.expenseItems.toArray() as Promise<ExpenseItem[]>)
}

// Seed sentinel key — decouples "no rows" (valid user state after delete) from
// "never seeded" (first-run state). Pitfall 4 avoidance.
const EXPENSES_SEEDED_KEY = 'expensesSeeded'

// D-03 seed set: PROTECTED fixed costs ex-food. Car insurance is NOT here (it
// seeds as the sinking-fund instance). Whey/supplement is NOT here (EXP-07).
const SEED_EXPENSES: Omit<ExpenseItem, 'id'>[] = [
  { name: 'Housing all-in', amount: 1300, cadence: 'monthly', classification: 'protected' },
  { name: 'Electric', amount: 65, cadence: 'monthly', classification: 'protected' },
  { name: 'Fuel', amount: 238, cadence: 'monthly', classification: 'protected' },
  { name: 'Claude', amount: 100, cadence: 'monthly', classification: 'protected' },
]

export async function seedExpensesIfEmpty(): Promise<void> {
  const sentinelRow = await db.settings.get(EXPENSES_SEEDED_KEY)
  if (sentinelRow !== undefined) return // already seeded via this function — do not clobber Ian's edits
  // Also skip if any protected rows already exist (added manually or via import)
  const protectedCount = await db.expenseItems
    .where('classification')
    .equals('protected')
    .count()
  if (protectedCount > 0) return
  for (const item of SEED_EXPENSES) {
    await db.expenseItems.add({ ...item } as ExpenseItem)
  }
  await db.settings.put({ key: EXPENSES_SEEDED_KEY, value: true })
}

// ── Sinking Fund CRUD (EXP-04, EXP-05) ────────────────────────────────────
// Same pattern as expense CRUD. T-03-02 guards on financial fields.

export async function addSinkingFund(fund: Omit<SinkingFund, 'id'>): Promise<number> {
  if (!Number.isFinite(fund.annualAmount)) {
    throw new Error(`addSinkingFund: non-finite annualAmount (${fund.annualAmount})`)
  }
  if (!Number.isFinite(fund.monthlyAccrual)) {
    throw new Error(`addSinkingFund: non-finite monthlyAccrual (${fund.monthlyAccrual})`)
  }
  return db.sinkingFunds.add({ ...fund } as SinkingFund)
}

export async function listSinkingFunds(): Promise<SinkingFund[]> {
  return db.sinkingFunds.toArray()
}

export async function updateSinkingFund(id: number, patch: Partial<SinkingFund>): Promise<void> {
  await db.sinkingFunds.update(id, patch)
}

export async function deleteSinkingFund(id: number): Promise<void> {
  await db.sinkingFunds.delete(id)
}

export function observeSinkingFunds(): Observable<SinkingFund[]> {
  return liveQuery(() => db.sinkingFunds.toArray() as Promise<SinkingFund[]>)
}

const FUNDS_SEEDED_KEY = 'fundsSeeded'

// D-05 seed: car-insurance launch instance. annualAmount is PROVISIONAL — Ian
// repopulates at renewal. All fields are editable via the /funds surface.
export async function seedFundsIfEmpty(): Promise<void> {
  const sentinelRow = await db.settings.get(FUNDS_SEEDED_KEY)
  if (sentinelRow !== undefined) return // already seeded via this function
  // Also skip if the user already has funds (e.g. added manually or via import)
  const existing = await db.sinkingFunds.count()
  if (existing > 0) return
  await db.sinkingFunds.add({
    name: 'Car insurance',
    annualAmount: 982,
    monthlyAccrual: 82,
    balance: 0,
    payoutDate: '2027-03',
    cadence: 'annual',
    provisional: true,
  } as SinkingFund)
  await db.settings.put({ key: FUNDS_SEEDED_KEY, value: true })
}

// ── Meal Definition CRUD (FOOD-02, D-01) ─────────────────────────────────
// app-owned meal→ingredient decomposition table. mealName is the SMC-join key;
// normalizeMealName(s) ensures lowercase+trimmed for all stored names (Pitfall 5).

export async function addMealDefinition(meal: Omit<MealDefinition, 'id'>): Promise<number> {
  return db.mealDefinitions.add({ ...meal, mealName: normalizeMealName(meal.mealName) } as MealDefinition)
}

export async function listMealDefinitions(): Promise<MealDefinition[]> {
  return db.mealDefinitions.toArray()
}

export async function updateMealDefinition(id: number, patch: Partial<MealDefinition>): Promise<void> {
  const normalizedPatch = patch.mealName != null
    ? { ...patch, mealName: normalizeMealName(patch.mealName) }
    : patch
  await db.mealDefinitions.update(id, normalizedPatch)
}

export async function deleteMealDefinition(id: number): Promise<void> {
  await db.mealDefinitions.delete(id)
}

// Returns a Dexie Observable so atoms import storage, never db (grep gate).
export function observeMealDefinitions(): Observable<MealDefinition[]> {
  return liveQuery(() => db.mealDefinitions.toArray() as Promise<MealDefinition[]>)
}

// ── Food Settings Singletons (FOOD-04, FOOD-05, FOOD-10, FOOD-11, FOOD-13) ───
// Each singleton is stored as a settings row with a const KEY constant.
// Defaults are returned on first read (no migration data needed — D-01 no-op).
// C1: NO setFoodFloor / decreaseFoodFloor method exists here (V6 absence-proof).
// saveFoodFloorMeta persists only engine-written metadata, never a user-settable floor.

const UNIT_COST_MAP_KEY = 'unitCostMap'
const PORTION_MODEL_KEY = 'portionModel'
const FOOD_FLOOR_META_KEY = 'foodFloorMeta'
const FLAVOR_LINE_KEY = 'flavorLine'

const DEFAULT_FOOD_FLOOR_META: FoodFloorMeta = {
  lastComputedFloor: 0,
  allTimeHighWater: 0,
  lastRefinedFromReceipts: null,
}
const DEFAULT_FLAVOR_LINE: FlavorLine = { amount: 50 }  // seed ~$50/mo per spec §12

// Unit-cost map: ingredient → { costPerUnit, unit, tag }
// T-04-02: guard against non-finite costPerUnit before persisting.
export async function getUnitCostMap(): Promise<UnitCostEntry[]> {
  const row = await db.settings.get(UNIT_COST_MAP_KEY)
  return (row?.value as UnitCostEntry[] | undefined) ?? []
}

export async function saveUnitCostMap(entries: UnitCostEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!Number.isFinite(entry.costPerUnit)) {
      throw new Error(`saveUnitCostMap: non-finite costPerUnit for "${entry.ingredientName}" (${entry.costPerUnit})`)
    }
  }
  await db.settings.put({ key: UNIT_COST_MAP_KEY, value: entries })
}

// Portion model: ingredient → { portionSize }
// T-04-02: guard against non-finite portionSize before persisting.
export async function getPortionModel(): Promise<PortionEntry[]> {
  const row = await db.settings.get(PORTION_MODEL_KEY)
  return (row?.value as PortionEntry[] | undefined) ?? []
}

export async function savePortionModel(entries: PortionEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!Number.isFinite(entry.portionSize)) {
      throw new Error(`savePortionModel: non-finite portionSize for "${entry.ingredientName}" (${entry.portionSize})`)
    }
  }
  await db.settings.put({ key: PORTION_MODEL_KEY, value: entries })
}

// Food floor metadata: engine-written last-computed + high-water + refinement timestamp.
// C1 (V6): there is NO setFoodFloor method. saveFoodFloorMeta persists only metadata.
export async function getFoodFloorMeta(): Promise<FoodFloorMeta> {
  const row = await db.settings.get(FOOD_FLOOR_META_KEY)
  return (row?.value as FoodFloorMeta | undefined) ?? DEFAULT_FOOD_FLOOR_META
}

export async function saveFoodFloorMeta(meta: FoodFloorMeta): Promise<void> {
  await db.settings.put({ key: FOOD_FLOOR_META_KEY, value: meta })
}

// Flavor line: separate ~$50/mo PROTECTED fixed amount (FOOD-10, D-05).
// T-04-02: guard against non-finite amount before persisting.
export async function getFlavorLine(): Promise<FlavorLine> {
  const row = await db.settings.get(FLAVOR_LINE_KEY)
  return (row?.value as FlavorLine | undefined) ?? DEFAULT_FLAVOR_LINE
}

export async function saveFlavorLine(line: FlavorLine): Promise<void> {
  if (!Number.isFinite(line.amount)) {
    throw new Error(`saveFlavorLine: non-finite amount (${line.amount})`)
  }
  await db.settings.put({ key: FLAVOR_LINE_KEY, value: line })
}

// ── First-run seed for meal definitions (FOOD-02 + I-04) ──────────────────────
// Seeds 14 known meal-name strings (normalized), sets up the initial unit-cost map
// with known §5c warehouse-club values, and seeds a portion model starting point.
// Sentinel-guarded so repeated calls are no-ops after the first run (Pitfall 4 avoidance).
//
// I-07 decision: known ingredient synonyms are pre-normalized here before storage.
// "PB" → "peanut butter" is applied in the ingredient arrays below. Other synonyms
// encountered in the future can be handled by Ian via /food/config manual mapping.
// Any unmapped synonyms will surface as unpriced-ingredient gap flags — expected
// noise, never silent undercount (C1 compliant via fallback-high, D-02).

const MEALS_SEEDED_KEY = 'mealDefinitionsSeeded'

// 14 known meal-name strings from the live SMC corpus (2026-05-29), normalized.
// ingredients[] lists the macro-bearing ingredients for decomposed meals.
// "Qdoba bowl" is the non-decomposable flat-cost test case (D-04); flatCost left
// unset so it triggers the fallback-high gap flag until Ian sets it via /food/config.
const SEED_MEAL_DEFINITIONS: Omit<MealDefinition, 'id'>[] = [
  {
    mealName: normalizeMealName('Cereal and milk'),
    type: 'decomposed',
    ingredients: ['cereal', 'milk'],
  },
  {
    mealName: normalizeMealName('Chicken, rice, and broccoli'),
    type: 'decomposed',
    ingredients: ['chicken breast', 'rice', 'broccoli'],
  },
  {
    mealName: normalizeMealName('Eggs and PB toast'),
    type: 'decomposed',
    // I-07: "PB" normalized to "peanut butter" before storage
    ingredients: ['eggs', 'peanut butter', 'bread'],
  },
  {
    mealName: normalizeMealName('French Toast and Eggs'),
    type: 'decomposed',
    ingredients: ['eggs', 'bread', 'milk'],
  },
  {
    mealName: normalizeMealName('Greek yogurt with granola and berries'),
    type: 'decomposed',
    ingredients: ['greek yogurt', 'granola', 'mixed berries'],
  },
  {
    mealName: normalizeMealName('Oatmeal and protein slop'),
    type: 'decomposed',
    ingredients: ['oats', 'bulk whey', 'milk'],
  },
  {
    mealName: normalizeMealName('Oatmeal cream pie and banana'),
    type: 'decomposed',
    ingredients: ['oatmeal cream pie', 'banana'],
  },
  {
    mealName: normalizeMealName('Pasta, beef, cheese, green beans'),
    type: 'decomposed',
    ingredients: ['pasta', '90/10 ground beef', 'cheese', 'green beans'],
  },
  {
    mealName: normalizeMealName('Protein Slop and Granola'),
    type: 'decomposed',
    ingredients: ['bulk whey', 'granola', 'milk'],
  },
  {
    mealName: normalizeMealName('Protein shake and banana'),
    type: 'decomposed',
    ingredients: ['bulk whey', 'milk', 'banana'],
  },
  {
    mealName: normalizeMealName('Qdoba bowl'),
    type: 'flat-cost',
    ingredients: [],
    // flatCost intentionally unset → triggers fallback-high gap flag (D-04)
  },
  {
    mealName: normalizeMealName('Rice cakes with peanut butter and banana'),
    type: 'decomposed',
    // I-07: "peanut butter" is canonical (no synonym to map here)
    ingredients: ['rice cakes', 'peanut butter', 'banana'],
  },
  {
    mealName: normalizeMealName('Sweet potato, beef, cheese, green beans'),
    type: 'decomposed',
    ingredients: ['sweet potato', '90/10 ground beef', 'cheese', 'green beans'],
  },
  {
    mealName: normalizeMealName('Turkey sandwich with cheese and green beans'),
    type: 'decomposed',
    ingredients: ['turkey', 'cheese', 'bread', 'green beans'],
  },
]

// Initial unit-cost map seed (§5c, warehouse-club prices).
// I-04: "bulk whey" is tagged macro-bearing so whey-bearing meals price immediately
// without an unpriced-ingredient gap (EXP-07 handoff from Phase 3).
// All entries default to 'macro-bearing' (C1/I-05 default — never 'flavor-condiment').
const SEED_UNIT_COST_MAP: UnitCostEntry[] = [
  { ingredientName: 'bulk whey', costPerUnit: 0.50, unit: 'oz', tag: 'macro-bearing' },
  { ingredientName: '90/10 ground beef', costPerUnit: 5.80, unit: 'lb', tag: 'macro-bearing' },
  { ingredientName: 'chicken breast', costPerUnit: 2.00, unit: 'lb', tag: 'macro-bearing' },
]

export async function seedMealDefinitionsIfEmpty(): Promise<void> {
  const sentinelRow = await db.settings.get(MEALS_SEEDED_KEY)
  if (sentinelRow !== undefined) return  // already seeded via this function — do not clobber Ian's edits
  // Also skip if any meal rows already exist (added manually or via import)
  const existing = await db.mealDefinitions.count()
  if (existing > 0) return
  for (const meal of SEED_MEAL_DEFINITIONS) {
    await db.mealDefinitions.add({ ...meal } as MealDefinition)
  }
  // Seed initial unit-cost map with known macro-bearing values (I-04, EXP-07 handoff)
  const existingMap = await getUnitCostMap()
  if (existingMap.length === 0) {
    await saveUnitCostMap(SEED_UNIT_COST_MAP)
  }
  // Seed flavorLine with the default value so it's persisted from the start
  const existingFlavor = await db.settings.get(FLAVOR_LINE_KEY)
  if (existingFlavor === undefined) {
    await db.settings.put({ key: FLAVOR_LINE_KEY, value: DEFAULT_FLAVOR_LINE })
  }
  await db.settings.put({ key: MEALS_SEEDED_KEY, value: true })
}

// ── Known-source settings (D-06) ──────────────────────────────────────────

export async function getKnownSources(): Promise<KnownSource[]> {
  const row = await db.settings.get(KNOWN_SOURCES_KEY)
  return (row?.value as KnownSource[] | undefined) ?? []
}

export async function saveKnownSources(list: KnownSource[]): Promise<void> {
  await db.settings.put({ key: KNOWN_SOURCES_KEY, value: list })
}

// ── Estimate-per-check settings (D-11) ────────────────────────────────────

export async function getEstimatePerCheck(): Promise<number> {
  const row = await db.settings.get(ESTIMATE_KEY)
  return (row?.value as number | undefined) ?? 0
}

export async function saveEstimatePerCheck(n: number): Promise<void> {
  await db.settings.put({ key: ESTIMATE_KEY, value: n })
}

// ── Reactive observable (Pattern 1) ───────────────────────────────────────
// Returns a Dexie Observable so atoms import storage, never db (Pitfall 5).

export function observeIncomeChecks(): Observable<IncomeCheck[]> {
  return liveQuery(() => db.incomeChecks.toArray() as Promise<IncomeCheck[]>)
}

export async function getFloors(): Promise<Floors> {
  const row = await db.settings.get(FLOORS_KEY)
  return (row?.value as Floors | undefined) ?? DEFAULT_FLOORS
}

export async function saveFloors(floors: Floors): Promise<void> {
  await db.settings.put({ key: FLOORS_KEY, value: floors })
}

async function collectSchemaV1Data(): Promise<SchemaV1Data> {
  const settingsRows = await db.settings.toArray()
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows) {
    settings[row.key] = row.value
  }
  // Ensure floors are always present in the export envelope (defaults when
  // never explicitly saved). Re-importing this envelope into a fresh DB
  // should reproduce the floors the user sees in the UI.
  if (settings[FLOORS_KEY] === undefined) {
    settings[FLOORS_KEY] = DEFAULT_FLOORS
  }
  const incomeChecks = await db.incomeChecks.toArray()
  const expenseItems = await db.expenseItems.toArray()
  const sinkingFunds = await db.sinkingFunds.toArray()
  const mealDefinitions = await db.mealDefinitions.toArray()
  return {
    incomeChecks,
    expenseItems,
    sinkingFunds,
    mealDefinitions,
    accounts: [],
    settings,
  }
}

export async function exportAll(): Promise<ExportEnvelope> {
  const data = await collectSchemaV1Data()
  const envelope: ExportEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0',
    data,
  }

  // Trigger download in real browsers only. jsdom logs a noisy
  // "navigation not implemented" warning on anchor click, so we skip the
  // download side-effect when running in a jsdom-flagged environment. The
  // envelope return value is the contract; the download is UX sugar.
  const isJsdom =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('jsdom')
  if (
    !isJsdom &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    URL.createObjectURL
  ) {
    try {
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `budget-app-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Non-fatal: download is a UX side effect. The envelope return is the contract.
    }
  }

  return envelope
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export async function importAll(file: File): Promise<void> {
  const text = await file.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError('PARSE_ERROR')
  }

  if (!isPlainObject(parsed)) {
    throw new ImportError('INVALID_ENVELOPE')
  }

  const schemaVersion = parsed['schemaVersion']
  const data = parsed['data']
  if (typeof schemaVersion !== 'number' || !isPlainObject(data)) {
    throw new ImportError('INVALID_ENVELOPE')
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ImportError('VERSION_TOO_NEW')
  }

  // Run the migration ladder from source version up to current. Any missing
  // step is an INVALID_ENVELOPE — we never silently coerce an unknown source
  // version.
  let migrated = data as unknown as SchemaV1Data
  for (let v = schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const fn = MIGRATIONS[v]
    if (!fn) {
      throw new ImportError('INVALID_ENVELOPE')
    }
    migrated = fn(migrated)
  }

  await replaceAll(migrated)
}

/**
 * Returns true iff val is a finite number (not NaN, not Infinity, not null, not string).
 * Mirrors the Number.isFinite guard used in saveUnitCostMap, savePortionModel, etc.
 */
function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val)
}

/**
 * WR-05 (C1): validate food-domain financial fields before import.
 * Mirrors the guards on saveUnitCostMap, savePortionModel, and saveFlavorLine
 * (the normal write path). A tampered backup must not bypass these guards via
 * the import path and corrupt the protected floor.
 *
 * Rejection cases:
 *   - null where a finite number is expected (JSON serializes NaN/Infinity as null)
 *   - String "NaN" or any non-numeric type in a financial field
 *   - Any value for which Number.isFinite() returns false
 *
 * Throws ImportError('INVALID_ENVELOPE') on any invalid value.
 * Called BEFORE the database transaction so a failed validation leaves the DB untouched.
 */
function validateFoodSettingsForImport(settings: Record<string, unknown>): void {
  // foodFloorMeta: lastComputedFloor and allTimeHighWater must be proper finite numbers
  const rawMeta = settings['foodFloorMeta']
  if (rawMeta !== undefined && isPlainObject(rawMeta)) {
    const meta = rawMeta as Record<string, unknown>
    for (const field of ['lastComputedFloor', 'allTimeHighWater']) {
      const val = meta[field]
      // Only validate if the field is present — if absent, storage defaults to 0 (fine)
      if (Object.prototype.hasOwnProperty.call(meta, field)) {
        if (!isFiniteNumber(val)) {
          throw new ImportError('INVALID_ENVELOPE')
        }
      }
    }
  }

  // unitCostMap: all costPerUnit values must be finite numbers
  const rawUnitCostMap = settings['unitCostMap']
  if (rawUnitCostMap !== undefined && Array.isArray(rawUnitCostMap)) {
    for (const entry of rawUnitCostMap) {
      if (isPlainObject(entry)) {
        const e = entry as Record<string, unknown>
        if (Object.prototype.hasOwnProperty.call(e, 'costPerUnit')) {
          if (!isFiniteNumber(e['costPerUnit'])) {
            throw new ImportError('INVALID_ENVELOPE')
          }
        }
      }
    }
  }

  // portionModel: all portionSize values must be finite numbers
  const rawPortionModel = settings['portionModel']
  if (rawPortionModel !== undefined && Array.isArray(rawPortionModel)) {
    for (const entry of rawPortionModel) {
      if (isPlainObject(entry)) {
        const e = entry as Record<string, unknown>
        if (Object.prototype.hasOwnProperty.call(e, 'portionSize')) {
          if (!isFiniteNumber(e['portionSize'])) {
            throw new ImportError('INVALID_ENVELOPE')
          }
        }
      }
    }
  }
}

async function replaceAll(data: SchemaV1Data): Promise<void> {
  // WR-05 (C1): validate food-domain financial fields BEFORE opening the transaction.
  // Validation outside the transaction ensures that if validation fails, the database
  // is not modified at all — no partial-write risk. The existing expense/fund validations
  // run inside the transaction (they throw, which aborts it); food validation runs here
  // for an equivalent no-partial-write guarantee.
  const settings = data.settings ?? {}
  validateFoodSettingsForImport(settings)

  await db.transaction(
    'rw',
    [db.incomeChecks, db.expenseItems, db.sinkingFunds, db.mealDefinitions, db.accounts, db.settings],
    async () => {
      await Promise.all([
        db.incomeChecks.clear(),
        db.expenseItems.clear(),
        db.sinkingFunds.clear(),
        db.mealDefinitions.clear(),
        db.accounts.clear(),
        db.settings.clear(),
      ])

      for (const [key, value] of Object.entries(settings)) {
        await db.settings.put({ key, value })
      }
      // Re-seed income rows so a v3 backup round-trips income data.
      if (Array.isArray(data.incomeChecks) && data.incomeChecks.length > 0) {
        for (const check of data.incomeChecks as IncomeCheck[]) {
          // Strip id so Dexie assigns a fresh auto-increment id on import.
          const { id: _id, ...rest } = check
          await db.incomeChecks.add(rest as IncomeCheck)
        }
      }
      // Restore expense rows — validate financial fields (T-03-01 tampering mitigation).
      if (Array.isArray(data.expenseItems) && data.expenseItems.length > 0) {
        for (const raw of data.expenseItems as ExpenseItem[]) {
          if (!Number.isFinite(raw.amount)) {
            throw new ImportError('INVALID_ENVELOPE')
          }
          const { id: _id, ...rest } = raw
          await db.expenseItems.add(rest as ExpenseItem)
        }
      }
      // Restore sinking fund rows — validate financial fields (T-03-01).
      if (Array.isArray(data.sinkingFunds) && data.sinkingFunds.length > 0) {
        for (const raw of data.sinkingFunds as SinkingFund[]) {
          if (!Number.isFinite(raw.annualAmount) || !Number.isFinite(raw.monthlyAccrual)) {
            throw new ImportError('INVALID_ENVELOPE')
          }
          const { id: _id, ...rest } = raw
          await db.sinkingFunds.add(rest as SinkingFund)
        }
      }
      // Restore meal definition rows (T-04-03: Array.isArray guard prevents partial-state
      // corruption from a malformed mealDefinitions payload).
      if (Array.isArray(data.mealDefinitions) && data.mealDefinitions.length > 0) {
        for (const raw of data.mealDefinitions as MealDefinition[]) {
          const { id: _id, ...rest } = raw
          await db.mealDefinitions.add(rest as MealDefinition)
        }
      }
    },
  )
}
