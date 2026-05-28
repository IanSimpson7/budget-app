// Pure classification functions — no I/O, no Dexie, fully unit-testable.
//
// D-08: defaultTaxable — derives taxable flag from category.
// D-12: isInLocalMonth + classifySurplus — surplus classification keyed on local calendar month.
// D-05: defaultChecked — conservative auto-check for the confirm step.
import type { CandidateRow, IncomeCheck, KnownSource } from './income.types'

/**
 * D-08: Default taxability by category.
 * payroll → taxable; gift → non-taxable; other → taxable (conservative).
 */
export function defaultTaxable(category: import('./income.types').Category): boolean {
  return category !== 'gift'
}

/**
 * D-12: Classify the check's date as LOCAL calendar month.
 * Appends 'T00:00:00' so Date() parses as local midnight, not UTC.
 * This avoids the month-boundary misclassification (Pitfall 2):
 *   new Date('2026-06-01') → May 31 in US timezones (UTC parse).
 *   new Date('2026-06-01T00:00:00') → June 1 regardless of timezone.
 */
export function isInLocalMonth(isoDate: string, ref: Date = new Date()): boolean {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

/**
 * D-12: Classify surplus payroll checks.
 * Rules:
 *  1. Only payroll checks participate in the 2-check baseline.
 *  2. Within each calendar month, checks are sorted ascending by date.
 *     The 3rd+ payroll check (by date order) is auto-flagged surplus.
 *  3. surplusOverride=true forces the flag regardless of ordinal position.
 *  4. Gift/other income is NEVER surplus-flagged by the count rule.
 *
 * @param checks  All IncomeCheck records to evaluate (any month, any category).
 * @returns       Set of ids that are surplus (id is required for all entries passed).
 */
export function classifySurplus(checks: IncomeCheck[]): Set<number> {
  const surplusIds = new Set<number>()

  // Step 1: Handle explicit overrides first (any category)
  for (const c of checks) {
    if (c.surplusOverride === true && c.id !== undefined) {
      surplusIds.add(c.id)
    }
  }

  // Step 2: Group payroll checks by local calendar month
  // Key: 'YYYY-MM' derived from local-midnight parse
  const byMonth = new Map<string, IncomeCheck[]>()
  for (const c of checks) {
    if (c.category !== 'payroll') continue
    const d = new Date(`${c.date}T00:00:00`)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = byMonth.get(key) ?? []
    bucket.push(c)
    byMonth.set(key, bucket)
  }

  // Step 3: Within each month, sort by date asc; 3rd+ are surplus
  for (const monthChecks of byMonth.values()) {
    const sorted = [...monthChecks].sort((a, b) => a.date.localeCompare(b.date))
    for (let i = 2; i < sorted.length; i++) {
      const entry = sorted[i]
      if (entry !== undefined && entry.id !== undefined) {
        surplusIds.add(entry.id)
      }
    }
  }

  return surplusIds
}

/**
 * D-05: Conservative auto-check for the confirm step.
 * Default-checked = credits where TYPE: PAYROLL is in raw text OR source ∈ knownSources.
 * Everything else (all debits, non-payroll unknown credits) defaults unchecked.
 *
 * Nothing commits without the user's explicit tick — this is a UI default, not a commit.
 */
export function defaultChecked(row: CandidateRow, knownSources: KnownSource[]): boolean {
  if (!row.isCredit) return false

  // Payroll type signal in the raw block text
  if (row.raw.includes('TYPE: PAYROLL')) return true

  // Known source match (exact string equality, D-06)
  if (row.source !== undefined) {
    const match = knownSources.find((ks) => ks.source === row.source)
    if (match) return true
  }

  return false
}
