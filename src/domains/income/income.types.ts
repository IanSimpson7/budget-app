// Income domain types — single source of truth lives in the storage schema.
// Re-exported here so domain consumers can import from the domain barrel without
// reaching into src/storage/. The storage abstraction boundary only constrains
// DATA-level imports (no Dexie in domains); shared TS types are fine.
export { type IncomeCheck, type Category, type KnownSource } from '../../storage/schema'

// Parse-time shape — never persisted. Represents a candidate row extracted
// from a pasted bank statement before the user confirms and commits it.
export type CandidateRow = {
  date?: string
  netAmount?: number
  source?: string
  note?: string
  balanceAfter?: number | null
  isCredit: boolean
  checked: boolean
  category: import('../../storage/schema').Category
  taxable: boolean
  raw: string
}
