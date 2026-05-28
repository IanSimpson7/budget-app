// D-01: StatementAdapter interface — Phase-3 seam.
// Phase 2 builds the checkingAdapter only. Phase 3 adds a creditCardAdapter
// that implements the same interface. The pipeline (parseStatement) is
// account/format-agnostic and never changes shape when new adapters land.
import type { CandidateRow } from '../income.types'

export interface StatementAdapter {
  readonly statementType: 'checking' | 'creditcard'

  /**
   * Given all lines that make up a single date-keyed block, extract the
   * structured fields. Returns a Partial<CandidateRow> — required fields
   * (isCredit, checked, category, taxable, raw) are resolved by parseStatement
   * after this call.
   */
  extractFields(block: string[]): Partial<CandidateRow>

  /**
   * Determine whether the transaction is a credit (money in).
   * Primary signal: sign of netAmount in `row` (positive → credit).
   * Fallback when netAmount is zero/undefined: sign of balanceAfter − prevBalance.
   */
  isCredit(row: Partial<CandidateRow>, prevBalance: number | null): boolean
}
