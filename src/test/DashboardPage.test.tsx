// DashboardPage tests — SC#2 (survival floor metric card recomputes on expense change).
//
// Covers:
//   - "Survival floor" card renders on the dashboard
//   - "fixed + food seed" subtext renders
//   - Three existing cards (Month to date / Projected month / Surplus|Backfill) still render
//   - survivalFloorAtom value is rendered in the card (SC#2 live recompute verified
//     at atom level in expenses.atoms.test.ts)
//
// Strategy: vi.mock factories create sync Jotai atoms (no async, no Suspense stall).
// All factories use inline atom() calls to avoid hoisting TDZ errors.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider, createStore } from 'jotai'
import DashboardPage from '../pages/DashboardPage'

// Hoisted mock factories — atom() created inside factory to avoid TDZ.
vi.mock('../domains/expenses/expenses.atoms', async () => {
  const { atom } = await import('jotai')
  return {
    survivalFloorAtom: atom(2335),
    expenseItemsAtom: atom([]),
    protectedExpensesAtom: atom([]),
    gateableExpensesAtom: atom([]),
    saveExpenseItemAtom: atom(null, async () => {}),
    updateExpenseItemAtom: atom(null, async () => {}),
    deleteExpenseItemAtom: atom(null, async () => {}),
  }
})

vi.mock('../domains/income/income.atoms', async () => {
  const { atom } = await import('jotai')
  return {
    incomeChecksAtom: atom([]),
    currentMonthChecksAtom: atom([]),
    mtdTotalAtom: atom(0),
    projectedTotalAtom: atom(0),
    projectedMonthPayrollAtom: atom(0),
    surplusAtom: atom(0),
    backfillActiveAtom: atom(false),
    knownSourcesAtom: atom([]),
    saveIncomeCheckAtom: atom(null, async () => {}),
  }
})

vi.mock('../domains/settings/settings.atoms', async () => {
  const { atom } = await import('jotai')
  return {
    floorsLoadAtom: atom({ passive: 2400, defended: 3000, foodSeed: 550 }),
    saveFloorsAtom: atom(null, async () => {}),
    derivedSurvivalFloorAtom: atom(2400),
  }
})

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
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

describe('DashboardPage — Survival floor card (SC#2)', () => {
  it('renders the "Survival floor" metric card label', () => {
    renderDashboard()
    expect(screen.getByText('Survival floor')).toBeInTheDocument()
  })

  it('renders the "fixed + food seed" subtext', () => {
    renderDashboard()
    expect(screen.getByText('fixed + food seed')).toBeInTheDocument()
  })

  it('existing cards still render — Month to date, Projected month, Surplus', () => {
    renderDashboard()
    expect(screen.getByText('Month to date')).toBeInTheDocument()
    expect(screen.getByText('Projected month')).toBeInTheDocument()
    expect(screen.getByText('Surplus')).toBeInTheDocument()
  })

  it('renders the survivalFloorAtom value in the Survival floor card (SC#2)', () => {
    renderDashboard()
    // syncSurvivalFloorAtom is seeded at 2335 → card displays $2,335.00
    const label = screen.getByText('Survival floor')
    const card = label.closest('div') as HTMLElement
    expect(card.textContent).toContain('$2,335.00')
  })

  it('four cards render — no existing card was replaced', () => {
    renderDashboard()
    expect(screen.getByText('Month to date')).toBeInTheDocument()
    expect(screen.getByText('Projected month')).toBeInTheDocument()
    expect(screen.getByText('Surplus')).toBeInTheDocument()
    expect(screen.getByText('Survival floor')).toBeInTheDocument()
  })
})
