// Storage schema — pure types + constants. NO Dexie imports here.
// Bumping CURRENT_SCHEMA_VERSION requires (a) a Dexie .version(N).stores(...).upgrade(...)
// in db.ts and (b) a corresponding MIGRATIONS[N-1] entry in migrations.ts. Single source
// of truth via the migrations.ts comment block (D-09).

export const CURRENT_SCHEMA_VERSION = 2 as const

export type Floors = Readonly<{
  passive: number // D-12 default 2400 — "Passive income floor — solvency baseline"
  defended: number // D-12 default 3000 — "Defended line — backfill trigger"
  foodSeed: number // D-12 default 550 — "Food floor seed — refines from receipts later"
}>

export const DEFAULT_FLOORS: Floors = { passive: 2400, defended: 3000, foodSeed: 550 }

// D-08 income category classification
export type Category = 'payroll' | 'gift' | 'other'

// D-08 fields + D-12 surplusOverride. date is ISO yyyy-mm-dd, classified by LOCAL calendar month.
export type IncomeCheck = Readonly<{
  id?: number
  date: string             // ISO yyyy-mm-dd
  netAmount: number        // positive for income
  source: string
  note: string             // raw block text incl. balance (D-07)
  category: Category       // D-08
  taxable: boolean         // D-08
  surplusOverride?: boolean // D-12 per-check manual surplus flag override
}>

// D-06 known-source memory: persisted source→category/taxable mapping
export type KnownSource = Readonly<{
  source: string
  category: Category
  taxable: boolean
}>

export type SettingsRow = { key: string; value: unknown }

export type SchemaV1Data = {
  incomeChecks: unknown[]
  expenseItems: unknown[]
  sinkingFunds: unknown[]
  accounts: unknown[]
  settings: Record<string, unknown>
}

export type ExportEnvelope = Readonly<{
  schemaVersion: number
  exportedAt: string
  appVersion: string
  data: SchemaV1Data
}>

export type ImportErrorCode = 'VERSION_TOO_NEW' | 'PARSE_ERROR' | 'INVALID_ENVELOPE'

export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode) {
    super(code)
    this.name = 'ImportError'
  }
}
