// FoodPage tests — plan 04-05 acceptance criteria.
// Verifies:
//   V6/FOOD-12: floor value in non-interactive element, Lock icon present, no input in floor card
//   UI-02: both protected floor and "Discretionary food (gateable)" sections render
//   EDGE-02/EDGE-03 + D-11: amber "Needs attention" badge renders when gaps exist; expands to named gap list
//   FOOD-10: "Flavor & condiments — protected" renders with editable amount
//   I-06 double-count guard: discretionary total is separate from floor
//   C1 copy guard: NEVER-USE strings absent from rendered output
//   FoodConfigPage: Table A/B/C, FOOD-13 timestamp, I-05 new-row tag defaults macro-bearing, C1 heading framing

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider, createStore } from 'jotai'

const FLOOR_VALUE = 1250

// ── vi.hoisted — state objects available inside vi.mock factories ──────────────
// vi.mock calls are hoisted to the top of the file before any `let`/`const`/`const`.
// vi.hoisted() runs at the same time as the hoisted vi.mock calls, so any object
// created inside vi.hoisted() IS available inside vi.mock factories.

const {
  foodAtomState,
  mockSaveFlavorLine,
  mockSaveMealDefinition,
  mockUpdateMealDefinition,
  mockDeleteMealDefinition,
  mockSaveUnitCostMap,
  mockSavePortionModel,
  mockSaveFoodFloorMeta,
} = vi.hoisted(() => {
  const foodAtomState = {
    foodFloorResult: {
      floor: 1250,
      gaps: [] as Array<
        | { type: 'stale-plan'; lastKnownDate: string | null }
        | { type: 'unpriced-ingredient'; ingredientName: string }
        | { type: 'undefined-meal'; mealName: string }
        | { type: 'unset-flat-cost'; mealName: string }
      >,
      isClean: true,
      planIsCurrent: true,
    },
    badgeStatus: 'clean' as 'clean' | 'needs-attention',
    flavorLine: { amount: 50 },
    mealDefinitions: [
      { id: 1, mealName: 'chicken, rice, and broccoli', type: 'decomposed' as const, ingredients: ['chicken breast', 'rice'] },
      { id: 2, mealName: 'qdoba bowl', type: 'flat-cost' as const, ingredients: [], flatCost: undefined as number | undefined },
    ],
    unitCostMap: [
      { ingredientName: 'chicken breast', costPerUnit: 5.99, unit: 'lb', tag: 'macro-bearing' as const },
      { ingredientName: 'rice', costPerUnit: 0.89, unit: 'lb', tag: 'macro-bearing' as const },
      { ingredientName: 'hot sauce', costPerUnit: 0, unit: 'bottle', tag: 'flavor-condiment' as const },
    ],
    portionModel: [
      { ingredientName: 'chicken breast', portionSize: 0.25 },
      { ingredientName: 'rice', portionSize: 0.5 },
    ],
    foodFloorMeta: {
      lastComputedFloor: 1250,
      allTimeHighWater: 1250,
      lastRefinedFromReceipts: null as string | null,
    },
  }
  return {
    foodAtomState,
    mockSaveFlavorLine: vi.fn(),
    mockSaveMealDefinition: vi.fn(),
    mockUpdateMealDefinition: vi.fn(),
    mockDeleteMealDefinition: vi.fn(),
    mockSaveUnitCostMap: vi.fn(),
    mockSavePortionModel: vi.fn(),
    mockSaveFoodFloorMeta: vi.fn(),
  }
})

