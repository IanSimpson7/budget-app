# Phase 4: Food Contract (Locked Floor) — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domains/food/food.types.ts` | model | — | `src/storage/schema.ts` | role-match |
| `src/domains/food/food.atoms.ts` | store | event-driven | `src/domains/income/income.atoms.ts` | exact |
| `src/domains/food/planParser.ts` | utility | transform | `src/domains/income/parser/parseStatement.ts` | role-match |
| `src/domains/food/costEngine.ts` | utility | transform | `src/domains/funds/funds.atoms.ts` (`fundStatus`) | role-match |
| `src/pages/FoodPage.tsx` | component | request-response | `src/pages/ExpensesPage.tsx` | exact |
| `src/pages/FoodConfigPage.tsx` | component | request-response | `src/pages/FundsPage.tsx` | exact |
| `src/storage/schema.ts` | model | — | self (bump + extend) | exact |
| `src/storage/db.ts` | config | — | self (add v4 block) | exact |
| `src/storage/migrations.ts` | utility | transform | self (`migrate_2_to_3`) | exact |
| `src/storage/storage.ts` | service | CRUD | self (expense/fund CRUD sections) | exact |
| `src/domains/expenses/expenses.atoms.ts` | store | event-driven | self (`survivalFloorAtom` edit) | exact |
| `src/App.tsx` | config | — | self (add routes) | exact |

---

## Pattern Assignments

### `src/domains/food/food.types.ts` (model)

**Analog:** `src/storage/schema.ts`

**Type declaration pattern** (schema.ts lines 8–46):
```typescript
// Pure types + constants. NO Dexie imports here.
export type MealType = 'decomposed' | 'flat-cost'
export type IngredientTag = 'macro-bearing' | 'flavor-condiment'

export type MealDefinition = Readonly<{
  id?: number
  mealName: string          // normalized: lowercase, trimmed — key for SMC join
  type: MealType
  ingredients: string[]     // macro-bearing ingredient names; empty for flat-cost meals
  flatCost?: number         // required when type === 'flat-cost'; unset → fallback-high
}>

export type UnitCostEntry = Readonly<{
  ingredientName: string    // key matches MealDefinition.ingredients[]
  costPerUnit: number       // $/unit; 0 treated as unpriced → fallback-high
  unit: string              // 'lb', 'oz', 'each', etc.
  tag: IngredientTag
}>

export type PortionEntry = Readonly<{
  ingredientName: string    // same key space as UnitCostEntry
  portionSize: number       // in same unit as UnitCostEntry.unit
}>

export type FoodFloorMeta = Readonly<{
  lastComputedFloor: number
  allTimeHighWater: number
  lastRefinedFromReceipts: string | null  // ISO datetime or null
}>

export type FlavorLine = Readonly<{
  amount: number    // monthly protected flavor/condiment budget
}>
```

**Readonly + discriminated union pattern** mirrors `ExpenseItem`, `SinkingFund` in schema.ts. Every type uses `Readonly<{...}>`. Optional fields use `?` not `| undefined` (except where undefined is semantically meaningful).

---

### `src/domains/food/food.atoms.ts` (store, event-driven)

**Analog:** `src/domains/income/income.atoms.ts`

**Imports pattern** (income.atoms.ts lines 13–18):
```typescript
import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import { floorsLoadAtom } from '../settings/settings.atoms'
```

For food.atoms.ts, the import direction must be:
```typescript
import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import { floorsLoadAtom } from '../settings/settings.atoms'
import { parsePlanFile } from './planParser'
import { computeFloor } from './costEngine'
import type { MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta, FoodFloorResult } from './food.types'
// NOTE: expenses.atoms.ts imports FROM food.atoms.ts — never reverse this direction
// (Pitfall 4: circular import risk)
```

**Source atom with liveQuery** (income.atoms.ts lines 25–28):
```typescript
export const incomeChecksAtom = atomWithObservable<IncomeCheck[]>(
  () => storage.observeIncomeChecks(),
  { initialValue: [] },
)
```
Apply to `mealDefinitionsAtom`:
```typescript
// liveQuery table atom — no refreshCounter; liveQuery re-emits on IDB write
export const mealDefinitionsAtom = atomWithObservable<MealDefinition[]>(
  () => storage.observeMealDefinitions(),
  { initialValue: [] },
)
```

