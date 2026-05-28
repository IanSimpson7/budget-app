// Wave 0 scaffold — classify tests. These go green when plan 02-02 lands.
import { describe, it, expect } from 'vitest'
import type { CandidateRow, IncomeCheck, KnownSource } from './income.types'
import {
  defaultTaxable,
  isInLocalMonth,
  classifySurplus,
  defaultChecked,
} from './classify'

// Minimal candidate factory for scaffold assertions.
const candidate = (overrides: Partial<CandidateRow> = {}): CandidateRow => ({
  isCredit: true,
  checked: false,
  category: 'other',
  taxable: false,
  raw: 'raw line',
  ...overrides,
})

const check = (overrides: Partial<IncomeCheck> & { id: number }): IncomeCheck => ({
  date: '2026-05-01',
  netAmount: 1000,
  source: 'GLI EAST LANSING',
  note: '',
  category: 'payroll',
  taxable: true,
  ...overrides,
})

describe('classify (plan 02-02)', () => {
  it('CandidateRow type is importable from income.types', () => {
    // Type-level check: if the import breaks this test immediately signals it.
    const row = candidate({ source: 'GLI EAST LANSING' })
    expect(row.source).toBe('GLI EAST LANSING')
  })

  // ── defaultTaxable ──────────────────────────────────────────────────────────
  describe('defaultTaxable', () => {
    it('payroll → taxable true (D-08)', () => {
      expect(defaultTaxable('payroll')).toBe(true)
    })
    it('gift → taxable false (D-08)', () => {
      expect(defaultTaxable('gift')).toBe(false)
    })
    it('other → taxable true (D-08)', () => {
      expect(defaultTaxable('other')).toBe(true)
    })
  })

  // ── isInLocalMonth ──────────────────────────────────────────────────────────
  describe('isInLocalMonth', () => {
    it('same year+month → true', () => {
      const ref = new Date('2026-05-15T12:00:00') // mid May
      expect(isInLocalMonth('2026-05-01', ref)).toBe(true)
      expect(isInLocalMonth('2026-05-31', ref)).toBe(true)
    })
    it('different month → false', () => {
      const ref = new Date('2026-05-15T12:00:00')
      expect(isInLocalMonth('2026-04-30', ref)).toBe(false)
      expect(isInLocalMonth('2026-06-01', ref)).toBe(false)
    })
    it('LOCAL midnight parse: 2026-06-01 classified as June not May', () => {
      // If parsed as UTC, 2026-06-01T00:00:00Z is May 31 at 19:00 US Eastern.
      // With local-midnight parse ('T00:00:00') it is June regardless of timezone.
      const juneRef = new Date('2026-06-15T12:00:00')
      expect(isInLocalMonth('2026-06-01', juneRef)).toBe(true)
      const mayRef = new Date('2026-05-15T12:00:00')
      expect(isInLocalMonth('2026-06-01', mayRef)).toBe(false)
    })
  })

  // ── classifySurplus ─────────────────────────────────────────────────────────
  describe('classifySurplus', () => {
    it('two payroll checks in May → no surplus ids', () => {
      const checks: IncomeCheck[] = [
        check({ id: 1, date: '2026-05-01', netAmount: 1127.51 }),
        check({ id: 2, date: '2026-05-15', netAmount: 1296.59 }),
      ]
      const surplus = classifySurplus(checks)
      expect(surplus.size).toBe(0)
    })

    it('three payroll checks in May → 3rd (by date) is surplus', () => {
      const checks: IncomeCheck[] = [
        check({ id: 1, date: '2026-05-01', netAmount: 1127.51 }),
        check({ id: 2, date: '2026-05-15', netAmount: 1296.59 }),
        check({ id: 3, date: '2026-05-29', netAmount: 1000.00 }),
      ]
      const surplus = classifySurplus(checks)
      expect(surplus.size).toBe(1)
      expect(surplus.has(3)).toBe(true)
    })

    it('surplusOverride=true forces the flag even if count <= 2', () => {
      const checks: IncomeCheck[] = [
        check({ id: 1, date: '2026-05-01', netAmount: 1127.51, surplusOverride: true }),
        check({ id: 2, date: '2026-05-15', netAmount: 1296.59 }),
      ]
      const surplus = classifySurplus(checks)
      expect(surplus.has(1)).toBe(true)
    })

    it('gift checks are NOT counted in the payroll surplus baseline', () => {
      const checks: IncomeCheck[] = [
        check({ id: 1, date: '2026-05-01', netAmount: 1127.51, category: 'payroll' }),
        check({ id: 2, date: '2026-05-15', netAmount: 1296.59, category: 'payroll' }),
        check({ id: 3, date: '2026-05-18', netAmount: 600.00, category: 'gift', taxable: false }),
      ]
      const surplus = classifySurplus(checks)
      // Gift check should never be surplus-flagged by count rule (it's not payroll)
      expect(surplus.has(3)).toBe(false)
    })

    it('month classification uses LOCAL calendar month (Pitfall 2)', () => {
      // Two payroll in May, one dated 2026-06-01 — should NOT be counted in May
      const checksInMay: IncomeCheck[] = [
        check({ id: 1, date: '2026-05-01', netAmount: 1127.51 }),
        check({ id: 2, date: '2026-05-15', netAmount: 1296.59 }),
        check({ id: 3, date: '2026-06-01', netAmount: 1000.00 }),
      ]
      // classifySurplus works on all checks; June check is in different month
      const surplus = classifySurplus(checksInMay)
      expect(surplus.has(3)).toBe(false) // June check is NOT the 3rd May payroll
    })
  })

  // ── defaultChecked ──────────────────────────────────────────────────────────
  describe('defaultChecked', () => {
    const knownSources: KnownSource[] = [
      { source: 'GLI EAST LANSING', category: 'payroll', taxable: true },
      { source: 'VENMO', category: 'gift', taxable: false },
    ]

    it('PAYROLL credit → checked=true (TYPE:PAYROLL in raw)', () => {
      const row = candidate({ isCredit: true, category: 'payroll', raw: 'GLI EAST LANSING\nTYPE: PAYROLL\nCO: GLI EAST LANSING' })
      expect(defaultChecked(row, knownSources)).toBe(true)
    })

    it('known-source credit → checked=true', () => {
      const row = candidate({ isCredit: true, source: 'GLI EAST LANSING' })
      expect(defaultChecked(row, knownSources)).toBe(true)
    })

    it('unknown credit (VANGUARD SELL) → checked=false (D-05 conservative)', () => {
      const row = candidate({ isCredit: true, source: 'VANGUARD SELL', raw: 'VANGUARD SELL\nTYPE: CREDIT' })
      expect(defaultChecked(row, knownSources)).toBe(false)
    })

    it('VENMO credit (known gift source) → checked=true', () => {
      const row = candidate({ isCredit: true, source: 'VENMO', raw: 'VENMO CASHOUT' })
      expect(defaultChecked(row, knownSources)).toBe(true)
    })

    it('cashback credit (unknown source, no TYPE:PAYROLL) → checked=false', () => {
      const row = candidate({ isCredit: true, source: 'Cashback Redeemed from L30', raw: 'Cashback Redeemed from L30' })
      expect(defaultChecked(row, knownSources)).toBe(false)
    })

    it('debit → checked=false regardless of source', () => {
      const row = candidate({ isCredit: false, source: 'GLI EAST LANSING', raw: 'GLI EAST LANSING\nTYPE: PAYROLL' })
      expect(defaultChecked(row, knownSources)).toBe(false)
    })
  })
})