// ── Atom mocks ────────────────────────────────────────────────────────────────
vi.mock('../domains/food/food.atoms', () => ({
  foodFloorAtom: {
    init: foodAtomState.foodFloorResult,
    read: (_get: unknown) => foodAtomState.foodFloorResult,
  },
  foodBadgeStatusAtom: {
    init: 'clean',
    read: (_get: unknown) => foodAtomState.badgeStatus,
  },
  flavorLineAtom: {
    init: { amount: 50 },
    read: (_get: unknown) => foodAtomState.flavorLine,
  },
  saveFlavorLineAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, line: unknown) => mockSaveFlavorLine(line),
  },
  mealDefinitionsAtom: {
    init: foodAtomState.mealDefinitions,
    read: (_get: unknown) => foodAtomState.mealDefinitions,
  },
  unitCostMapAtom: {
    init: foodAtomState.unitCostMap,
    read: (_get: unknown) => foodAtomState.unitCostMap,
  },
  saveUnitCostMapAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, entries: unknown) => mockSaveUnitCostMap(entries),
  },
  portionModelAtom: {
    init: foodAtomState.portionModel,
    read: (_get: unknown) => foodAtomState.portionModel,
  },
  savePortionModelAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, entries: unknown) => mockSavePortionModel(entries),
  },
  foodFloorMetaAtom: {
    init: foodAtomState.foodFloorMeta,
    read: (_get: unknown) => foodAtomState.foodFloorMeta,
  },
  saveFoodFloorMetaAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, meta: unknown) => mockSaveFoodFloorMeta(meta),
  },
  saveMealDefinitionAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, meal: unknown) => mockSaveMealDefinition(meal),
  },
  updateMealDefinitionAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, args: unknown) => mockUpdateMealDefinition(args),
  },
  deleteMealDefinitionAtom: {
    init: null,
    write: (_get: unknown, _set: unknown, id: unknown) => mockDeleteMealDefinition(id),
  },
}))

vi.mock('../domains/expenses/expenses.atoms', () => ({
  gateableExpensesAtom: {
    init: [
      { id: 10, name: 'Dining out', amount: 80, cadence: 'monthly', classification: 'gateable' },
    ],
    read: () => [
      { id: 10, name: 'Dining out', amount: 80, cadence: 'monthly', classification: 'gateable' },
    ],
  },
  survivalFloorAtom: { init: 3585, read: () => 3585 },
  expenseItemsAtom: { init: [], read: () => [] },
  protectedExpensesAtom: { init: [], read: () => [] },
  saveExpenseItemAtom: { init: null },
  updateExpenseItemAtom: { init: null },
  deleteExpenseItemAtom: { init: null },
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import FoodPage from './FoodPage'
import FoodConfigPage from './FoodConfigPage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderFoodPage() {
  const store = createStore()
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/food']}>
        <FoodPage />
      </MemoryRouter>
    </Provider>,
  )
}

function renderFoodConfigPage() {
  const store = createStore()
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/food/config']}>
        <FoodConfigPage />
      </MemoryRouter>
    </Provider>,
  )
}

// ── FoodPage tests ─────────────────────────────────────────────────────────────