**Settings singleton with refreshCounter** (settings.atoms.ts lines 20–27):
```typescript
const refreshCounterAtom = atom(0)
export const floorsLoadAtom = atom(async (get): Promise<Floors> => {
  get(refreshCounterAtom)
  return storage.getFloors()
})
```
Apply to unitCostMap, portionModel, foodFloorMeta, flavorLine — each gets its own internal refreshCounter. Pattern: plain async atom that reads a counter dependency, then calls storage.get*(). Write atoms bump the counter. Do NOT use refreshCounter for mealDefinitionsAtom (liveQuery handles it).

**Glob-based async atom** (RESEARCH.md Pattern 1 — no existing analog in codebase, use research pattern):
```typescript
const RAW_PLAN_GLOB = import.meta.glob(
  '../../../schedule-meal-coordinator/plans/*.md',
  { as: 'raw', eager: false }
) as Record<string, () => Promise<string>>

export const parsedPlansAtom = atom(async (): Promise<ParsedPlan[]> => {
  const entries = Object.entries(RAW_PLAN_GLOB)
  const results = await Promise.all(
    entries.map(async ([path, loader]) => {
      const raw = await loader()
      const filename = path.split('/').pop() ?? ''
      return parsePlanFile(filename, raw)
    })
  )
  return results.filter((p): p is ParsedPlan => p !== null)
})
```

**Derived async atom** (income.atoms.ts lines 84–89 — projectedMonthPayrollAtom pattern):
```typescript
export const projectedMonthPayrollAtom = atom(async (get): Promise<number> => {
  const landed = get(landedPayrollCountAtom)
  const mtdPayroll = get(mtdPayrollAtom)
  const estimate = await get(estimatePerCheckAtom)
  return mtdPayroll + Math.max(0, 2 - landed) * estimate
})
```
Apply the same `atom(async (get)` shape to `foodFloorAtom` — mixes sync gets (mealDefinitionsAtom) with async awaits (parsedPlansAtom, unitCostMapAtom, etc.).

**Write-only atom** (income.atoms.ts lines 143–147):
```typescript
export const saveIncomeCheckAtom = atom(
  null,
  async (_get, _set, check: Omit<IncomeCheck, 'id'>): Promise<void> => {
    await storage.addIncomeCheck(check)
  },
)
```
Apply to saveMealDefinitionAtom, updateMealDefinitionAtom, deleteMealDefinitionAtom, saveUnitCostMapAtom, savePortionModelAtom, saveFlavorLineAtom. Write atoms that update liveQuery-backed tables do NOT bump a refresh counter.

**File-level comment block convention** (income.atoms.ts lines 1–12):
```typescript
// [Domain] — reactive Jotai atom chain.
//
// Source atom: atomWithObservable over storage.observe[Domain]().
//   initialValue:[] sidesteps the React 19 re-suspense bug (Pitfall 1, RESEARCH.md).
//
// Derived atoms: pure, read-only, NEVER persisted (FOUND-06).
//
// Boundary: this file imports `storage` (the public abstraction), NEVER `db`.
```

---

### `src/domains/food/planParser.ts` (utility, transform)

**Analog:** `src/domains/income/classify.ts` + `src/domains/income/parser/parseStatement.ts` (pure-function + colocated-test convention)

**Pure function export pattern** (funds.atoms.ts lines 38–52, pure `monthsUntilPayout` / `fundStatus` functions):
```typescript
// No imports except types. No Dexie, no storage, no React.
export interface ParsedPlan {
  windowStart: string   // YYYY-MM-DD
  windowEnd: string     // YYYY-MM-DD
  meals: string[]       // normalized: lowercase, trimmed
}

export function parsePlanFile(filename: string, raw: string): ParsedPlan | null {
  // returns null on parse failure — caller filters with (p): p is ParsedPlan => p !== null
}
```

**Colocated test file:** `src/domains/food/planParser.test.ts` (mirrors `src/domains/income/classify.test.ts` which sits next to `classify.ts`).

