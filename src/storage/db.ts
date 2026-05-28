import Dexie, { type Table } from 'dexie'
import type { SettingsRow } from './schema'

// Dexie subclass. Only the HIGHEST version's .stores() is the live schema; older
// .version(N).stores().upgrade() pairs are kept for migration history when the
// schema version advances. See migrations.ts for the source-of-truth contract.
export class BudgetDatabase extends Dexie {
  incomeChecks!: Table<unknown, number>
  expenseItems!: Table<unknown, number>
  sinkingFunds!: Table<unknown, number>
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

    // RESEARCH.md Pitfall 3 — multi-tab version-upgrade blocking. Forcing the
    // stale tab to close its connection on versionchange lets the new tab
    // proceed with the upgrade instead of hanging forever.
    this.on('versionchange', () => {
      this.close()
    })
  }
}

export const db = new BudgetDatabase()