describe('FoodPage', () => {
  beforeEach(() => {
    foodAtomState.foodFloorResult = {
      floor: FLOOR_VALUE,
      gaps: [],
      isClean: true,
      planIsCurrent: true,
    }
    foodAtomState.badgeStatus = 'clean'
    foodAtomState.flavorLine = { amount: 50 }
    vi.clearAllMocks()
  })

  it('V6/FOOD-12: the floor value renders in a non-interactive element — no input inside the floor card', () => {
    renderFoodPage()
    const floorCard = screen.getByTestId('protected-floor-card')
    const inputs = floorCard.querySelectorAll('input')
    expect(inputs).toHaveLength(0)
  })

  it('V6/FOOD-12: a Lock icon (SVG with data-testid) is present in the floor card', () => {
    renderFoodPage()
    const floorCard = screen.getByTestId('protected-floor-card')
    const lockIcon = floorCard.querySelector('[data-testid="lock-icon"]')
    expect(lockIcon).not.toBeNull()
  })

  it('V6/FOOD-12: the floor card shows the exact floor value from foodFloorAtom.floor', () => {
    renderFoodPage()
    const floorVal = screen.getByTestId('floor-value')
    expect(floorVal).toBeInTheDocument()
    expect(floorVal.textContent).toContain('1,250')
  })

  it('V6/FOOD-12: the explainer "Computed from your meal plan — protected" is visible', () => {
    renderFoodPage()
    expect(screen.getByText('Computed from your meal plan — protected')).toBeInTheDocument()
  })

  it('UI-02: both protected floor value and "Discretionary food (gateable)" labeled section render', () => {
    renderFoodPage()
    expect(screen.getByTestId('protected-floor-card')).toBeInTheDocument()
    expect(screen.getByText('Discretionary food (gateable)')).toBeInTheDocument()
  })

  it('EDGE-02/D-11: amber "Needs attention" badge renders when gaps exist', () => {
    foodAtomState.badgeStatus = 'needs-attention'
    foodAtomState.foodFloorResult = {
      floor: 550,
      gaps: [{ type: 'stale-plan', lastKnownDate: '2026-04-30' }],
      isClean: false,
      planIsCurrent: false,
    }
    renderFoodPage()
    expect(screen.getByTestId('food-status-badge')).toHaveTextContent('Needs attention')
  })

  it('EDGE-02/D-11: expanding the amber badge lists the stale-plan gap copy', () => {
    foodAtomState.badgeStatus = 'needs-attention'
    foodAtomState.foodFloorResult = {
      floor: 550,
      gaps: [{ type: 'stale-plan', lastKnownDate: '2026-04-30' }],
      isClean: false,
      planIsCurrent: false,
    }
    renderFoodPage()
    const badge = screen.getByTestId('food-status-badge')
    fireEvent.click(badge)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText(/No meal plan covers today/)).toBeInTheDocument()
  })

  it('EDGE-03/D-11: expanding badge lists unpriced ingredient gap', () => {
    foodAtomState.badgeStatus = 'needs-attention'
    foodAtomState.foodFloorResult = {
      floor: 1250,
      gaps: [{ type: 'unpriced-ingredient', ingredientName: 'olive oil' }],
      isClean: false,
      planIsCurrent: true,
    }
    renderFoodPage()
    const badge = screen.getByTestId('food-status-badge')
    fireEvent.click(badge)
    expect(screen.getByText(/olive oil/)).toBeInTheDocument()
  })

  it('D-11: "Plan current" green badge renders when no gaps', () => {
    renderFoodPage()
    expect(screen.getByTestId('food-status-badge')).toHaveTextContent('Plan current')
  })

  it('FOOD-10: "Flavor & condiments — protected" renders with an editable amount input', () => {
    renderFoodPage()
    expect(screen.getByText('Flavor & condiments — protected')).toBeInTheDocument()
    const flavorWidget = screen.getByTestId('flavor-amount-input')
    expect(flavorWidget).toBeInTheDocument()
    const input = flavorWidget.querySelector('input')
    expect(input).not.toBeNull()
    expect(input).not.toBeDisabled()
  })

  it('Stale badge state: badge renders "Needs attention" when planIsCurrent=false', () => {
    foodAtomState.foodFloorResult = {
      floor: 550,
      gaps: [{ type: 'stale-plan', lastKnownDate: null }],
      isClean: false,
      planIsCurrent: false,
    }
    foodAtomState.badgeStatus = 'needs-attention'
    renderFoodPage()
    expect(screen.getByTestId('food-status-badge')).toHaveTextContent('Needs attention')
  })

  it('I-06 double-count guard: discretionary food total is a separate figure and does not change the floor value', () => {
    renderFoodPage()
    const floorDisplay = screen.getByTestId('floor-value')
    expect(floorDisplay.textContent).toContain('1,250')
    const gateableSection = screen.getByTestId('gateable-food-section')
    expect(gateableSection).toBeInTheDocument()
    // Floor value must NOT include the 80 discretionary (1250 not 1330)
    expect(floorDisplay.textContent).not.toContain('1,330')
    // Protected floor card must show only the floor, not the gateable 80
    const floorCard = screen.getByTestId('protected-floor-card')
    expect(floorCard.textContent).not.toContain('80')
  })

  it('C1 copy guard: NEVER-USE strings absent from rendered page', () => {
    const { container } = renderFoodPage()
    const html = container.innerHTML.toLowerCase()
    expect(html).not.toContain('cut food')
    expect(html).not.toContain('reduce food budget')
    expect(html).not.toContain('save on food')
    expect(html).not.toContain('trim food')
  })
})

// ── FoodConfigPage tests ───────────────────────────────────────────────────────

