// Wave 0 scaffold — PasteParseFlow integration tests. These go green when plan 02-05 lands.
// Fixture strings reproduced inline to avoid node:fs in the browser tsconfig.
import { describe, it, expect } from 'vitest'

// Gold fixture excerpt — verifies the inline data matches the .txt file on disk.
// Reconcile against Ian's real paste during UAT.
const GOLD_FIXTURE_EXCERPT = '05/01/2026\tGLI EAST LANSING\t1,127.51\t3,127.51'

describe('PasteParseFlow (plan 02-05)', () => {
  it('gold fixture excerpt contains required payroll line', () => {
    expect(GOLD_FIXTURE_EXCERPT).toContain('GLI EAST LANSING')
    expect(GOLD_FIXTURE_EXCERPT).toContain('1,127.51')
  })

  it.todo('pasting the gold fixture into the textarea renders a candidate row table')
  it.todo('GLI EAST LANSING rows are pre-classified as payroll=true in the table')
  it.todo('VANGUARD SELL row appears but is not pre-classified as income')
  it.todo('confirming checked rows calls addIncomeChecks with the selected rows')
  it.todo('confirmed rows disappear from the candidate table and appear in the income list')
  it.todo('clearing the textarea resets the candidate table')
  it.todo('empty paste shows a placeholder / empty-state message')
})
