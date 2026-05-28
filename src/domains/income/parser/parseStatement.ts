// D-02..D-04: Pure statement parser.
// Input: raw pasted bank-statement text + a StatementAdapter.
// Output: CandidateRow[] — one entry per date-keyed transaction block.
//
// Security T-02-D: Input capped at 1,000,000 chars to bound DoS.
// All regexes are anchored module-level constants — no catastrophic backtracking.
// Empty or header-only input returns [] (no crash path).
import type { CandidateRow } from '../income.types'
import type { StatementAdapter } from './adapter.types'

// D-02: A block starts on a line matching MM/DD/YYYY at the start.
const DATE_LINE = /^\d{2}\/\d{2}\/\d{4}/
// D-02: Skip the leading header row.
const HEADER = /^date\s+description\s+amount\s+balance/i

/** Maximum permitted input length (T-02-D DoS cap). */
const MAX_INPUT_LENGTH = 1_000_000

/**
 * Parse a pasted bank statement into an array of candidate rows.
 * Pure function — no I/O, no side effects (satisfies C2 by construction).
 *
 * @param text   Raw pasted text from the bank's statement view.
 * @param adapter Format-specific field extractor (D-01 seam).
 * @returns CandidateRow[] — one per date-keyed block; header/blank lines skipped.
 * @throws {RangeError} if input exceeds MAX_INPUT_LENGTH (T-02-D).
 */
export function parseStatement(text: string, adapter: StatementAdapter): CandidateRow[] {
  if (text.length > MAX_INPUT_LENGTH) {
    throw new RangeError(
      `Input exceeds ${MAX_INPUT_LENGTH.toLocaleString()} characters; truncate before parsing.`,
    )
  }

  const lines = text.split(/\r?\n/).map((l) => l.trimEnd())

  // ── Phase 1: Accumulate blocks ──────────────────────────────────────────────
  // A block begins at a DATE_LINE and accumulates all following lines until
  // the next DATE_LINE or EOF (D-02).
  const blocks: string[][] = []
  let cur: string[] | null = null

  for (const line of lines) {
    if (!line.trim() || HEADER.test(line)) continue // skip blanks + header
    if (DATE_LINE.test(line)) {
      cur = [line]
      blocks.push(cur)
    } else if (cur) {
      cur.push(line) // metadata (TYPE:/ID:/CO:) belongs to current block
    }
    // Lines before the first date-block are silently dropped
  }

  if (blocks.length === 0) return []

  // ── Phase 2: Map blocks → CandidateRow[] ────────────────────────────────────
  let prevBalance: number | null = null

  return blocks.map((block): CandidateRow => {
    const fields = adapter.extractFields(block)
    const isCredit = adapter.isCredit(fields, prevBalance)

    if (fields.balanceAfter != null) {
      prevBalance = fields.balanceAfter
    }

    return {
      // Defaults for required fields (classify.ts resolves checked + category later)
      category: 'other',
      taxable: false,
      checked: false,
      // Spread adapter-extracted fields (may override category/taxable for e.g. PAYROLL)
      ...fields,
      isCredit,
      raw: block.join('\n'),
    }
  })
}