**Test scaffold pattern** (classify.test.ts lines 1–9):
```typescript
import { describe, it, expect } from 'vitest'
// No beforeEach, no Dexie — pure function tests need no DB reset
import { parsePlanFile } from './planParser'
```

---

### `src/domains/food/costEngine.ts` (utility, transform)

**Analog:** `src/domains/funds/funds.atoms.ts` (`fundStatus`, `isOnTrack` — pure synchronous logic exported from a domain file)

**Pure function pattern** (funds.atoms.ts lines 54–79):
```typescript
export type FundStatus = 'on-track' | 'behind' | 'overdue'

export function fundStatus(fund: SinkingFund): FundStatus {
  const funded = fund.balance >= fund.annualAmount
  if (funded) return 'on-track'
  if (payoutMonthsDelta(fund.payoutDate) < 0) return 'overdue'
  if (fund.monthlyAccrual * 12 >= fund.annualAmount) return 'on-track'
  return 'behind'
}
```

For costEngine.ts, apply the same no-imports-except-types discipline:
```typescript
// No Dexie, no storage, no React, no jotai.
// Takes all inputs as plain data; returns result + gap list.
// This enables testing without fake-indexeddb.
import type { MealDefinition, UnitCostEntry, PortionEntry, FloorGap, CostEngineResult } from './food.types'

export function computeFloor(input: CostEngineInput): CostEngineResult { ... }
export function isPlanCurrent(plans: ParsedPlan[], today: string): boolean { ... }
```

**Colocated test file:** `src/domains/food/costEngine.test.ts` (same directory, same import style as classify.test.ts).

---

### `src/pages/FoodPage.tsx` (component, request-response)

**Analog:** `src/pages/ExpensesPage.tsx`

**Imports pattern** (ExpensesPage.tsx lines 7–24):
```typescript
import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  protectedExpensesAtom,
  gateableExpensesAtom,
  saveExpenseItemAtom,
  // ...
} from '../domains/expenses/expenses.atoms'
import type { ExpenseItem, Classification, Cadence } from '../storage/schema'
import TextInput from '../components/TextInput'
import NumberInput from '../components/NumberInput'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import DestructiveButton from '../components/DestructiveButton'
```

**Page scaffold pattern** (ExpensesPage.tsx lines 183–213):
```typescript
export default function FoodPage() {
  // useAtomValue for derived/read atoms; useSetAtom for write-only atoms
  const foodFloor = useAtomValue(foodFloorAtom)
  // ...
  return (
    <div className="flex flex-col gap-sp-6 max-w-[640px] mx-auto">
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Food</h2>
      {/* sections */}
    </div>
  )
}
```

**Read-only derived value display** (no `<input>` on the floor line — D-09/FOOD-12):
```tsx
// Mirrors how DashboardPage renders MetricCard values — span, not input
// Lock icon from lucide-react always visible beside the floor number
<span className="font-mono text-[20px] text-text-primary">
  {currency.format(foodFloor.floor)}
</span>
// NO <input>, NO edit pencil, NO onClick that opens an edit form on this value
```

**Currency formatter** (ExpensesPage.tsx line 25):
```typescript
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
```
Copy this verbatim into FoodPage.tsx and FoodConfigPage.tsx.

**Badge / status pattern:** No existing badge component — build inline using Tailwind tokens. Amber = `bg-amber-100 text-amber-800` (or project token equivalents from tailwind.config.ts). Green = `bg-green-100 text-green-800`. Confirm token names against tailwind.config.ts before using.

**Two-column layout** (ExpensesPage.tsx lines 255–267):
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-4">
  {/* locked floor column | discretionary column */}
