import Dexie, { type Table } from 'dexie'
import type { ExpenseItem, IncomeCheck, SettingsRow, SinkingFund } from './schema'
import type { MealDefinition } from '../domains/food/food.types'

// Dexie subclass. Only the HIGHEST version's .stores() is the live schema; older
// .version(N).stores().upgrade() pairs are kept for migration history when the
// schema version advances. See migrations.ts for the source-of-truth contract.
export class BudgetDatabase extends Dexie {
  incomeChecks!: Table<IncomeCheck, number>
  expenseItems!: Table<ExpenseItem, number>
  sinkingFunds!: Table<SinkingFund, number>
  mealDefinitions!: Table<MealDefinition, number>
  accounts!: Table<unknown, number>
  settings!: Table<SettingsRow, string>

  constructor() {
    super('BudgetApp')
    this.version(1).stores({
      incomeChecks: '++id, date, source',
      expenseItems: '++id, name, category, protected, cadence',
      sinkingFunds: '++id, name, payoutDate',
      accounts: '++id, type',
      settings: '&key',
    })

    // v2: field-only addition (category, taxable, surplusOverride on incomeChecks).
    // Indexes unchanged — '++id, date, source' covers all Phase-2 queries.
    // Version MUST advance so Dexie and the JSON import ladder stay aligned (A2).
    // v2: field-only addition (category, taxable, surplusOverride on incomeChecks).
    // Indexes unchanged — '++id, date, source' covers all Phase-2 queries.
    // Version MUST advance so Dexie and the JSON import ladder stay aligned (A2).
    this.version(2).stores({
      incomeChecks: '++id, date, source',
      expenseItems: '++id, name, category, protected, cadence',
      sinkingFunds: '++id, name, payoutDate',
      accounts: '++id, type',
      settings: '&key',
    })

    // v3: typed expenseItems + sinkingFunds tables. Updated index for expenseItems
    // to use 'classification' enum (replacing the v1 'category, protected' dual-bool
    // columns — D-02: single classification enum). No .upgrade() data transform
    // needed: tables were always empty in v2 (migrate_2_to_3 is a no-op for data).
    this.version(3).stores({
      incomeChecks: '++id, date, source',
      expenseItems: '++id, name, classification, cadence',
      sinkingFunds: '++id, name, payoutDate',
      accounts: '++id, type',
      settings: '&key',
    })

    // v4: food domain — mealDefinitions table added.
    // unitCostMap, portionModel, foodFloorMeta, flavorLine stored as settings keys
    // (existing '&key' settings table covers them — no new Dexie table needed).
    // migrate_3_to_4 is a data no-op: new table is empty; existing data untouched.
    // No .upgrade() needed since the table is being freshly created.
    this.version(4).stores({
      incomeChecks: '++id, date, source',
      expenseItems: '++id, name, classification, cadence',
      sinkingFunds: '++id, name, payoutDate',
      mealDefinitions: '++id, mealName',  // indexed by mealName for SMC join (Pitfall 5)
      accounts: '++id, type',
      settings: '&key',
    })

    // RESEARCH.md Pitfall 3 — multi-tab version-upgrade blocking. Forcing the
    // stale tab to close its connection on versionchange lets the new tab
    // proceed with the upgrade instead of hanging forever.
    this.on('versionchange', () => {
      this.close()
    })
  }
}

export const db = new BudgetDatabase()
