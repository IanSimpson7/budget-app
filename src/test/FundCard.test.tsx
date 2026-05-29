// FundCard.test.tsx — Task 1 acceptance criteria.
// Tests:
//   - renders car-insurance fund (balance 0, accrual 82, target 982, payout 2027-03)
//   - status text "Behind" when balance=0 against 2027-03 payout
//   - role="progressbar" with correct aria-valuemax
//   - provisional advisory renders when provisional=true
//   - C3 structural check: no transfer/execute/move-money text

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FundCard from '../components/FundCard'
import type { SinkingFund } from '../storage/schema'

// Mock funds.atoms so isOnTrack uses the real logic without IDB setup.
// The real isOnTrack is a pure function — we import it directly.
vi.mock('../domains/funds/funds.atoms', async () => {
  const actual = await import('../domains/funds/funds.atoms')
  return actual
})

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

const noop = () => undefined

describe('FundCard', () => {
  it('renders the car-insurance fund with all expected fields', () => {
    render(<FundCard fund={carInsuranceFund} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)

    expect(screen.getByText('Car Insurance')).toBeDefined()
    // balance $0.00, target $982.00, accrual $82.00
    expect(screen.getByText('$0.00')).toBeDefined()
    expect(screen.getByText('$982.00')).toBeDefined()
    expect(screen.getByText('$82.00')).toBeDefined()
    // payout date label
    expect(screen.getByText(/Due March 2027/i)).toBeDefined()
  })

  it('shows "Behind" status when balance=0 with months remaining until payout', () => {
    render(<FundCard fund={carInsuranceFund} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)
    // balance=0, months to March 2027 > 0 → projected < 982 → Behind
    expect(screen.getByText('Behind')).toBeDefined()
  })

  it('renders role="progressbar" with correct aria-valuemax', () => {
    render(<FundCard fund={carInsuranceFund} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuemax')).toBe('982')
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
  })

  it('renders provisional advisory when provisional=true', () => {
    render(<FundCard fund={carInsuranceFund} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)
    expect(screen.getByText(/Target is provisional — update at renewal/i)).toBeDefined()
  })

  it('does NOT render provisional advisory when provisional is absent', () => {
    const { provisional: _omit, ...rest } = carInsuranceFund
    const noProvisional: SinkingFund = rest
    render(<FundCard fund={noProvisional} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)
    expect(screen.queryByText(/provisional/i)).toBeNull()
  })

  it('shows "On track" status when projected balance >= target', () => {
    // balance=982 → projected >= 982 → On track
    const funded: SinkingFund = { ...carInsuranceFund, balance: 982 }
    render(<FundCard fund={funded} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)
    expect(screen.getByText('On track')).toBeDefined()
  })

  it('C3: contains no transfer/execute/move-money affordance', () => {
    render(<FundCard fund={carInsuranceFund} onEdit={noop} onMarkPaid={noop} onRemove={noop} />)
    expect(screen.queryByText(/transfer|execute|move money/i)).toBeNull()
  })
})