</div>
```

---

### `src/pages/FoodConfigPage.tsx` (component, request-response)

**Analog:** `src/pages/FundsPage.tsx`

**Table-like form for editable rows** (FundsPage.tsx lines 44–134, EditForm pattern):
```typescript
function EditRow({ item, onDone }: EditRowProps) {
  const updateFn = useSetAtom(updateAtom)
  const [field, setField] = useState(item.field)
  const canSave = /* validation */
  async function handleSave() {
    if (!canSave || item.id == null) return
    await updateFn({ id: item.id, patch: { field } })
    onDone()
  }
  return (
    <div className="bg-surface-raised border border-accent rounded-sm p-sp-3 flex flex-col gap-sp-3">
      <NumberInput id={...} label={...} value={field} onChange={setField} />
      <div className="flex gap-sp-2">
        <PrimaryButton onClick={() => void handleSave()} disabled={!canSave}>Save</PrimaryButton>
        <SecondaryButton onClick={onDone}>Cancel</SecondaryButton>
      </div>
    </div>
  )
}
```

**NumberInput guard** (storage.ts lines 71–75, T-03-02 — copy this guard for all food numeric inputs):
```typescript
if (!Number.isFinite(item.amount)) {
  throw new Error(`addExpenseItem: non-finite amount (${item.amount})`)
}
```
Apply in: `saveUnitCostEntry`, `savePortionEntry`, `saveFlavorLine` in storage.ts.

**Page empty state** (FundsPage.tsx lines 258–271):
```tsx
{isEmpty ? (
  <div className="flex flex-col gap-sp-2">
    <p className="font-sans text-sm font-semibold text-text-primary">No meals defined yet</p>
    <p className="font-sans text-sm text-text-secondary">...</p>
  </div>
) : (
  <div className="flex flex-col gap-sp-4">{/* rows */}</div>
)}
```

**Seed sentinel pattern** (storage.ts lines 96–121, `EXPENSES_SEEDED_KEY`):
```typescript
const MEALS_SEEDED_KEY = 'mealDefinitionsSeeded'

export async function seedMealDefinitionsIfEmpty(): Promise<void> {
  const sentinelRow = await db.settings.get(MEALS_SEEDED_KEY)
  if (sentinelRow !== undefined) return
  // seed 14 known meal-name strings
  await db.settings.put({ key: MEALS_SEEDED_KEY, value: true })
}
```

---

### `src/storage/schema.ts` (model — bump + extend)

**Analog:** self (lines 1–104, read in full above)

**CURRENT_SCHEMA_VERSION bump** (schema.ts line 6):
```typescript
// Before:
export const CURRENT_SCHEMA_VERSION = 3 as const
// After:
export const CURRENT_SCHEMA_VERSION = 4 as const
```

**SchemaV1Data extension** (schema.ts lines 82–88):
```typescript
// Before:
export type SchemaV1Data = {
  incomeChecks: unknown[]
  expenseItems: unknown[]
  sinkingFunds: unknown[]
  accounts: unknown[]
  settings: Record<string, unknown>
}
// After — add mealDefinitions:
export type SchemaV1Data = {
  incomeChecks: unknown[]
  expenseItems: unknown[]
  sinkingFunds: unknown[]
  mealDefinitions: unknown[]   // ← add
  accounts: unknown[]
  settings: Record<string, unknown>
}
```

**Floors type** (schema.ts lines 8–14): `foodSeed` field on `Floors` remains — it is the CLI-editable seed that Phase 4's `foodFloorAtom` supersedes as the computed-floor term in `survivalFloorAtom`. The field is NOT removed from `Floors` in Phase 4 (backward compat for the settings record and JSON exports).

---

### `src/storage/db.ts` (config — add v4 block)

**Analog:** self (lines 1–59, read in full above)

**Version block pattern** (db.ts lines 38–48, v3 block):
```typescript
this.version(3).stores({
  incomeChecks: '++id, date, source',
  expenseItems: '++id, name, classification, cadence',
  sinkingFunds: '++id, name, payoutDate',
  accounts: '++id, type',
  settings: '&key',
})
```

**v4 block to add** — new `mealDefinitions` table; settings table unchanged (new keys are stored inline, no new Dexie table needed for settings singletons):
```typescript
// v4: food domain — mealDefinitions table added.
// unitCostMap, portionModel, foodFloorMeta, flavorLine stored as settings keys
// (existing '&key' settings table covers them — no new table needed).
// migrate_3_to_4 is a data no-op: new table is empty; existing data untouched.
this.version(4).stores({
  incomeChecks: '++id, date, source',
  expenseItems: '++id, name, classification, cadence',
  sinkingFunds: '++id, name, payoutDate',
  mealDefinitions: '++id, mealName',    // ← add; indexed by mealName for join
  accounts: '++id, type',
  settings: '&key',
})
```

**Class property declaration** (db.ts lines 8–12):
```typescript
// Add to BudgetDatabase class body:
mealDefinitions!: Table<MealDefinition, number>
```
And import `MealDefinition` from schema.ts.

**versionchange handler** (db.ts lines 53–55): copy verbatim — no change needed.

---

### `src/storage/migrations.ts` (utility — add migrate_3_to_4)

**Analog:** self lines 40–53 (`migrate_2_to_3` — the structural no-op pattern)

**Exact v2→v3 no-op pattern to copy** (migrations.ts lines 40–48):
```typescript
export function migrate_2_to_3(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    expenseItems: data.expenseItems ?? [],
    sinkingFunds: data.sinkingFunds ?? [],
  }
}
```

**v3→v4 migration** (data no-op — new mealDefinitions table is empty; settings singletons initialize at first read in storage.ts):
```typescript
export function migrate_3_to_4(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    mealDefinitions: data.mealDefinitions ?? [],
    // unitCostMap, portionModel, foodFloorMeta, flavorLine are settings keys;
    // they initialize with defaults at first storage.get*() call — no migration data needed.
  }
}
```

**MIGRATIONS map extension** (migrations.ts lines 50–53):
```typescript
// Before:
export const MIGRATIONS: Record<number, MigrationFn> = {
  1: migrate_1_to_2,
  2: migrate_2_to_3,
}
// After:
export const MIGRATIONS: Record<number, MigrationFn> = {
  1: migrate_1_to_2,
  2: migrate_2_to_3,
  3: migrate_3_to_4,   // ← add
}
```

**CONTRACT comment** (migrations.ts lines 7–14): the block documents the 4-step process; the planner action should reproduce step 1–4 for v4 compliance.

---

### `src/storage/storage.ts` (service — CRUD additions)

**Analog:** self (expense CRUD section lines 66–121; sinking fund CRUD lines 124–172)

**CRUD method set pattern** (storage.ts lines 71–93, expense CRUD):
```typescript
// Financial-guard pattern — copy for saveMealDefinitionCost, saveUnitCostEntry, etc.
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

