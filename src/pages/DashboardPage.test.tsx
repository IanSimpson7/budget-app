// DashboardPage tests — plan 02-04 acceptance criteria.
// Verifies:
//   1. BackfillAlertCard (role=alert) renders when backfillActiveAtom is true
//   2. Income bar (role=meter) renders with correct aria-label
//   3. Section heading contains "Income ·"
//   4. "Add check" button present
//   5. Empty-month render does not throw
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider, createStore } from 'jotai'
import DashboardPage from './DashboardPage'

// ── Mock storage so no real IDB is needed ──────────────────────────────────────
vi.mock('../storage/storage', () => ({
  observeIncomeChecks: vi.fn(() => ({
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  })),
  getEstimatePerCheck: vi.fn(() => Promise.resolve(0)),
  getFloors: vi.fn(() => Promise.resolve({ passive: 2400, defended: 3000, foodSeed: 550 })),
  getKnownSources: vi.fn(() => Promise.resolve([])),
}))

// ── Mock settings atoms (sync init — no Suspense) ────────────────────────────
vi.mock('../domains/settings/settings.atoms', () => ({
  floorsLoadAtom: {
    init: { passive: 2400, defended: 3000, foodSeed: 550 },
    read: () => ({ passive: 2400, defended: 3000, foodSeed: 550 }),
  },
  saveFloorsAtom: { init: null },
  derivedSurvivalFloorAtom: { init: 2400, read: () => 2400 },
}))

// ── Mock income atoms — all values inlined to avoid top-level var hoisting issue
vi.mock('../domains/income/income.atoms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domains/income/income.atoms')>()
  // May-2026 fixture: payroll 2424.10, backfill active (< defended 3000)
  const singleCheck = {
    id: 1,
    date: '2026-05-01',
    netAmount: 1127.51,
    category: 'payroll' as const,
    taxable: true,
    source: 'GLI',
    checked: true,
  }
  return {
    ...actual,
    incomeChecksAtom: { init: [singleCheck], read: () => [singleCheck] },
    currentMonthChecksAtom: { init: [singleCheck], read: () => [singleCheck] },
    mtdTotalAtom: { init: 2424.1, read: () => 2424.1 },
    projectedTotalAtom: { init: 2424.1, read: () => 2424.1 },
    projectedMonthPayrollAtom: { init: 2424.1, read: () => 2424.1 },
    surplusAtom: { init: 24.1, read: () => 24.1 },
    // backfillActive = true: payroll 2424.10 < defended 3000
    backfillActiveAtom: { init: true, read: () => true },
    knownSourcesAtom: { init: [], read: () => [] },
    saveIncomeCheckAtom: { init: null },
  }
})

function renderDashboard() {
  const store = createStore()
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('DashboardPage', () => {
  it('renders BackfillAlertCard (role=alert) when backfillActive is true', () => {
    // May-2026 fixture: backfillActive = true (payroll 2424.10 < defended 3000)
    renderDashboard()
    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(alert.textContent).toContain('below $3,000 — add sessions to defend')
  })

  it('renders income bar with role=meter and aria-label', () => {
    renderDashboard()
    const meter = screen.getByRole('meter')
    expect(meter).toBeDefined()
    expect(meter.getAttribute('aria-label')).toBe('Month-to-date income')
  })

  it('renders section heading containing "Income ·"', () => {
    renderDashboard()
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toContain('Income ·')
  })

  it('renders "Add check" button', () => {
    renderDashboard()
    expect(screen.getByText('Add check')).toBeDefined()
  })

  it('does not throw when rendered (verifies no crash path)', () => {
    expect(() => renderDashboard()).not.toThrow()
  })
})
