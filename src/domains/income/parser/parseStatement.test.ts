// Wave 0 scaffold — parseStatement tests. These go green when plan 02-02 lands.
// The gold fixture strings are reproduced inline to avoid node:fs in the browser
// tsconfig. The fixture file itself (checking-may-2026.txt) is verified by the
// Task 3 acceptance test in storage.test.ts.
import { describe, it, expect } from 'vitest'
import { parseStatement } from './parseStatement'
import { checkingAdapter } from './checkingAdapter'

// Gold fixture data — sourced from 02-CONTEXT.md figures.
// Reconcile against Ian's real paste during UAT.
const GOLD_FIXTURE_LINES = [
  'Date\tDescription\tAmount\tBalance',
  '05/01/2026\tGLI EAST LANSING\t1,127.51\t3,127.51',
  '\tTYPE: PAYROLL',
  '\tCO: GLI EAST LANSING',
  '\tID: 1234567890',
  '05/10/2026\tACH Deposit VANGUARD SELL\t3,000.00\t6,127.51',
  '\tTYPE: CREDIT',
  '\tCO: VANGUARD',
  '\tID: 9876543210',
  '05/12/2026\tCashback Redeemed from L30\t223.97\t6,351.48',
  '05/15/2026\tGLI EAST LANSING\t1,296.59\t7,648.07',
  '\tTYPE: PAYROLL',
  '\tCO: GLI EAST LANSING',
  '\tID: 1234567891',
  '05/18/2026\tACH Deposit VENMO CASHOUT\t600.00\t8,248.07',
  '\tTYPE: CREDIT',
  '\tCO: VENMO',
  '\tID: 5555000001',
  '05/22/2026\tACH Deposit VENMO CASHOUT\t350.00\t8,598.07',
  '\tTYPE: CREDIT',
  '\tCO: VENMO',
  '\tID: 5555000002',
]

const GOLD_FIXTURE_TEXT = GOLD_FIXTURE_LINES.join('\n')

describe('parseStatement (plan 02-02)', () => {
  it('gold fixture inline data contains required strings', () => {
    const text = GOLD_FIXTURE_TEXT
    expect(text).toContain('GLI EAST LANSING')
    expect(text).toContain('1,127.51')
    expect(text).toContain('1,296.59')
    expect(text).toContain('VANGUARD SELL')
    expect(text).toContain('VENMO')
    expect(text).toContain('TYPE: PAYROLL')
  })

  it('parseStatement returns CandidateRow[] from the gold fixture', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    expect(Array.isArray(rows)).toBe(true)
    // 6 date-blocks in the fixture
    expect(rows).toHaveLength(6)
  })

  it('GLI EAST LANSING rows have isCredit=true, netAmount and source set', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    const payrollRows = rows.filter((r) => r.source === 'GLI EAST LANSING')
    expect(payrollRows).toHaveLength(2)
    payrollRows.forEach((r) => {
      expect(r.isCredit).toBe(true)
    })
    // D-03: dates are ISO
    const pr0 = payrollRows[0]
    const pr1 = payrollRows[1]
    expect(pr0).toBeDefined()
    expect(pr1).toBeDefined()
    expect(pr0!.date).toBe('2026-05-01')
    expect(pr0!.netAmount).toBeCloseTo(1127.51, 2)
    expect(pr1!.date).toBe('2026-05-15')
    expect(pr1!.netAmount).toBeCloseTo(1296.59, 2)
  })

  it('VANGUARD SELL row is included in output (non-income credits are not filtered at parse time)', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    const vanguard = rows.find((r) => r.raw.includes('VANGUARD'))
    expect(vanguard).toBeDefined()
    if (vanguard) {
      expect(vanguard.isCredit).toBe(true) // positive amount → credit
      expect(vanguard.netAmount).toBeCloseTo(3000, 2)
    }
  })

  it('all rows have a non-empty raw field containing the original line', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    rows.forEach((r) => {
      expect(typeof r.raw).toBe('string')
      expect(r.raw.trim().length).toBeGreaterThan(0)
    })
  })

  it('empty input returns []', () => {
    expect(parseStatement('', checkingAdapter)).toEqual([])
    expect(parseStatement('   \n  \n', checkingAdapter)).toEqual([])
  })

  it('malformed lines do not throw — they are skipped or returned with missing optional fields', () => {
    const weirdInput = 'not a date line\nsome garbage\n05/01/2026\tONLY ONE COLUMN'
    expect(() => parseStatement(weirdInput, checkingAdapter)).not.toThrow()
    const rows = parseStatement(weirdInput, checkingAdapter)
    // The date-keyed block is included, possibly with undefined optional fields
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('input longer than 1,000,000 chars is rejected (DoS cap T-02-D)', () => {
    const huge = 'x'.repeat(1_000_001)
    expect(() => parseStatement(huge, checkingAdapter)).toThrow()
  })

  it('VENMO rows have source derived from CO: metadata', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    const venmoRows = rows.filter((r) => r.source === 'VENMO')
    expect(venmoRows).toHaveLength(2)
  })

  it('Cashback row uses first description line when no CO: line', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    const cashback = rows.find((r) => r.raw.includes('Cashback'))
    expect(cashback).toBeDefined()
    if (cashback) {
      expect(cashback.source).toBeTruthy()
    }
  })

  it('balanceAfter is parsed correctly from trailing numbers', () => {
    const rows = parseStatement(GOLD_FIXTURE_TEXT, checkingAdapter)
    const first = rows[0]
    expect(first).toBeDefined()
    if (first) {
      expect(first.balanceAfter).toBeCloseTo(3127.51, 2)
    }
  })
})
