// Wave 0 scaffold — parseStatement tests. These go green when plan 02-02 lands.
// The gold fixture strings are reproduced inline to avoid node:fs in the browser
// tsconfig. The fixture file itself (checking-may-2026.txt) is verified by the
// Task 3 acceptance test in storage.test.ts.
import { describe, it, expect } from 'vitest'

// Gold fixture data — sourced from 02-CONTEXT.md figures.
// Reconcile against Ian's real paste during UAT.
const GOLD_FIXTURE_LINES = [
  'Date\tDescription\tAmount\tBalance',
  '05/01/2026\tGLI EAST LANSING\t1,127.51\t3,127.51',
  '\tTYPE: PAYROLL',
  '\tCO: GLI EAST LANSING',
  '\tID: 1234567890',
  '05/10/2026\tACH Deposit VANGUARD SELL\t3,000.00\t6,127.51',
  '05/12/2026\tCashback Redeemed from L30\t223.97\t6,351.48',
  '05/15/2026\tGLI EAST LANSING\t1,296.59\t7,648.07',
  '\tTYPE: PAYROLL',
  '\tCO: GLI EAST LANSING',
  '\tID: 1234567891',
  '05/18/2026\tACH Deposit VENMO CASHOUT\t600.00\t8,248.07',
  '05/22/2026\tACH Deposit VENMO CASHOUT\t350.00\t8,598.07',
]

describe('parseStatement (plan 02-02)', () => {
  it('gold fixture inline data contains required strings', () => {
    const text = GOLD_FIXTURE_LINES.join('\n')
    expect(text).toContain('GLI EAST LANSING')
    expect(text).toContain('1,127.51')
    expect(text).toContain('1,296.59')
    expect(text).toContain('VANGUARD SELL')
    expect(text).toContain('VENMO')
    expect(text).toContain('TYPE: PAYROLL')
  })

  it.todo('parseStatement returns CandidateRow[] from the gold fixture')
  it.todo('GLI EAST LANSING rows have isCredit=true, source="GLI EAST LANSING"')
  it.todo('VANGUARD SELL row is included in output (non-income credits are not filtered at parse time)')
  it.todo('all rows have a non-empty raw field containing the original line')
  it.todo('empty input returns []')
  it.todo('malformed lines do not throw — they are skipped or returned with missing optional fields')
})

