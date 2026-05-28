// IncomeBar component tests — plan 02-04.
// RED: Tests written before IncomeBar.tsx exists — all except smoke should fail.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import IncomeBar from './IncomeBar'

describe('IncomeBar', () => {
  it('test file exists and is importable', () => {
    expect(true).toBe(true)
  })

  it('renders role=meter with aria-valuenow and aria-valuemax matching mtdTotal and projectedMonth', () => {
    render(
      <IncomeBar
        mtdTotal={2424.10}
        projectedMonth={2424.10}
        passiveFloor={2400}
        defendedLine={3000}
      />,
    )
    const meter = screen.getByRole('meter')
    expect(meter).toBeDefined()
    // aria-valuenow should be the mtdTotal (2424.1)
    const valuenow = meter.getAttribute('aria-valuenow')
    expect(Number(valuenow)).toBeCloseTo(2424.1, 1)
    // aria-valuemax should be the projectedMonth (2424.1)
    const valuemax = meter.getAttribute('aria-valuemax')
    expect(Number(valuemax)).toBeCloseTo(2424.1, 1)
    // aria-valuemin should be 0
    expect(meter.getAttribute('aria-valuemin')).toBe('0')
  })

  it('has aria-label "Month-to-date income"', () => {
    render(
      <IncomeBar
        mtdTotal={1000}
        projectedMonth={2000}
        passiveFloor={1800}
        defendedLine={3000}
      />,
    )
    const meter = screen.getByRole('meter')
    expect(meter.getAttribute('aria-label')).toBe('Month-to-date income')
  })

  it('renders passive floor label "floor"', () => {
    render(
      <IncomeBar
        mtdTotal={1500}
        projectedMonth={2500}
        passiveFloor={2000}
        defendedLine={3000}
      />,
    )
    expect(screen.getByText('floor')).toBeDefined()
  })

  it('renders defended line label "$3k"', () => {
    render(
      <IncomeBar
        mtdTotal={1500}
        projectedMonth={2500}
        passiveFloor={2000}
        defendedLine={3000}
      />,
    )
    expect(screen.getByText('$3k')).toBeDefined()
  })

  it('renders empty state at 0 fill when mtdTotal is 0', () => {
    render(
      <IncomeBar
        mtdTotal={0}
        projectedMonth={0}
        passiveFloor={2400}
        defendedLine={3000}
      />,
    )
    const meter = screen.getByRole('meter')
    expect(Number(meter.getAttribute('aria-valuenow'))).toBe(0)
  })
})
