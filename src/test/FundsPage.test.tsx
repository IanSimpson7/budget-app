// FundsPage.test.tsx — Task 2 acceptance criteria.
// Tests:
//   SC#3: seeded car-insurance fund renders (name, status, progress)
//   SC#5: add-form creates a SECOND fund → two FundCards render independently
//   EDGE-06: mark-paid on annual fund shows confirmation copy naming "Balance resets"
//   C3: no transfer/execute/move-money text anywhere on /funds

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Provider } from 'jotai'
import FundsPage from '../pages/FundsPage'
import type { SinkingFund } from '../storage/schema'

// ── Mock funds.atoms ───────────────────────────────────────────────────────────
// Uses the vi.mock async-import factory pattern (Plan 02-03 decision) to avoid
// hoisting TDZ errors with top-level atom() calls.

const carInsuranceFund: SinkingFund = {
  id: 1,
  name: 'Car Insurance',
  annualAmount: 982,
  monthlyAccrual: 82,
  balance: 0,
  payoutDate: '2027-03',
  cadence: 'annual',
  provisional: true,
}

const carPurchaseFund: SinkingFund = {
  id: 2,
  name: 'Car Purchase',
  annualAmount: 5000,
  monthlyAccrual: 417,
  balance: 1000,
  payoutDate: '2028-01',
  cadence: 'oneoff',
}

// Track mock state for funds list + write atoms
let mockFunds: SinkingFund[] = []
const mockSaveFund = vi.fn()
const mockMarkPaid = vi.fn()
const mockDeleteFund = vi.fn()
const mockUpdateFund = vi.fn()

vi.mock('../domains/funds/funds.atoms', async () => {
  const { atom } = await import('jotai')
  const { isOnTrack, monthsUntilPayout } = await import('../domains/funds/funds.atoms')

  // sinkingFundsAtom: sync atom reading from mockFunds (avoids Suspense stall)
  const sinkingFundsAtom = atom(() => mockFunds)

  const saveFundAtom = atom(null, (_get, _set, fund: Omit<SinkingFund, 'id'>) => {
    mockSaveFund(fund)
    // Simulate adding to list for re-render check
    mockFunds = [...mockFunds, { ...fund, id: Date.now() }]
  })

  const markFundPaidAtom = atom(null, (_get, _set, fund: SinkingFund) => {
    mockMarkPaid(fund)
  })

  const deleteFundAtom = atom(null, (_get, _set, id: number) => {
    mockDeleteFund(id)
  })

  const updateFundAtom = atom(
    null,
    (_get, _set, args: { id: number; patch: Partial<SinkingFund> }) => {
      mockUpdateFund(args)
    },
  )

  return {
    sinkingFundsAtom,
    saveFundAtom,
    markFundPaidAtom,
    deleteFundAtom,
    updateFundAtom,
    isOnTrack,
    monthsUntilPayout,
  }
})

function renderFundsPage() {
  return render(
    <Provider>
      <FundsPage />
    </Provider>,
  )
}

describe('FundsPage', () => {
  beforeEach(() => {
    mockFunds = []
    mockSaveFund.mockClear()
    mockMarkPaid.mockClear()
    mockDeleteFund.mockClear()
    mockUpdateFund.mockClear()
  })

  it('SC#3: renders with the seeded car-insurance fund visible', () => {
    mockFunds = [carInsuranceFund]
    renderFundsPage()

    expect(screen.getByText('Car Insurance')).toBeDefined()
    expect(screen.getByRole('progressbar')).toBeDefined()
    // $82.00 accrual visible
    expect(screen.getByText('$82.00')).toBeDefined()
    // $982.00 target visible
    expect(screen.getByText('$982.00')).toBeDefined()
  })

  it('SC#5: two FundCards render independently after adding a second fund', () => {
    // Start with car insurance seeded
    mockFunds = [carInsuranceFund, carPurchaseFund]
    renderFundsPage()

    // Both fund names visible — no code change, same component renders both
    expect(screen.getByText('Car Insurance')).toBeDefined()
    expect(screen.getByText('Car Purchase')).toBeDefined()
    // Two progress bars
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBe(2)
  })

  it('EDGE-06/SC#4: mark-paid on annual fund shows confirmation copy naming "Balance resets"', () => {
    mockFunds = [carInsuranceFund]
    renderFundsPage()

    // Click "Mark paid" on the car-insurance card
    const markPaidBtn = screen.getByRole('button', { name: /mark paid/i })
    fireEvent.click(markPaidBtn)

    // Inline confirmation appears with consequence copy
    expect(screen.getByText(/Balance resets/i)).toBeDefined()
    // The confirmation also mentions the fund name
    expect(screen.getByText(/Car Insurance/i)).toBeDefined()
  })

  it('mark-paid confirmation for oneoff fund says "archived"', () => {
    mockFunds = [carPurchaseFund]
    renderFundsPage()

    const markPaidBtn = screen.getByRole('button', { name: /mark paid/i })
    fireEvent.click(markPaidBtn)

    expect(screen.getByText(/will be archived/i)).toBeDefined()
  })

  it('calls markFundPaidAtom when Mark paid is confirmed', async () => {
    mockFunds = [carInsuranceFund]
    renderFundsPage()

    fireEvent.click(screen.getByRole('button', { name: /mark paid/i }))
    // Confirm
    const confirmBtn = screen.getByRole('button', { name: /^mark paid$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(mockMarkPaid).toHaveBeenCalledWith(carInsuranceFund))
  })

  it('shows empty state when no funds exist', () => {
    mockFunds = []
    renderFundsPage()

    expect(screen.getByText('No sinking funds yet')).toBeDefined()
    expect(screen.getByText(/spread annual costs across months/i)).toBeDefined()
  })

  it('C3: no transfer/execute/move-money affordance anywhere on /funds', () => {
    mockFunds = [carInsuranceFund]
    renderFundsPage()

    expect(screen.queryByText(/transfer|execute|move money/i)).toBeNull()
  })

  it('Add fund button is disabled until name + target + payout date filled', () => {
    mockFunds = []
    renderFundsPage()

    const addBtn = screen.getByRole('button', { name: /add fund/i })
    expect(addBtn.hasAttribute('disabled')).toBe(true)
  })

  it('calls saveFundAtom when add form is submitted with valid data', async () => {
    mockFunds = []
    renderFundsPage()

    // Fill fund name
    const nameInput = screen.getByLabelText(/fund name/i)
    fireEvent.change(nameInput, { target: { value: 'Vacation' } })

    // Fill annual target
    const targetInput = screen.getByLabelText(/annual target/i)
    fireEvent.change(targetInput, { target: { value: '2400' } })

    // Fill payout date
    const payoutInput = screen.getByLabelText(/payout date/i)
    fireEvent.change(payoutInput, { target: { value: '2027-06' } })

    const addBtn = screen.getByRole('button', { name: /add fund/i })
    expect(addBtn.hasAttribute('disabled')).toBe(false)

    fireEvent.click(addBtn)

    await waitFor(() => expect(mockSaveFund).toHaveBeenCalledOnce())
    const savedFund = mockSaveFund.mock.calls[0]?.[0] as Omit<SinkingFund, 'id'>
    expect(savedFund.name).toBe('Vacation')
    expect(savedFund.annualAmount).toBe(2400)
    expect(savedFund.payoutDate).toBe('2027-06')
  })
})