export function observeExpenseItems(): Observable<ExpenseItem[]> {
  return liveQuery(() => db.expenseItems.toArray() as Promise<ExpenseItem[]>)
}
```

**Settings singleton get/save pattern** (storage.ts lines 176–194):
```typescript
const KNOWN_SOURCES_KEY = 'knownSources'

export async function getKnownSources(): Promise<KnownSource[]> {
  const row = await db.settings.get(KNOWN_SOURCES_KEY)
  return (row?.value as KnownSource[] | undefined) ?? []
}

export async function saveKnownSources(list: KnownSource[]): Promise<void> {
  await db.settings.put({ key: KNOWN_SOURCES_KEY, value: list })
}
```
Apply for `getUnitCostMap`/`saveUnitCostMap`, `getPortionModel`/`savePortionModel`, `getFoodFloorMeta`/`saveFoodFloorMeta`, `getFlavorLine`/`saveFlavorLine`. Each gets a `const KEY = '...'` constant. Defaults via `?? []` or `?? DEFAULT_VALUE`.

**C1 absence-proof comment** (storage.ts lines 1–7):
```typescript
// Inviolable constraints C1/C2/C3 are STRUCTURALLY enforced by the absence of any
// credential-storage, money-movement, or floor-lowering method on this module's exports.
```
No `setFoodFloor(n: number)` method may exist. No `decreaseFoodFloor`. `saveFoodFloorMeta` persists `{ lastComputedFloor, allTimeHighWater, lastRefinedFromReceipts }` only — these are engine-written metadata, not user-writable floor values.

**collectSchemaV1Data extension** (storage.ts lines 212–234):
```typescript
// Extend to include mealDefinitions in the export envelope
const mealDefinitions = await db.mealDefinitions.toArray()
return {
  incomeChecks,
  expenseItems,
  sinkingFunds,
  mealDefinitions,   // ← add
  accounts: [],
  settings,
}
```

**replaceAll extension** (storage.ts lines 319–366):
```typescript
// Add mealDefinitions to the transaction table list and restore block
await db.transaction(
  'rw',
  [db.incomeChecks, db.expenseItems, db.sinkingFunds, db.mealDefinitions, db.accounts, db.settings],
  async () => {
    await Promise.all([
      db.incomeChecks.clear(),
      db.expenseItems.clear(),
      db.sinkingFunds.clear(),
      db.mealDefinitions.clear(),   // ← add
      db.accounts.clear(),
      db.settings.clear(),
    ])
    // ... existing restore blocks ...
    // Restore meal definitions
    if (Array.isArray(data.mealDefinitions) && data.mealDefinitions.length > 0) {
      for (const raw of data.mealDefinitions as MealDefinition[]) {
        const { id: _id, ...rest } = raw
        await db.mealDefinitions.add(rest as MealDefinition)
      }
    }
  }
)
```

---

### `src/domains/expenses/expenses.atoms.ts` (store — survivalFloorAtom edit)

**Analog:** self (lines 54–59 — the exact current definition)

**Current survivalFloorAtom** (expenses.atoms.ts lines 54–59):
```typescript
export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const floors = await get(floorsLoadAtom)
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + floors.foodSeed   // ← replace floors.foodSeed
})
```

**Phase 4 target** (RESEARCH.md Pattern 7):
```typescript
import { foodFloorAtom } from '../food/food.atoms'   // ← add import

