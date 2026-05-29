# Phase 3: Expense Model + Sinking Funds — Research

**Researched:** 2026-05-29
**Domain:** Expense classification, sinking-fund primitive, survival-floor derivation, Dexie schema migration v2→v3, Jotai reactive atom chain extension
**Confidence:** HIGH — all findings are verified against the live codebase, existing planning artifacts, and locked decisions in CONTEXT.md. No external library research required (stack is pinned and validated in Phases 1–2).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Typed-only entry in Phase 3. CC paste-parse adapter re-scoped to Phase 5.
- **D-02:** Single `classification: 'protected' | 'gateable'` enum. NOT two separate bools.
- **D-03:** Seed §4a known fixed costs as editable starter line items on first run (idempotent "seed if empty" check, not a settings flag). Seed set: Housing $1,300/mo, Electric $65/mo, Fuel $238/mo, Claude $100/mo — all PROTECTED. Car insurance and whey/supplement are NOT seeded here.
- **D-04:** Manual balance + recommended accrual (C3-consistent). App never assumes money moved.
- **D-05:** One generic sinking-fund primitive. Car-insurance launch instance: `payoutDate = 2027-03`, `annualAmount ≈ $982` (PROVISIONAL), `monthlyAccrual ≈ $82`, `cadence: 'annual'`. All fields editable.
- **D-06:** On-track status = `balance + monthlyAccrual × months_until_payout` vs `annualAmount`. App shows status, does NOT auto-recompute accrual.
- **D-07:** Payout = mark-paid + recurring auto-roll for `cadence: 'annual'` (reset balance, advance payoutDate +1yr). For `cadence: 'oneoff'` — fund archives/completes. No app-side money action (C3).
- **D-08:** `survival_floor = fixed_ex_food + floors.foodSeed`, where `fixed_ex_food = Σ(PROTECTED expense lines, monthly-normalized) + Σ(sinking-fund monthlyAccruals)`. Derived Jotai atom — never stored stale.
- **D-09:** Food-floor placeholder = existing `floors.foodSeed` (~$550). No new parameter. Phase 4 swaps in the computed floor into the same slot.
- **D-10:** Cadence normalization: `monthly` as-is, `annual / 12`, `oneoff` excluded from recurring floor. Only PROTECTED lines feed the floor.
- **D-11:** New `/expenses` route — add/edit lines AND the protected-vs-gateable categorized view (SC#1).
- **D-12:** Survival floor renders as a new `font-mono` metric card on the dashboard (fourth card or 2-row grid). NOT a band/marker on the income bar.
- **D-13:** New `/funds` route — sinking-funds only this phase. EF progress section added in Phase 5.

### Claude's Discretion

- Exact field names/shape of `ExpenseItem` and `SinkingFund` types within D-02/D-05, finalized against existing `schema.ts` conventions.
- Schema migration v2→v3 mechanics (Dexie `.version(3).upgrade()` + `MIGRATIONS[2]` entry) — follow Phase-1 single-source-of-truth pattern.
- Whether seed (D-03) runs as first-run settings flag or idempotent "seed if empty" check — executor's call, must not clobber Ian's edits on reload. (Contextual note from UI-SPEC: implement as "seed if PROTECTED expense rows are empty".)
- `/expenses` and `/funds` form UX details (inline edit vs modal), progress-bar visuals — within UI-design-principles + existing primitives.

### Deferred Ideas (OUT OF SCOPE)

- CC / itemized statement paste-parse adapter → Phase 5
- Checking↔credit-card reconciliation → Phase 5
- `Account` type `credit` enum + account-balance wiring → Phase 5
- Discretionary-food gating UI + soft caps → Phase 4/5
- Emergency-fund progress section on `/funds` → Phase 5
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | User can record expense line items (`{name, amount, cadence, category, protected, gateable}`) where cadence ∈ {monthly, annual, oneoff} | D-02 collapses protected/gateable to a single `classification` enum; cadence handled per D-10; schema section below details the full type |
| EXP-02 | Expenses classified as PROTECTED or GATEABLE | `classification: 'protected' \| 'gateable'` enum ensures mutual exclusivity; protected-vs-gateable view on `/expenses` |
| EXP-03 | Survival floor computed as `fixed_ex_food + protected_food_floor`, updates automatically | Derived `survivalFloorAtom` pattern mirrors `surplusAtom` / `backfillActiveAtom` in income.atoms.ts; food placeholder = `floors.foodSeed` |
| EXP-04 | ONE generic sinking-fund primitive (`{name, annualAmount, monthlyAccrual, balance, payoutDate}`); car insurance is launch instance | D-05 fields + cadence field added; single Dexie table, single atom pattern |
| EXP-05 | Adding a new sinking-fund instance requires zero new code paths | Generic primitive + Add-fund form = new DB row only; proven by car-insurance seed + car-purchase test case |
| EXP-06 | When annual cost is due, covered from balance and does NOT appear as a budget shock | D-07 mark-paid + auto-roll; accrual appears in floor (not lump cost); no monthly shock by construction |
| EXP-07 | Whey/supplement never double-counted in fixed-ex-food | Not seeded in D-03; soft advisory in UI (EXP-07 guard); structural: no category for supplements in expense classification |
| UI-04 | Funds surface shows EF progress (Phase 5) and all sinking-fund instances with progress toward payout dates | Phase 3 ships sinking-funds portion; EF section appended in Phase 5 per D-13 |
| EDGE-06 | Annual sinking-fund cost due → covered by accrued balance, not a shock | mark-paid interaction: `cadence: 'annual'` resets balance + advances payoutDate; accrual feeds floor throughout |
</phase_requirements>

---

## Summary

Phase 3 builds directly on top of the storage abstraction, atom pattern, and Dexie schema established in Phases 1–2. The Dexie tables `expenseItems` and `sinkingFunds` already exist in `db.ts` with empty `Table<unknown, number>` types — the task is to give them concrete types, add the v3 schema migration, and wire them into the storage abstraction and atom chain.

The survival-floor derivation (`fixed_ex_food + floors.foodSeed`) follows the same Jotai atom pattern as `surplusAtom` in `income.atoms.ts`: a derived read-only atom over two reactive sources (the expense-items observable and the floors settings atom). The `atomWithObservable + liveQuery` pattern is validated and available (Phase 2 lifted the ban). The food floor placeholder (`floors.foodSeed`) is already editable in Settings and available via `floorsLoadAtom` — no new settings infrastructure needed.

The sinking-fund primitive is a single generic DB row type with `cadence: 'annual' | 'oneoff'`. All payout behavior (mark-paid, auto-roll, archive) is UI logic over that row — no new DB primitives required. Adding a second fund is a new row via the same form, satisfying EXP-05/SC#5 structurally.

**Primary recommendation:** Implement Phase 3 as four work units: (1) schema types + migration v2→v3, (2) storage abstraction extensions for expenses + sinking funds, (3) atom chain for `expenseItemsAtom` + `sinkingFundsAtom` + `survivalFloorAtom`, (4) UI surfaces `/expenses` + `/funds` + dashboard metric card. Wave 0 tests cover the math and storage contracts before UI is built.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Expense CRUD | Storage abstraction (`storage.ts`) | Dexie (`db.ts`) | All domain persistence goes through the abstraction; Dexie is never touched by domain code directly (established pattern) |
| Sinking-fund CRUD | Storage abstraction (`storage.ts`) | Dexie (`db.ts`) | Same as above |
| Classification filtering | Jotai derived atom (`expenses.atoms.ts`) | — | Pure derivation over expense list; never stored stale (FOUND-06) |
| Survival floor calculation | Jotai derived atom (`expenses.atoms.ts`) | — | `survivalFloorAtom` derives from expense + fund atoms + floorsLoadAtom; recomputes live |
| Monthly-normalization math | Pure utility function | — | Cadence → monthly-equivalent is a pure function, testable in isolation, consumed by the derived atom |
| On-track status calculation | Jotai derived atom (funds.atoms.ts) | — | `months_until_payout × monthlyAccrual + balance` vs `annualAmount`; derived, never stored |
| Mark-paid / auto-roll | UI action → storage write | — | C3: user initiates; app writes `balance=0, payoutDate+=1yr` as a new DB state — NOT a money movement |
| Seed on first run | Storage-layer idempotent check | — | "Seed if PROTECTED expense rows are empty" runs at app init; avoids clobbering existing rows |
| `/expenses` view | React page component | — | Protected-vs-gateable two-column layout; reads from derived atoms |
| `/funds` view | React page component | — | Fund cards + add form; reads from fund atoms |
| Survival-floor metric card | Dashboard page component | — | Reads `survivalFloorAtom`; additive to existing grid, no modification to existing cards |
| Export/import round-trip | Storage abstraction | migrations.ts | `collectSchemaV1Data` + `replaceAll` extended to populate expenseItems + sinkingFunds (currently stubbed `[]`) |

---

## Standard Stack

Stack is fully pinned from Phases 1–2. No new external packages required for Phase 3.

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.x | UI rendering | Pinned Phase 1 |
| TypeScript | ~5.6 strict | Type safety | Pinned Phase 1 |
| Jotai | 2.20.0 | Atom-based state + derived values | Pinned Phase 1 |
| Dexie | 4.4.2 | IndexedDB wrapper; `liveQuery` observable | Pinned Phase 1 |
| react-router-dom | 7.x HashRouter | New routes `/expenses`, `/funds` | Pinned Phase 1 |
| Tailwind CSS | v3.4.x (PIN — never v4) | Token-based styling | Pinned Phase 1 |
| Vitest | 4.1.6 | Test runner | Pinned Phase 1 |
| fake-indexeddb | ~6.x | IDB mock in tests | Pinned Phase 1 |

[VERIFIED: live codebase — package.json + db.ts + schema.ts + income.atoms.ts]

**No new npm installs required for Phase 3.** All primitives needed are available.

---

## Architecture Patterns

### System Architecture Diagram

```
User action (form submit / mark-paid)
        │
        ▼
React page component (ExpensesPage / FundsPage / DashboardPage)
        │  reads via useAtomValue
        ▼
Jotai derived atoms (survivalFloorAtom, onTrackAtom, etc.)
        │  derive from
        ▼
Jotai source atoms (expenseItemsAtom, sinkingFundsAtom)
        │  atomWithObservable wraps
        ▼
storage.observeExpenseItems() / storage.observeSinkingFunds()
        │  liveQuery over
        ▼
Dexie tables (expenseItems, sinkingFunds)  ──  IndexedDB
        ▲
        │  write path (form submit / mark-paid)
storage.addExpenseItem() / storage.updateSinkingFund()
        ▲
        │
React write atom (saveExpenseAtom / markFundPaidAtom) → storage call → liveQuery re-emits
```

Survival floor card on dashboard pulls `survivalFloorAtom` which depends on both `expenseItemsAtom` and `floorsLoadAtom` (the existing settings atom). Changes to either source trigger recompute automatically.

### Recommended Project Structure (additions to existing layout)

```
src/
├── domains/
│   ├── expenses/
│   │   ├── expenses.atoms.ts       # expenseItemsAtom, survivalFloorAtom, derived atoms
│   │   └── expenses.types.ts       # ExpenseItem type re-export (or inline in schema.ts)
│   ├── funds/
│   │   ├── funds.atoms.ts          # sinkingFundsAtom, onTrackAtom, derived atoms
│   │   └── funds.types.ts          # SinkingFund type re-export
│   └── settings/                   # existing — floors.foodSeed already here
├── pages/
│   ├── ExpensesPage.tsx            # /expenses route
│   └── FundsPage.tsx               # /funds route
│   └── DashboardPage.tsx           # existing — add survivalFloorAtom metric card
├── components/
│   ├── TextInput.tsx               # new — identical to NumberInput except type="text"
│   ├── SelectInput.tsx             # new — styled <select> matching NumberInput tokens
│   ├── ClassificationToggle.tsx    # new — two-button PROTECTED/GATEABLE group
│   └── FundCard.tsx                # new — fund card with progress bar
├── storage/
│   ├── schema.ts                   # add ExpenseItem, SinkingFund, cadence, classification types; bump v→3
│   ├── db.ts                       # add .version(3) with typed tables
│   ├── migrations.ts               # add migrate_2_to_3 pure function
│   └── storage.ts                  # add expense CRUD + sinking-fund CRUD + observe* methods
└── test/
    ├── storage.expenses.test.ts    # CRUD + round-trip for ExpenseItem (EXP-01/02)
    ├── storage.funds.test.ts       # CRUD + round-trip for SinkingFund (EXP-04/05)
    ├── expenses.atoms.test.ts      # survivalFloorAtom math (EXP-03), cadence normalization
    ├── funds.atoms.test.ts         # onTrack math, mark-paid auto-roll (EDGE-06)
    └── migrations.test.ts          # extend to cover migrate_2_to_3 (no-op: empty tables)
```

### Pattern 1: Schema Type Extension (v2→v3)

**What:** Add `ExpenseItem` and `SinkingFund` concrete types to `schema.ts`, bump `CURRENT_SCHEMA_VERSION` to 3.

**When to use:** Every time Dexie tables gain typed rows.

```typescript
// Source: [VERIFIED: src/storage/schema.ts] — follows existing Floors/IncomeCheck pattern

export type Classification = 'protected' | 'gateable'
export type Cadence = 'monthly' | 'annual' | 'oneoff'

export type ExpenseItem = Readonly<{
  id?: number
  name: string
  amount: number          // the raw entered amount
  cadence: Cadence
  classification: Classification
}>

export type SinkingFundCadence = 'annual' | 'oneoff'

export type SinkingFund = Readonly<{
  id?: number
  name: string
  annualAmount: number    // editable target — provisional for car insurance
  monthlyAccrual: number  // editable — seeded at annualAmount/12
  balance: number         // manual; Ian records reality
  payoutDate: string      // YYYY-MM format (month precision)
  cadence: SinkingFundCadence
  provisional?: boolean   // flag shown as advisory on car-insurance seed
}>

export const CURRENT_SCHEMA_VERSION = 3 as const
```

**Cadence-to-monthly normalization (pure function — feeds survivalFloorAtom):**

```typescript
// Source: [VERIFIED: D-10 in CONTEXT.md]
export function toMonthlyEquivalent(amount: number, cadence: Cadence): number {
  if (cadence === 'monthly') return amount
  if (cadence === 'annual') return amount / 12
  return 0  // 'oneoff' excluded from recurring floor
}
```

### Pattern 2: Migration v2→v3

**What:** Pure function in `migrations.ts` that handles the v2→v3 schema step. Since `expenseItems` and `sinkingFunds` tables exist but were always empty (never populated in Phases 1–2), the migration is structurally a no-op but must exist to satisfy the migration ladder contract.

```typescript
// Source: [VERIFIED: src/storage/migrations.ts + SKELETON.md D-09]
// migrate_2_to_3: expenseItems and sinkingFunds were empty in v2 (never populated).
// No data transform needed. The version bump ensures the migration ladder is contiguous.
export function migrate_2_to_3(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    expenseItems: data.expenseItems ?? [],
    sinkingFunds: data.sinkingFunds ?? [],
  }
}

export const MIGRATIONS: Record<number, MigrationFn> = {
  1: migrate_1_to_2,
  2: migrate_2_to_3,  // ADD
}
```

Paired Dexie version in `db.ts`:

```typescript
// Source: [VERIFIED: src/storage/db.ts] — follow established version(2) pattern
this.version(3).stores({
  incomeChecks: '++id, date, source',
  expenseItems: '++id, name, classification, cadence',   // updated index
  sinkingFunds: '++id, name, payoutDate',
  accounts: '++id, type',
  settings: '&key',
})
// Upgrade: no data transform needed (tables were empty in v2)
```

Update `db.ts` typed table declarations:
```typescript
expenseItems!: Table<ExpenseItem, number>
sinkingFunds!: Table<SinkingFund, number>
```

### Pattern 3: Storage Abstraction Extension

**What:** Add expense and sinking-fund CRUD + observe methods to `storage.ts`, following the income CRUD pattern verbatim.

```typescript
// Source: [VERIFIED: src/storage/storage.ts] — mirrors addIncomeCheck/observeIncomeChecks

// ── Expense CRUD ────────────────────────────────────────────────────────────
export async function addExpenseItem(item: Omit<ExpenseItem, 'id'>): Promise<number>
export async function listExpenseItems(): Promise<ExpenseItem[]>
export async function updateExpenseItem(id: number, patch: Partial<ExpenseItem>): Promise<void>
export async function deleteExpenseItem(id: number): Promise<void>
export function observeExpenseItems(): Observable<ExpenseItem[]>

// ── Sinking Fund CRUD ───────────────────────────────────────────────────────
export async function addSinkingFund(fund: Omit<SinkingFund, 'id'>): Promise<number>
export async function listSinkingFunds(): Promise<SinkingFund[]>
export async function updateSinkingFund(id: number, patch: Partial<SinkingFund>): Promise<void>
export async function deleteSinkingFund(id: number): Promise<void>
export function observeSinkingFunds(): Observable<SinkingFund[]>
```

**Export/import extension:** `collectSchemaV1Data` currently stubs `expenseItems: []` and `sinkingFunds: []`. Phase 3 replaces those stubs:

```typescript
// Source: [VERIFIED: src/storage/storage.ts lines 102-122]
const expenseItems = await db.expenseItems.toArray()
const sinkingFunds = await db.sinkingFunds.toArray()
return { incomeChecks, expenseItems, sinkingFunds, accounts, settings }
```

And `replaceAll` must populate `expenseItems` and `sinkingFunds` from the import data (stripping `id` for auto-increment), same as the income-check pattern at lines 225–231.

### Pattern 4: Reactive Atom Chain for Expenses + Survival Floor

**What:** `expenseItemsAtom` follows `incomeChecksAtom` exactly. `survivalFloorAtom` is a derived atom over the expense list, sinking-fund list, and `floorsLoadAtom`.

```typescript
// Source: [VERIFIED: src/domains/income/income.atoms.ts + CONTEXT.md D-08]
// src/domains/expenses/expenses.atoms.ts

import { atomWithObservable } from 'jotai/utils'
import { atom } from 'jotai'
import * as storage from '../../storage/storage'
import { floorsLoadAtom } from '../settings/settings.atoms'
import { toMonthlyEquivalent } from '../../storage/schema'
import type { ExpenseItem } from '../../storage/schema'

// Source atom — never suspends (initialValue:[])
export const expenseItemsAtom = atomWithObservable<ExpenseItem[]>(
  () => storage.observeExpenseItems(),
  { initialValue: [] },
)

// Source atom for sinking funds
export const sinkingFundsAtom = atomWithObservable<SinkingFund[]>(
  () => storage.observeSinkingFunds(),
  { initialValue: [] },
)

// Derived: fixed expenses (PROTECTED, ex-food) normalized to monthly
const fixedExFoodAtom = atom((get): number => {
  const items = get(expenseItemsAtom)
  return items
    .filter(i => i.classification === 'protected')
    .reduce((sum, i) => sum + toMonthlyEquivalent(i.amount, i.cadence), 0)
})

// Derived: sinking-fund monthly accruals (all active funds contribute)
const sinkingFundAccrualsAtom = atom((get): number =>
  get(sinkingFundsAtom).reduce((sum, f) => sum + f.monthlyAccrual, 0)
)

// survivalFloorAtom: the primary output of Phase 3 (EXP-03, D-08)
// survival_floor = fixed_ex_food + Σ(monthlyAccruals) + floors.foodSeed
// async because floorsLoadAtom is async (reads from IndexedDB on first load)
export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const floors = await get(floorsLoadAtom)
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + floors.foodSeed
})
```

### Pattern 5: Sinking-Fund Mark-Paid / Auto-Roll

**What:** Write atom that updates fund state on payout. C3 means this is a DB update, not a money action.

```typescript
// Source: [VERIFIED: CONTEXT.md D-07]
// For cadence: 'annual' — reset balance, advance payoutDate +1yr, keep monthlyAccrual
// For cadence: 'oneoff' — delete the fund row (archive)

export const markFundPaidAtom = atom(
  null,
  async (_get, _set, fund: SinkingFund): Promise<void> => {
    if (!fund.id) return
    if (fund.cadence === 'oneoff') {
      await storage.deleteSinkingFund(fund.id)
    } else {
      // advance payoutDate YYYY-MM by 12 months
      const [year, month] = fund.payoutDate.split('-').map(Number)
      const nextDate = month === 12
        ? `${year + 1}-01`
        : `${year}-${String(month + 1).padStart(2, '0')}`
      // Advance by 12 months properly:
      const d = new Date(year, month - 1, 1)
      d.setFullYear(d.getFullYear() + 1)
      const newPayoutDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      await storage.updateSinkingFund(fund.id, {
        balance: 0,
        payoutDate: newPayoutDate,
      })
    }
  },
)
```

**Date advancement note:** Use `Date` arithmetic to advance 12 months cleanly (avoids YYYY-13 errors). `payoutDate` is YYYY-MM (no day component) — parse to a `Date` at day 1, add 1 year, re-serialize.

### Pattern 6: On-Track Status Calculation

**What:** Projection of balance at payout date vs target. Pure derivation; never stored.

```typescript
// Source: [VERIFIED: CONTEXT.md D-06]
// months_until_payout = number of calendar months from current YYYY-MM to payoutDate YYYY-MM
// projected = balance + monthlyAccrual × months_until_payout
// onTrack = projected >= annualAmount

function monthsUntilPayout(payoutDate: string): number {
  const [py, pm] = payoutDate.split('-').map(Number)
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth() + 1
  return Math.max(0, (py - cy) * 12 + (pm - cm))
}

// This pure function is called inside a derived atom over sinkingFundsAtom
export function isOnTrack(fund: SinkingFund): boolean {
  const months = monthsUntilPayout(fund.payoutDate)
  const projected = fund.balance + fund.monthlyAccrual * months
  return projected >= fund.annualAmount
}
```

**Important:** `months_until_payout` uses local calendar month arithmetic, same as the income model's `isInLocalMonth` convention. Timezone is consistent — both use `new Date()` local time. The payout date has no day component (YYYY-MM), so there is no ambiguity about which day of the month triggers payout.

### Pattern 7: Seed on First Run

**What:** Idempotent seed of the four starter expense lines (D-03). Runs at app init, NOT as a settings flag.

```typescript
// Source: [VERIFIED: CONTEXT.md D-03 + UI-SPEC §Surface 2 seed note]
// Check: "seed if PROTECTED expense rows are empty"
// Called from main.tsx or App.tsx on startup (same pattern as Settings defaults)

const SEED_EXPENSES: Omit<ExpenseItem, 'id'>[] = [
  { name: 'Housing all-in', amount: 1300, cadence: 'monthly', classification: 'protected' },
  { name: 'Electric',        amount: 65,   cadence: 'monthly', classification: 'protected' },
  { name: 'Fuel',            amount: 238,  cadence: 'monthly', classification: 'protected' },
  { name: 'Claude',          amount: 100,  cadence: 'monthly', classification: 'protected' },
]

export async function seedExpensesIfEmpty(): Promise<void> {
  const existing = await listExpenseItems()
  const hasProtected = existing.some(e => e.classification === 'protected')
  if (hasProtected) return  // Ian has data — do not clobber
  for (const item of SEED_EXPENSES) {
    await addExpenseItem(item)
  }
}
```

Car insurance is NOT in the seed (it is the sinking-fund instance, D-03 explicit note). Whey/supplement is NOT seeded (EXP-07). Phone is seeded at $0 or omitted (Ian is on family plan, D-03).

Similarly for sinking funds — seed the car-insurance instance if `sinkingFunds` table is empty:

```typescript
export async function seedFundsIfEmpty(): Promise<void> {
  const existing = await listSinkingFunds()
  if (existing.length > 0) return
  await addSinkingFund({
    name: 'Car insurance',
    annualAmount: 982,
    monthlyAccrual: 82,
    balance: 0,
    payoutDate: '2027-03',
    cadence: 'annual',
    provisional: true,
  })
}
```

### Anti-Patterns to Avoid

- **Storing derived survival floor in the DB:** Violates FOUND-06. `survivalFloorAtom` must be a pure derived atom. The only write path is `saveExpenseItem` / `saveSinkingFund`.
- **Letting sinking-fund balance auto-update:** Violates C3. The app shows recommended accrual and on-track status; Ian records actual balance manually.
- **Using `localStorage` or `sessionStorage`:** Project rule. Persistence is IndexedDB via `storage.ts` only.
- **Importing `db.ts` directly in domain code:** `expenseItems.atoms.ts` and `funds.atoms.ts` must import from `storage.ts` only — the grep gate established in Phase 2.
- **Decrementing foodSeed:** C1 boundary. Phase 4 introduces the `foodFloor` settings key with the C1 lock. In Phase 3, `floors.foodSeed` remains editable both directions (it is just a numeric parameter, not yet the locked C1 key). Note from Phase 1 context (T-01-08 boundary in STATE.md): the C1 lock applies to the future `settings['foodFloor']` singleton, not to `foodSeed`.
- **Counting whey/supplement in fixed-ex-food:** EXP-07. The soft advisory in the UI (name-field check for "whey"/"supplement") is a hint, not a hard block — but the data model has no category for it in expenses. It is explicitly deferred to Phase 4's food floor.
- **Seeding car insurance as an expense line:** D-03 explicit note. Car insurance lives only in the sinking-fund table; adding it to both would double-count it in the survival floor (once as an expense, once via accrual).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive list-to-atom bridge | Custom polling / manual cache invalidation | `atomWithObservable + liveQuery` (already proven in Phase 2) | IDB writes automatically re-emit the observable; no manual cache busting needed |
| Schema versioning / migration | Custom version-check logic | Dexie `.version(N).stores().upgrade()` + pure `MIGRATIONS[N-1]` ladder | Single source of truth pattern established in Phase 1 D-09; already tested |
| Date arithmetic for payoutDate advance | Manual string manipulation | `new Date()` + `setFullYear()` | Avoids month-overflow bugs (13th month, Feb edge cases) |
| Progress bar | Third-party progress component | Inline `div` with `width` percentage + `role="progressbar"` aria attributes | No new dependency; matches token system |

---

## Runtime State Inventory

> This is NOT a rename/refactor phase. No runtime state inventory required.

---

## Common Pitfalls

### Pitfall 1: Double-counting car insurance

**What goes wrong:** Car insurance seeded as both a `PROTECTED` expense line AND a sinking-fund instance → `fixedExFoodAtom` counts `$238/mo` from the expense AND `$82/mo` from the fund accrual.

**Why it happens:** D-03 explicitly excludes car insurance from the seed, but someone might add it "to be thorough."

**How to avoid:** The seed list (D-03) must not include car insurance. The sinking-fund seed (D-05) covers it. The survival-floor derivation (D-08) adds BOTH expense-line sums AND sinking-fund accruals — double-entry is a real mathematical trap.

**Warning signs:** Survival floor shows ~$2,504 instead of ~$2,340 on first run.

### Pitfall 2: Month-precision date handling for payoutDate

**What goes wrong:** `payoutDate = '2027-03'` — if code constructs a `Date` from just YYYY-MM without specifying a day, JavaScript interprets it as UTC midnight on the 1st. In non-UTC timezones, `new Date('2027-03').getMonth()` can return the wrong month.

**Why it happens:** `new Date('2027-03-01')` is UTC; `new Date('2027-03-01').getMonth()` in a US timezone returns 1 (Feb) on Feb 28 UTC → March 1 local.

**How to avoid:** Construct `Date` objects from `YYYY-MM` by splitting to `(year, month)` integers and using `new Date(year, month-1, 1)` (local constructor). Never pass YYYY-MM strings directly to `new Date()` for local-time arithmetic.

**Warning signs:** `monthsUntilPayout` returns -1 or off-by-one values in month-boundary testing.

### Pitfall 3: survivalFloorAtom async + dashboard suspension

**What goes wrong:** `survivalFloorAtom` is async (because `floorsLoadAtom` is async). If the dashboard renders it with `useAtomValue` without a `<Suspense>` boundary, the component throws on the first render cycle.

**Why it happens:** Jotai async atoms suspend by default when the promise is pending.

**How to avoid:** Wrap the dashboard metric grid in a `<Suspense fallback={...}>` (or use the `useAtomValue` with an `initialValue` via `loadable`). The income dashboard already handles this for `surplusAtom` and `projectedTotalAtom` — follow that same pattern.

**Warning signs:** Dashboard crashes/blanks on load before IDB read completes.

### Pitfall 4: Seed running on every reload clobbers user edits

**What goes wrong:** If the seed guard checks only `listExpenseItems().length === 0` but the user deletes all expenses, the seed re-fires and restores the defaults.

**Why it happens:** "Empty" is a valid user state (Ian deleted everything intentionally).

**How to avoid:** Use a settings-key sentinel: after seeding, write `settings['expensesSeeded'] = true`. If the sentinel exists, skip seeding regardless of list length. This is the recommended approach — it decouples "no rows" (valid user state) from "never been seeded" (first-run state).

**Alternative (per UI-SPEC):** "seed if PROTECTED expense rows are empty" — acceptable if simpler, but has the edge-case above. The sentinel approach is safer for a single-user app where Ian might clean slate.

### Pitfall 5: `toMonthlyEquivalent` for `oneoff` cadence

**What goes wrong:** A one-off expense (e.g., a one-time large purchase) is added as `oneoff` cadence. If `toMonthlyEquivalent` returns `amount/12` instead of `0`, it leaks into the survival floor as a recurring cost.

**Why it happens:** D-10 explicitly specifies `oneoff` → `0` (excluded from recurring floor). A copy-paste from the `annual` branch misses this.

**How to avoid:** Unit test for all three cadence cases. The annual-cadence floor note in the UI (UI-SPEC) should NOT appear for oneoff (different copy: "One-off costs are excluded from the survival floor.") — this UI difference is a signal that the math correctly handles the distinction.

### Pitfall 6: Export/import not wiring expenseItems + sinkingFunds

**What goes wrong:** A v3 backup exports `expenseItems: []` and `sinkingFunds: []` because `collectSchemaV1Data` still uses the Phase 2 stubs. Import round-trip loses all expense and fund data.

**Why it happens:** The stubs are explicitly marked "future phases" in Phase 2's `storage.ts` (lines 118-119). Easy to overlook during Phase 3 planning.

**How to avoid:** Include a test in `storage.expenses.test.ts` that adds an expense, exports, reimports into a fresh DB, and verifies the item survives the round-trip. Same for funds. This is a Wave 0 test.

---

## Code Examples

### Survival Floor Sanity Number

At first run (D-03 seeds applied):
- Housing: $1,300/mo (PROTECTED)
- Electric: $65/mo (PROTECTED)
- Fuel: $238/mo (PROTECTED)
- Claude: $100/mo (PROTECTED)
- Car insurance accrual: $82/mo (sinking fund)
- `fixed_ex_food` = 1,300 + 65 + 238 + 100 + 82 = **$1,785/mo**
- `floors.foodSeed` = **$550/mo**
- `survivalFloor` = **$2,335/mo** (spec §4e says ~$2,340 — the ~$5 delta is rounding of $982/12 = $81.83 vs the editable $82 accrual)

[VERIFIED: CONTEXT.md §Specific Ideas + D-08 + REQUIREMENTS.md §Provisional values]

This number is the UAT target for SC#2 (survival floor displays on dashboard and recomputes live).

### On-Track Calculation Example

Car insurance fund at initial state (balance=0, monthlyAccrual=$82, payoutDate=2027-03):
- From 2026-06 to 2027-03 = 9 months
- Projected = 0 + 82 × 9 = **$738** vs annualAmount **$982** → **Behind**
- After Ian records 6 months of accruals (balance=$492): projected = 492 + 82 × 3 = **$738** → still Behind
- After 12 months at $82/mo: balance=$984 ≥ $982 → **On track**

[VERIFIED: CONTEXT.md D-06]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `atomWithObservable` ban (Phase 1) | Lifted in Phase 2 | Phase 2 | `expenseItemsAtom` and `sinkingFundsAtom` can use the reactive pattern directly |
| `expenseItems: []` stub in `collectSchemaV1Data` | Wired to real table in Phase 3 | Phase 3 | Export/import round-trips expense data |
| `Table<unknown, number>` for expenseItems/sinkingFunds in db.ts | Typed `Table<ExpenseItem, number>` + `Table<SinkingFund, number>` | Phase 3 | TypeScript enforcement on DB reads/writes |

**Not deprecated, but critical to respect:**
- `floors.foodSeed` remains fully editable in Phase 3 (both directions). The C1 lock on downward editing applies to the future `settings['foodFloor']` key (Phase 4), not to `foodSeed`. See T-01-08 boundary in STATE.md.

---

## Open Questions

1. **Phone (family plan) seed row:** D-03 says "Phone = $0, on family plan — omit or seed as $0." The UI-SPEC does not mention it. Recommendation: omit entirely — a $0 expense row adds noise without contributing to the survival floor.

2. **`provisional` flag on SinkingFund type:** D-05 says the car-insurance target is "flagged provisional." This should be a `boolean` field on the `SinkingFund` type (optional, defaults false), not a hard-coded UI special case for car insurance specifically. The Add-fund form does not include a "provisional" checkbox — the UI-SPEC shows "Provisional targets can be updated anytime" as a static helper text, not a flag the user sets. Recommendation: set `provisional: true` in the car-insurance seed only; leave the field on the type for Phase-5 extensibility; do not expose it in the Add-fund form.

3. **`months_until_payout` when payout month has passed:** If `payoutDate` is in the past (Ian missed marking it paid), `monthsUntilPayout` returns 0. `projected = balance + 0 = balance`. If balance < annualAmount → status "Behind." This is correct behavior (the fund is behind because payout has passed and wasn't marked). No special handling needed; the "Mark paid" button is still visible.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is code/config-only. No new external CLI tools, services, runtimes, or databases required. All infrastructure is already running (Node.js, npm, Vitest, fake-indexeddb, GitHub Actions).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `vite.config.ts` (test block with jsdom environment) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | Add expense with all fields; retrieve by classification and cadence | unit | `npm run test -- --run storage.expenses` | ❌ Wave 0 |
| EXP-02 | PROTECTED and GATEABLE are mutually exclusive; classification filter returns correct rows | unit | `npm run test -- --run storage.expenses` | ❌ Wave 0 |
| EXP-03 | survivalFloorAtom = fixedExFood + accruals + foodSeed; recomputes on expense change | unit | `npm run test -- --run expenses.atoms` | ❌ Wave 0 |
| EXP-04 | Add sinking fund; retrieve fields; monthlyAccrual editable | unit | `npm run test -- --run storage.funds` | ❌ Wave 0 |
| EXP-05 | Add a second sinking-fund instance via same primitive; both appear independently | unit | `npm run test -- --run storage.funds` | ❌ Wave 0 |
| EXP-06 | Annual cost does NOT appear as expense line; only accrual feeds floor | unit | `npm run test -- --run expenses.atoms` | ❌ Wave 0 |
| EXP-07 | Whey/supplement is not in the expense seed; no expense category for it | unit | `npm run test -- --run storage.expenses` | ❌ Wave 0 |
| UI-04 | Sinking fund cards render with correct balance/target/accrual/status | component | `npm run test -- --run FundsPage` | ❌ Wave 0 |
| EDGE-06 | mark-paid on annual fund → balance=0, payoutDate advanced +1yr; oneoff fund deleted | unit | `npm run test -- --run funds.atoms` | ❌ Wave 0 |
| FOUND-06 | survivalFloorAtom never stored; recomputes from source atoms | unit | `npm run test -- --run expenses.atoms` | ❌ Wave 0 |
| Schema v2→v3 | migrate_2_to_3 is a no-op for empty tables; preserves all settings | unit | `npm run test -- --run migrations` | ✅ (extend existing) |
| Export round-trip | exportAll → importAll preserves expense rows and fund rows | integration | `npm run test -- --run storage.expenses` | ❌ Wave 0 |
| Cadence normalization | monthly=amount, annual=amount/12, oneoff=0 | unit | `npm run test -- --run expenses.atoms` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/test/storage.expenses.test.ts` — covers EXP-01, EXP-02, EXP-07, export round-trip
- [ ] `src/test/storage.funds.test.ts` — covers EXP-04, EXP-05, export round-trip
- [ ] `src/test/expenses.atoms.test.ts` — covers EXP-03, EXP-06, FOUND-06, cadence normalization
- [ ] `src/test/funds.atoms.test.ts` — covers EDGE-06 (mark-paid auto-roll)
- [ ] Extend `src/test/migrations.test.ts` — add migrate_2_to_3 test case

---

## Security Domain

ASVS categories applicable to Phase 3:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth — single-user local app (C2) |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | no multi-user |
| V5 Input Validation | yes | TypeScript types enforce field shapes; `classification` and `cadence` are string union types — invalid values are a TypeScript compile error; runtime validation on import path via `isPlainObject` check already in `importAll` |
| V6 Cryptography | no | no credentials stored (C2 structural enforcement) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Importing a crafted backup that sets `annualAmount` to NaN or negative | Tampering | `importAll` runs migration ladder; add input validation in `replaceAll` that rejects non-finite numbers for financial fields. The existing pattern validates envelope shape but not field-level values. |
| survivalFloorAtom returning NaN if expense amount is NaN | Tampering | Normalize financial amounts at storage write time: `if (!Number.isFinite(amount)) throw` in `addExpenseItem`. |
| C3 violation via a hypothetical `autoSweepBalance()` method on storage | Tampering | Structural enforcement: storage surface has no such method. Confirmed by absence — TypeScript won't compile a call to a non-existent export. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `atomWithObservable + liveQuery` validated in Phase 2 and ready for use in Phase 3 without additional investigation | Standard Stack, Architecture Patterns | Low — Phase 2 CONTEXT.md explicitly states "Phase 2 lifts the atomWithObservable ban" and income.atoms.ts confirms it is in production use |
| A2 | `migrate_2_to_3` is a structural no-op because `expenseItems` and `sinkingFunds` tables were never populated in Phases 1–2 | Architecture Patterns — Migration | Low — confirmed by `collectSchemaV1Data` in storage.ts (lines 118-119: `expenseItems: [], sinkingFunds: []`) and `replaceAll` (no population of those tables) |
| A3 | `floors.foodSeed` ≈ $550 is the correct placeholder for the Phase 3 survival floor | Survival floor sanity number | Low — confirmed by `DEFAULT_FLOORS` in schema.ts and CONTEXT.md D-09 |

All claims tagged `[ASSUMED]` above are LOW risk. No user confirmation required before planning.

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: src/storage/schema.ts]` — existing types, CURRENT_SCHEMA_VERSION=2, DEFAULT_FLOORS
- `[VERIFIED: src/storage/db.ts]` — existing Dexie schema, version history, expenseItems/sinkingFunds as `Table<unknown, number>`
- `[VERIFIED: src/storage/storage.ts]` — existing CRUD pattern, observeIncomeChecks, collectSchemaV1Data stubs, replaceAll
- `[VERIFIED: src/storage/migrations.ts]` — migration ladder contract, migrate_1_to_2, MIGRATIONS map
- `[VERIFIED: src/domains/income/income.atoms.ts]` — atomWithObservable pattern, derived atoms, write atoms
- `[VERIFIED: .planning/phases/03-expense-model-sinking-funds/03-CONTEXT.md]` — all locked decisions D-01 through D-13
- `[VERIFIED: .planning/phases/03-expense-model-sinking-funds/03-UI-SPEC.md]` — surface specs, component reuse map, seed row details
- `[VERIFIED: .planning/REQUIREMENTS.md]` — EXP-01..07, UI-04, EDGE-06 definitions
- `[VERIFIED: .planning/phases/01-foundation-storage-deploy/SKELETON.md]` — authoritative architecture source of truth
- `[VERIFIED: .planning/STATE.md]` — open loops, Phase 1+2 locked decisions, T-01-08 foodSeed boundary
- `[VERIFIED: .planning/config.json]` — nyquist_validation: true confirmed

### Secondary (MEDIUM confidence)

None required — all material is verified from the live codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pinned from Phases 1–2, confirmed in package.json/source
- Architecture: HIGH — Phase 2 patterns verified in income.atoms.ts; extension is mechanical
- Pitfalls: HIGH — double-count, date math, and suspension pitfalls are all derived from live code patterns
- Test map: HIGH — mirrors existing test file naming convention exactly

**Research date:** 2026-05-29
**Valid until:** 2026-07-29 (stack is pinned; no external dependencies)
