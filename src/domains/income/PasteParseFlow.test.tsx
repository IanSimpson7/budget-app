// PasteParseFlow tests — plan 02-05 TDD RED gate.
// Tests: gold fixture parse (2 auto-checked), commit persists only checked rows,
// known-source memory, empty-paste inline error, gift not auto-committed.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'
import { createStore } from 'jotai'
import PasteParseFlow from './PasteParseFlow'
import type { KnownSource } from './income.types'

// ── Gold fixture inline (avoids node:fs in browser tsconfig; matches .txt on disk) ──
// From src/domains/income/parser/__fixtures__/checking-may-2026.txt
const GOLD_FIXTURE = `Date\tDescription\tAmount\tBalance
05/01/2026\tGLI EAST LANSING\t1,127.51\t3,127.51
\tTYPE: PAYROLL
\tCO: GLI EAST LANSING
\tID: 1234567890
05/10/2026\tACH Deposit VANGUARD SELL\t3,000.00\t6,127.51
\tTYPE: CREDIT
\tCO: VANGUARD
\tID: 9876543210
05/12/2026\tCashback Redeemed from L30\t223.97\t6,351.48
05/15/2026\tGLI EAST LANSING\t1,296.59\t7,648.07
\tTYPE: PAYROLL
\tCO: GLI EAST LANSING
\tID: 1234567891
05/18/2026\tACH Deposit VENMO CASHOUT\t600.00\t8,248.07
\tTYPE: CREDIT
\tCO: VENMO
\tID: 5555000001
05/22/2026\tACH Deposit VENMO CASHOUT\t350.00\t8,598.07
\tTYPE: CREDIT
\tCO: VENMO
\tID: 5555000002`

// ── Mock storage ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAddIncomeChecks = vi.fn((_checks: any[]) => Promise.resolve([1, 2]))
const mockGetKnownSources = vi.fn((): Promise<KnownSource[]> => Promise.resolve([]))
const mockSaveKnownSources = vi.fn((_list: KnownSource[]) => Promise.resolve())

vi.mock('../../storage/storage', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addIncomeChecks: (checks: any[]) => mockAddIncomeChecks(checks),
  getKnownSources: () => mockGetKnownSources(),
  saveKnownSources: (list: KnownSource[]) => mockSaveKnownSources(list),
  observeIncomeChecks: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
  getEstimatePerCheck: vi.fn(() => Promise.resolve(0)),
}))

// ── Mock settings atoms so async atoms don't suspend ─────────────────────────
vi.mock('../settings/settings.atoms', () => ({
  floorsLoadAtom: { init: { passive: 2400, defended: 3000, foodSeed: 550 } },
  saveFloorsAtom: { init: null },
  derivedSurvivalFloorAtom: { init: 2400 },
}))

// ── Mock income.atoms (knownSourcesAtom, commitCheckedRowsAtom) ───────────────
const mockKnownSources: { sources: KnownSource[] } = { sources: [] }

vi.mock('./income.atoms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./income.atoms')>()
  return {
    ...actual,
    knownSourcesAtom: {
      init: [] as KnownSource[],
      read: () => mockKnownSources.sources,
    },
    commitCheckedRowsAtom: {
      init: null as null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      write: async (_get: unknown, _set: unknown, rows: any[]) => {
        const checked = rows.filter((r) => r.checked)
        await mockAddIncomeChecks(checked)
        const known = await mockGetKnownSources()
        const newSources: KnownSource[] = checked.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => ({
            source: r.source ?? '',
            category: r.category,
            taxable: r.taxable,
          }),
        )
        const merged = [...known]
        for (const ns of newSources) {
          if (!merged.find((k) => k.source === ns.source)) merged.push(ns)
        }
        await mockSaveKnownSources(merged)
      },
    },
  }
})

// Helper to render with a fresh Jotai store
function renderFlow() {
  const store = createStore()
  return render(
    <Provider store={store}>
      <PasteParseFlow />
    </Provider>,
  )
}

