// D-02..D-04: Ian's checking-account statement adapter.
// Implements the StatementAdapter interface for the block-based ACH format
// produced by his bank (tab-delimited, trailing two decimals, TYPE/CO/ID metadata).
//
// Security V5 (T-02-V): no eval, no new RegExp from input. All regexes are
// module-level constants with anchored patterns.
import type { StatementAdapter } from './adapter.types'
import type { CandidateRow } from '../income.types'

// The trailing pair of comma-formatted signed decimals = (netAmount, balanceAfter).
// Anchored at $ — no nested quantifiers, no catastrophic backtracking.
const TRAILING_NUMS = /(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/

// Matches the bank's key:value metadata lines (CO:, TYPE:, ID:, etc.)
const CO_LINE = /^\s*CO:\s*(.+)/
const TYPE_LINE = /^\s*TYPE:\s*(.+)/

/**
 * Parse a tab-delimited amount/balance string into a numeric value.
 * Strips commas then passes to Number(); returns undefined on NaN (T-02-V).
 */
function parseAmount(raw: string): number | undefined {
  const stripped = raw.replace(/,/g, '')
  const n = Number(stripped)
  return Number.isNaN(n) ? undefined : n
}

/**
 * Convert MM/DD/YYYY → ISO yyyy-mm-dd.
 * Returns undefined for unrecognised input (no throw — T-02-V).
 */
function toISO(mmddyyyy: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(mmddyyyy)
  if (!m) return undefined
  return `${m[3]}-${m[1]}-${m[2]}`
}

export const checkingAdapter: StatementAdapter = {
  statementType: 'checking',

  extractFields(block: string[]): Partial<CandidateRow> {
    const firstLine = block[0] ?? ''

    // D-03: date from MM/DD/YYYY portion of the first line
    const datePart = firstLine.split('\t')[0] ?? ''
    const date = toISO(datePart)

    // D-03: trailing two numbers → (netAmount, balanceAfter)
    // Search all block lines for the trailing pair (usually on the first line)
    let netAmount: number | undefined
    let balanceAfter: number | null = null

    for (const line of block) {
      const m = TRAILING_NUMS.exec(line)
      if (m) {
        netAmount = parseAmount(m[1] ?? '')
        const ba = parseAmount(m[2] ?? '')
        balanceAfter = ba !== undefined ? ba : null
        break
      }
    }

    // D-03: source ← CO: value if present, else first description token
    let source: string | undefined
    let typeValue: string | undefined

    for (const line of block) {
      const coM = CO_LINE.exec(line)
      if (coM && coM[1] !== undefined) {
        source = coM[1].trim()
      }
      const typeM = TYPE_LINE.exec(line)
      if (typeM && typeM[1] !== undefined) {
        typeValue = typeM[1].trim()
      }
    }

    if (!source) {
      // Fallback: first description token on line 0 (after date tab).
      // Strip "ACH Deposit" prefix if present so the meaningful name surfaces.
      let desc = (firstLine.split('\t')[1] ?? '').trim()
      desc = desc.replace(/^ACH Deposit\s+/i, '')
      source = desc || undefined
    }

    // D-07: note ← raw block text (preserves TYPE/ID/CO metadata for audit)
    // Include typeValue context
    const note = block.join('\n')

    // Build result, omitting undefined optional fields to satisfy exactOptionalPropertyTypes.
    const result: Partial<import('../income.types').CandidateRow> = {
      note,
      balanceAfter,
      category: typeValue === 'PAYROLL' ? 'payroll' : 'other',
      taxable: typeValue === 'PAYROLL',
    }
    if (date !== undefined) result.date = date
    if (netAmount !== undefined) result.netAmount = netAmount
    if (source !== undefined) result.source = source
    return result
  },

  isCredit(row: Partial<CandidateRow>, prevBalance: number | null): boolean {
    // Primary: sign of netAmount
    if (row.netAmount !== undefined && row.netAmount !== 0) {
      return row.netAmount > 0
    }
    // Fallback: balance delta (D-04)
    if (row.balanceAfter != null && prevBalance != null) {
      return row.balanceAfter > prevBalance
    }
    // Last resort: no signal — default to false (conservative)
    return false
  },
}