export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const { floor } = await get(foodFloorAtom)         // ← computed floor
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + floor
})
```

**Import direction rule** (Pitfall 4): `food.atoms.ts` → imports from `settings.atoms.ts` only. `expenses.atoms.ts` → imports from `food.atoms.ts`. Never reverse. The `floorsLoadAtom` import already in expenses.atoms.ts line 17 can be removed if `floors.foodSeed` is the only thing it was providing to `survivalFloorAtom` (check if other atoms in the file still need it before removing).

---

### `src/App.tsx` (config — add routes)

**Analog:** self (lines 1–37 — full file read above)

**Route registration pattern** (App.tsx lines 24–33):
```tsx
<Route path="/expenses" element={<ExpensesPage />} />
<Route path="/funds" element={<FundsPage />} />
```

**Add two new routes** in the same block:
```tsx
<Route path="/food" element={<FoodPage />} />
<Route path="/food/config" element={<FoodConfigPage />} />
```

**Import additions** at top of App.tsx:
```typescript
import FoodPage from './pages/FoodPage'
import FoodConfigPage from './pages/FoodConfigPage'
```

**AppShell nav link** (AppShell.tsx lines 27–44) — add after `/funds`:
```tsx
<NavLink to="/food" className={navClasses}>
  Food
</NavLink>
```

---

## Shared Patterns

### atomWithObservable + liveQuery (reactive IDB tables)

**Source:** `src/domains/income/income.atoms.ts` lines 25–28; `src/domains/expenses/expenses.atoms.ts` lines 24–27; `src/domains/funds/funds.atoms.ts` lines 18–21

**Apply to:** `mealDefinitionsAtom` in food.atoms.ts

```typescript
export const mealDefinitionsAtom = atomWithObservable<MealDefinition[]>(
  () => storage.observeMealDefinitions(),
  { initialValue: [] },
)
// initialValue: [] is REQUIRED — prevents React 19 Suspense re-suspension bug
// Do NOT add a refreshCounter — liveQuery re-emits automatically on IDB write
```

### refreshCounter + plain async atom (settings singletons)

**Source:** `src/domains/settings/settings.atoms.ts` lines 20–27

**Apply to:** unitCostMapAtom, portionModelAtom, foodFloorMetaAtom, flavorLineAtom in food.atoms.ts

```typescript
const unitCostRefreshAtom = atom(0)
export const unitCostMapAtom = atom(async (get): Promise<UnitCostEntry[]> => {
  get(unitCostRefreshAtom)
  return storage.getUnitCostMap()
})
export const saveUnitCostMapAtom = atom(null, async (_get, set, map: UnitCostEntry[]): Promise<void> => {
  await storage.saveUnitCostMap(map)
  set(unitCostRefreshAtom, (n) => n + 1)
})
```

### Write-only atom (no first argument)

**Source:** `src/domains/income/income.atoms.ts` lines 143–147

**Apply to:** all save/update/delete atoms in food.atoms.ts

```typescript
export const saveMealDefinitionAtom = atom(
  null,
  async (_get, _set, meal: Omit<MealDefinition, 'id'>): Promise<void> => {
    await storage.addMealDefinition(meal)
  },
)
// Note: null as first arg = write-only (cannot read this atom)
```

### Financial non-finite guard (T-03-02)

**Source:** `src/storage/storage.ts` lines 71–74

**Apply to:** all storage.ts methods that accept numeric financial inputs (unit cost, portion size, flavor line amount)

```typescript
if (!Number.isFinite(value)) {
  throw new Error(`[methodName]: non-finite value (${value})`)
}
```

### Absence-proof test (C1/C2/C3 structural enforcement)

**Source:** `src/test/storage.test.ts` lines 30–46

**Apply to:** add to existing absence-proof block in storage.test.ts

```typescript
// Phase 4 C1 additions
expect(s.setFoodFloor).toBeUndefined()
expect(s.decreaseFoodFloor).toBeUndefined()
// @ts-expect-error — setFoodFloor is structurally absent from storage (C1)
storage.setFoodFloor
```

### Tailwind token conventions

**Source:** `src/pages/ExpensesPage.tsx` throughout; `src/components/NumberInput.tsx`

**Apply to:** all Phase 4 UI files

- Page wrapper: `className="flex flex-col gap-sp-6 max-w-[640px] mx-auto"`
- Page heading: `className="font-display text-[20px] leading-[1.2] text-text-primary"`
- Section subheading: `className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide"`
- Body text: `className="font-sans text-sm text-text-primary"`
- Secondary text: `className="font-sans text-sm text-text-secondary"`
- Financial value: `className="font-mono text-[20px] text-text-primary"` (all dollar amounts)
- All interactive elements: `min-h-[44px]` (tap target floor)
- Card container: `className="bg-surface-raised border border-surface-border rounded-sm p-sp-3"`
- Editing card: `className="bg-surface-raised border border-accent rounded-sm p-sp-3"`
- Button row: `className="flex gap-sp-2"`

