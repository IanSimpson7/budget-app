// Wave 0 scaffold — classify tests. These go green when plan 02-02 lands.
import { describe, it, expect } from 'vitest'
import type { CandidateRow } from './income.types'

// Minimal candidate factory for scaffold assertions.
const candidate = (overrides: Partial<CandidateRow> = {}): CandidateRow => ({
  isCredit: true,
  checked: false,
  category: 'other',
  taxable: false,
  raw: 'raw line',
  ...overrides,
})

describe('classify (plan 02-02)', () => {
  it('CandidateRow type is importable from income.types', () => {
    // Type-level check: if the import breaks this test immediately signals it.
    const row = candidate({ source: 'GLI EAST LANSING' })
    expect(row.source).toBe('GLI EAST LANSING')
  })

  it.todo('source "GLI EAST LANSING" → category=payroll, taxable=true')
  it.todo('source from knownSources list is auto-classified to its stored category')
  it.todo('source not in knownSources → category=other, taxable=false (safe default)')
  it.todo('VANGUARD SELL source is not auto-classified as payroll')
  it.todo('VENMO CASHOUT source is classifiable as gift when knownSources has an entry')
})