describe('PasteParseFlow', () => {
  beforeEach(() => {
    mockAddIncomeChecks.mockClear()
    mockGetKnownSources.mockClear()
    mockSaveKnownSources.mockClear()
    mockKnownSources.sources = []
  })

  it('renders the paste textarea and Parse entries button', () => {
    renderFlow()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /parse entries/i })).toBeInTheDocument()
  })

  it('Parse entries button is disabled when textarea is empty', () => {
    renderFlow()
    expect(screen.getByRole('button', { name: /parse entries/i })).toBeDisabled()
  })

  it('gold fixture: after parse, exactly 2 rows are checked (the GLI EAST LANSING PAYROLL rows)', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.paste(GOLD_FIXTURE)

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    // Should advance to confirm table showing 6 rows
    await waitFor(() => {
      expect(screen.getByText(/2 of 6 entries selected/i)).toBeInTheDocument()
    })

    // Exactly 2 checkboxes should be checked by default (the two GLI EAST LANSING PAYROLL rows)
    const checkboxes = screen.getAllByRole('checkbox')
    const checkedCount = checkboxes.filter((cb) => (cb as HTMLInputElement).checked).length
    expect(checkedCount).toBe(2)
  })

  it('gold fixture: VANGUARD SELL and both Venmo rows are NOT default-checked', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.paste(GOLD_FIXTURE)

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 of 6 entries selected/i)).toBeInTheDocument()
    })

    // Only 2 rows checked — VANGUARD and VENMO are unchecked
    const checkboxes = screen.getAllByRole('checkbox')
    const checkedBoxes = checkboxes.filter((cb) => (cb as HTMLInputElement).checked)
    expect(checkedBoxes).toHaveLength(2)
  })

  it('committing calls storage.addIncomeChecks with only the 2 checked GLI rows', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.paste(GOLD_FIXTURE)

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 of 6 entries selected/i)).toBeInTheDocument()
    })

    // Click Commit 2 checks
    await user.click(screen.getByRole('button', { name: /commit 2 checks/i }))

    await waitFor(() => {
      expect(mockAddIncomeChecks).toHaveBeenCalledOnce()
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = mockAddIncomeChecks.mock.calls as Array<[any[]]>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const committed = calls[0]![0] as Array<Record<string, unknown>>
    expect(committed).toHaveLength(2)

    // Both committed rows should be GLI EAST LANSING (PAYROLL)
    for (const row of committed) {
      expect(row['source']).toBe('GLI EAST LANSING')
    }

    // The $3,000 VANGUARD SELL must NOT be in the committed set (Pitfall 3)
    const vanguardRow = committed.find((r) => String(r['source']).includes('VANGUARD'))
    expect(vanguardRow).toBeUndefined()

    // Neither Venmo (gift) row should be committed
    const venmoRow = committed.find((r) => String(r['source']).includes('VENMO'))
    expect(venmoRow).toBeUndefined()
  })

  it('committing remembers the GLI source in knownSources', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.paste(GOLD_FIXTURE)

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 of 6 entries selected/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /commit 2 checks/i }))

    await waitFor(() => {
      expect(mockSaveKnownSources).toHaveBeenCalledOnce()
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedList = (mockSaveKnownSources.mock.calls as Array<[any[]]>)[0]![0] as KnownSource[]
    const gliSource = savedList.find((ks) => ks.source === 'GLI EAST LANSING')
    expect(gliSource).toBeDefined()
    expect(gliSource?.category).toBe('payroll')
  })

  it('empty/garbage paste stays on step 1 with inline error, parse button re-enabled', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.type(textarea, 'not a valid statement at all')

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    // Should NOT advance to confirm; should show inline error
    await waitFor(() => {
      expect(screen.getByText(/no transaction rows found/i)).toBeInTheDocument()
    })

    // Parse button should be re-enabled for retry
    expect(screen.getByRole('button', { name: /parse entries/i })).not.toBeDisabled()

    // No confirm table
    expect(screen.queryByText(/entries selected/i)).toBeNull()
  })

  it('"Back — re-paste" returns to step 1 textarea', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.paste(GOLD_FIXTURE)

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    await waitFor(() => {
      expect(screen.getByText(/entries selected/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /back.*re-paste/i }))

    // Back to step 1 — textarea visible again
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    expect(screen.queryByText(/entries selected/i)).toBeNull()
  })

  it('post-commit shows "Saved N checks." and Add more / View dashboard buttons', async () => {
    const user = userEvent.setup()
    renderFlow()

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.paste(GOLD_FIXTURE)

    await user.click(screen.getByRole('button', { name: /parse entries/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 of 6 entries selected/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /commit 2 checks/i }))

    await waitFor(() => {
      expect(screen.getByText(/saved 2 checks\./i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /add more/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view dashboard/i })).toBeInTheDocument()
  })
})
