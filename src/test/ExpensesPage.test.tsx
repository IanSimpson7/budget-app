// ExpensesPage tests — SC#1 (add form + categorized view) + EXP-07 advisory.
//
// Covers:
//   - Renders page heading "Expenses"
//   - Submitting the add form with classification=PROTECTED → item appears in Protected column
//   - Submitting the add form with classification=GATEABLE → item appears in Gateable column
//   - Typing "whey protein" surfaces EXP-07 advisory text
//   - EXP-07 advisory: "Add expense" button remains ENABLED (C1 — soft advisory, no hard block)
//
// Pattern: MemoryRouter + Suspense + Jotai Provider (fresh store per test).
// Fresh DB via Dexie.delete('BudgetApp') in beforeEach.

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { Suspense } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'jotai'
import ExpensesPage from '../pages/ExpensesPage'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

function renderExpensesPage() {
  return render(
    <Provider>
      <MemoryRouter>
        <Suspense fallback={<div>loading</div>}>
          <ExpensesPage />
        </Suspense>
      </MemoryRouter>
    </Provider>,
  )
}

describe('ExpensesPage', () => {
  it('renders the page heading', async () => {
    renderExpensesPage()
    expect(await screen.findByRole('heading', { name: /expenses/i, level: 2 })).toBeInTheDocument()
  })

  it('shows "Add expense" button disabled until name and amount are filled', async () => {
    renderExpensesPage()
    const btn = await screen.findByRole('button', { name: /add expense/i })
    // Initially disabled (name='', amount=0)
    expect(btn).toBeDisabled()
  })

  it('adds a PROTECTED expense and it appears in the Protected column', async () => {
    const user = userEvent.setup()
    renderExpensesPage()

    // Fill name
    const nameInput = await screen.findByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Housing')

    // Fill amount
    const amountInput = screen.getByLabelText(/^amount$/i)
    await user.clear(amountInput)
    await user.type(amountInput, '1300')

    // Classification default is PROTECTED — verify button is pressed
    const protectedBtn = screen.getByRole('button', { name: /protected/i })
    expect(protectedBtn).toHaveAttribute('aria-pressed', 'true')

    // Submit
    const addBtn = screen.getByRole('button', { name: /add expense/i })
    expect(addBtn).not.toBeDisabled()
    await user.click(addBtn)

    // Item should appear in the Protected column (find by heading role)
    await waitFor(() => {
      const protectedHeading = screen.getByRole('heading', { name: /^protected$/i, level: 3 })
      const column = protectedHeading.closest('div') as HTMLElement
      expect(within(column).getByText('Housing')).toBeInTheDocument()
    })
  })

  it('adds a GATEABLE expense and it appears in the Gateable column', async () => {
    const user = userEvent.setup()
    renderExpensesPage()

    // Fill name
    const nameInput = await screen.findByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Dining Out')

    // Fill amount
    const amountInput = screen.getByLabelText(/^amount$/i)
    await user.clear(amountInput)
    await user.type(amountInput, '200')

    // Switch to GATEABLE
    const gateableBtn = screen.getByRole('button', { name: /gateable/i })
    await user.click(gateableBtn)
    expect(gateableBtn).toHaveAttribute('aria-pressed', 'true')

    // Submit
    const addBtn = screen.getByRole('button', { name: /add expense/i })
    await user.click(addBtn)

    // Item should appear in the Gateable column (find by heading role)
    await waitFor(() => {
      const gateableHeading = screen.getByRole('heading', { name: /^gateable$/i, level: 3 })
      const column = gateableHeading.closest('div') as HTMLElement
      expect(within(column).getByText('Dining Out')).toBeInTheDocument()
    })
  })

  it('shows EXP-07 advisory when name contains "whey protein"', async () => {
    const user = userEvent.setup()
    renderExpensesPage()

    const nameInput = await screen.findByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'whey protein')

    expect(
      screen.getByText(/supplement costs belong in the food floor/i),
    ).toBeInTheDocument()
  })

  it('EXP-07 advisory: "Add expense" button remains enabled after typing whey (C1 — no hard block)', async () => {
    const user = userEvent.setup()
    renderExpensesPage()

    const nameInput = await screen.findByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'whey protein')

    // Fill amount to satisfy the other canAdd condition
    const amountInput = screen.getByLabelText(/^amount$/i)
    await user.clear(amountInput)
    await user.type(amountInput, '50')

    const addBtn = screen.getByRole('button', { name: /add expense/i })
    // Advisory must NOT disable the button
    expect(addBtn).not.toBeDisabled()
  })

  it('shows EXP-07 advisory when name contains "supplement"', async () => {
    const user = userEvent.setup()
    renderExpensesPage()

    const nameInput = await screen.findByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'creatine supplement')

    expect(
      screen.getByText(/supplement costs belong in the food floor/i),
    ).toBeInTheDocument()
  })
})
