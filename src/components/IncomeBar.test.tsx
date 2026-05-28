// Wave 0 scaffold — IncomeBar component tests. These go green when plan 02-04 lands.
import { describe, it, expect } from 'vitest'

describe('IncomeBar (plan 02-04)', () => {
  it('test file exists and is importable', () => {
    // Smoke test: file is wired into the test runner before the component exists.
    expect(true).toBe(true)
  })

  it.todo('renders passive floor marker at the correct proportional position')
  it.todo('renders defended floor marker at the correct proportional position')
  it.todo('renders mtdPayroll fill bar')
  it.todo('renders projectedMonth indicator')
  it.todo('backfillActive=true adds a visual indicator (aria-label or class)')
  it.todo('amounts are formatted as USD with font-mono class')
  it.todo('component is accessible — all visual markers have aria-labels')
  it.todo('renders empty/loading state when income data is loading')
})