### Seed sentinel pattern

**Source:** `src/storage/storage.ts` lines 96–121 (`seedExpensesIfEmpty`)

**Apply to:** `seedMealDefinitionsIfEmpty` in storage.ts for the 14 known meal-name strings + initial unit-cost map and portion model seeds

```typescript
const MEALS_SEEDED_KEY = 'mealDefinitionsSeeded'
export async function seedMealDefinitionsIfEmpty(): Promise<void> {
  const sentinelRow = await db.settings.get(MEALS_SEEDED_KEY)
  if (sentinelRow !== undefined) return
  const existing = await db.mealDefinitions.count()
  if (existing > 0) return
  for (const meal of SEED_MEAL_DEFINITIONS) {
    await db.mealDefinitions.add({ ...meal } as MealDefinition)
  }
  await db.settings.put({ key: MEALS_SEEDED_KEY, value: true })
}
```
Call from `main.tsx` alongside existing seed calls.

### Storage import boundary (grep gate)

**Source:** income.atoms.ts line 15 comment; funds.atoms.ts line 13 comment; all domain atom files

**Apply to:** food.atoms.ts

```typescript
import * as storage from '../../storage/storage'
// NEVER: import { db } from '../../storage/db'
// NEVER: import { liveQuery } from 'dexie' (use storage.observe*() instead)
```

---

## No Analog Found

All files in Phase 4 have close analogs. One capability has no direct codebase precedent:

| File | Capability | Reason |
|------|-----------|--------|
| `src/domains/food/food.atoms.ts` | `import.meta.glob` for external file bundling | No existing atom loads files via Vite glob. The RESEARCH.md Pattern 1 code example is the reference. |
| `src/domains/food/food.atoms.ts` | `parsedPlansAtom` async glob loader | No file-loading atom exists yet. Use RESEARCH.md Pattern 1 verbatim. |

---

## Metadata

**Analog search scope:** `src/domains/`, `src/pages/`, `src/storage/`, `src/components/`, `src/App.tsx`
**Files read:** 15 source files
**Pattern extraction date:** 2026-05-29
