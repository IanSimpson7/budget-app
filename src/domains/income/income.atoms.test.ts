// Wave 0 scaffold — income atoms tests. These go green when plan 02-03 lands.
import { describe, it, expect } from 'vitest'
import type { IncomeCheck } from './income.types'

// Typed reference to the May-2026 gold scenario (figures from 02-CONTEXT.md).
const MAY_2026_CHECKS: Omit<IncomeCheck, 'id'>[] = [
  {
    date: '2026-05-01',
    netAmount: 1127.51,
    source: 'GLI EAST LANSING',
    note: 'TYPE: PAYROLL\nCO: GLI EAST LANSING\nID: 1234567890',
    category: 'payroll',
    taxable: true,
  },
  {
    date: '2026-05-15',
    netAmount: 1296.59,
    source: 'GLI EAST LANSING',
    note: 'TYPE: PAYROLL\nCO: GLI EAST LANSING\nID: 1234567891',
    category: 'payroll',
    taxable: true,
  },
]

describe('income atoms (plan 02-03)', () => {
  it('MAY_2026_CHECKS fixture has two payroll checks summing to 2424.10', () => {
    const total = MAY_2026_CHECKS.reduce((sum, c) => sum + c.netAmount, 0)
    expect(total).toBeCloseTo(2424.10, 2)
    expect(MAY_2026_CHECKS.every((c) => c.category === 'payroll')).toBe(true)
  })

  it.todo('incomeChecksAtom yields IncomeCheck[] from storage (observeIncomeChecks)')
  it.todo('mtdPayrollAtom sums checks where category=payroll in current month')
  it.todo('mtdTotalAtom sums ALL income checks regardless of category')
  it.todo('landedPayrollCountAtom counts payroll checks in current month')
  it.todo('May-2026 scenario: mtdPayroll = 2424.10, landedPayrollCount = 2')
  it.todo('projectedMonthPayrollAtom = mtdPayroll when landedPayrollCount >= 2')
  it.todo('backfillActiveAtom = true when projectedMonthPayroll < defendedLine (EDGE-01)')
  it.todo('surplusAtom = 0 when no 3rd payroll check (INC-04)')
})