describe('FoodConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    foodAtomState.mealDefinitions = [
      { id: 1, mealName: 'chicken, rice, and broccoli', type: 'decomposed' as const, ingredients: ['chicken breast', 'rice'] },
      { id: 2, mealName: 'qdoba bowl', type: 'flat-cost' as const, ingredients: [], flatCost: undefined },
    ]
    foodAtomState.unitCostMap = [
      { ingredientName: 'chicken breast', costPerUnit: 5.99, unit: 'lb', tag: 'macro-bearing' as const },
      { ingredientName: 'rice', costPerUnit: 0.89, unit: 'lb', tag: 'macro-bearing' as const },
      { ingredientName: 'hot sauce', costPerUnit: 0, unit: 'bottle', tag: 'flavor-condiment' as const },
    ]
    foodAtomState.portionModel = [
      { ingredientName: 'chicken breast', portionSize: 0.25 },
      { ingredientName: 'rice', portionSize: 0.5 },
    ]
    foodAtomState.foodFloorMeta = {
      lastComputedFloor: FLOOR_VALUE,
      allTimeHighWater: FLOOR_VALUE,
      lastRefinedFromReceipts: null,
    }
  })

  it('heading reads "Meal cost configuration" (C1 framing)', () => {
    renderFoodConfigPage()
    expect(screen.getByRole('heading', { name: /Meal cost configuration/ })).toBeInTheDocument()
  })

  it('sub-heading explainer is present', () => {
    renderFoodConfigPage()
    expect(screen.getByText(/Edit these tables for accuracy/)).toBeInTheDocument()
  })

  it('C1 copy guard: no budget-lever or downward-framing copy', () => {
    const { container } = renderFoodConfigPage()
    const html = container.innerHTML.toLowerCase()
    expect(html).not.toContain('adjust food budget')
    expect(html).not.toContain('food spending controls')
    expect(html).not.toContain('cut food')
    expect(html).not.toContain('reduce food budget')
    expect(html).not.toContain('save on food')
    expect(html).not.toContain('trim food')
  })

  it('Table A: meal definitions render with Type badge', () => {
    renderFoodConfigPage()
    expect(screen.getByTestId('table-a-meal-definitions')).toBeInTheDocument()
    expect(screen.getByText('Decomposed')).toBeInTheDocument()
    expect(screen.getByText('Flat cost')).toBeInTheDocument()
  })

  it('Table B: unit-cost map renders rows', () => {
    renderFoodConfigPage()
    const tableB = screen.getByTestId('table-b-unit-cost-map')
    expect(tableB).toBeInTheDocument()
    expect(tableB.textContent).toContain('chicken breast')
  })

  it('EDGE-03: unpriced rows (cost 0) carry a visible text flag', () => {
    renderFoodConfigPage()
    const tableB = screen.getByTestId('table-b-unit-cost-map')
    expect(tableB.textContent).toMatch(/unpriced|no cost/i)
  })

  it('Table C: portion model renders macro-bearing ingredients', () => {
    renderFoodConfigPage()
    expect(screen.getByTestId('table-c-portion-model')).toBeInTheDocument()
    const tableC = screen.getByTestId('table-c-portion-model')
    expect(tableC.textContent).toContain('chicken breast')
  })

  it('FOOD-13: "Last refined from receipts" renders with "Not yet recorded" when null', () => {
    renderFoodConfigPage()
    expect(screen.getByText(/Last refined from receipts/)).toBeInTheDocument()
    expect(screen.getByText(/Not yet recorded/)).toBeInTheDocument()
  })

  it('FOOD-13: "Mark refined today" button is present', () => {
    renderFoodConfigPage()
    expect(screen.getByRole('button', { name: /Mark refined today/ })).toBeInTheDocument()
  })

  it('FOOD-13: clicking "Mark refined today" calls saveFoodFloorMetaAtom with an ISO timestamp', async () => {
    renderFoodConfigPage()
    const btn = screen.getByRole('button', { name: /Mark refined today/ })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(mockSaveFoodFloorMeta).toHaveBeenCalledOnce()
    })
    const callArgs = mockSaveFoodFloorMeta.mock.calls as Array<[{ lastRefinedFromReceipts: unknown; lastComputedFloor: unknown }]>
    const firstCall = callArgs[0]
    if (!firstCall) throw new Error('Expected saveFoodFloorMeta to be called')
    const callArg = firstCall[0]
    expect(typeof callArg.lastRefinedFromReceipts).toBe('string')
    // lastComputedFloor must not change from current meta
    expect(callArg.lastComputedFloor).toBe(foodAtomState.foodFloorMeta.lastComputedFloor)
  })

  it('I-05 new-row tag default: clicking "Add ingredient" shows new row with "macro-bearing" tag default', () => {
    renderFoodConfigPage()
    const addBtn = screen.getByRole('button', { name: /Add ingredient/ })
    fireEvent.click(addBtn)
    const newRow = screen.getByTestId('new-ingredient-row')
    expect(newRow).toBeInTheDocument()
    const select = newRow.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('macro-bearing')
  })
})
