// Storage layer tests for ExpenseItem CRUD, seeds, and round-trip (EXP-01, EXP-02, EXP-07).
// Mirrors storage.income.test.ts structure; resets IDB between every test.

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import * as storage from '../storage/storage'
import type { ExpenseItem } from '../storage/schema'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

// â”€â”€ addExpenseItem / listExpenseItems (EXP-01) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('addExpenseItem + listExpenseItems (EXP-01)', () => {
  it('persists a row and returns it via listExpenseItems', async () => {
    const item: Omit<ExpenseItem, 'id'> = {
      name: 'Housing all-in',
      amount: 1300,
      cadence: 'monthly',
      classification: 'protected',
    }
    const id = await storage.addExpenseItem(item)
    expect(typeof id).toBe('number')

    const list = await storage.listExpenseItems()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Housing all-in', amount: 1300 })
    expect(list[0]!.id).toBe(id)
  })

  it('throws when amount is NaN (T-03-02 tampering guard)', async () => {
    await expect(
      storage.addExpenseItem({ name: 'Bad', amount: NaN, cadence: 'monthly', classification: 'protected' }),
    ).rejects.toThrow()
  })

  it('throws when amount is Infinity (T-03-02 tampering guard)', async () => {
    await expect(
      storage.addExpenseItem({ name: 'Bad', amount: Infinity, cadence: 'monthly', classification: 'protected' }),
    ).rejects.toThrow()
  })
})

// â”€â”€ updateExpenseItem / deleteExpenseItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('updateExpenseItem', () => {
  it('updates a persisted field', async () => {
    const id = await storage.addExpenseItem({
      name: 'Electric',
      amount: 65,
      cadence: 'monthly',
      classification: 'protected',
    })
    await storage.updateExpenseItem(id, { amount: 70 })
    const list = await storage.listExpenseItems()
    expect(list[0]!.amount).toBe(70)
  })
})

describe('deleteExpenseItem', () => {
  it('removes the row', async () => {
    const id = await storage.addExpenseItem({
      name: 'Claude',
      amount: 100,
      cadence: 'monthly',
      classification: 'protected',
    })
    await storage.deleteExpenseItem(id)
    const list = await storage.listExpenseItems()
    expect(list).toHaveLength(0)
  })
})

// â”€â”€ Classification filtering (EXP-02) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('classification filtering (EXP-02)', () => {
  it('filtering by protected returns only protected rows', async () => {
    await storage.addExpenseItem({ name: 'Housing', amount: 1300, cadence: 'monthly', classification: 'protected' })
    await storage.addExpenseItem({ name: 'Dining out', amount: 200, cadence: 'monthly', classification: 'gateable' })

    const list = await storage.listExpenseItems()
    const protected_ = list.filter(i => i.classification === 'protected')
    const gateable = list.filter(i => i.classification === 'gateable')

    expect(protected_).toHaveLength(1)
    expect(protected_[0]!.name).toBe('Housing')
    expect(gateable).toHaveLength(1)
    expect(gateable[0]!.name).toBe('Dining out')
  })
})

// â”€â”€ seedExpensesIfEmpty (EXP-07 + D-03) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('seedExpensesIfEmpty (EXP-07, D-03)', () => {
  it('inserts exactly 4 PROTECTED rows on a fresh DB', async () => {
    await storage.seedExpensesIfEmpty()
    const list = await storage.listExpenseItems()
    expect(list).toHaveLength(4)
    expect(list.every(i => i.classification === 'protected')).toBe(true)
  })

  it('inserts Housing, Electric, Fuel, Claude seed rows', async () => {
    await storage.seedExpensesIfEmpty()
    const list = await storage.listExpenseItems()
    const names = list.map(i => i.name)
    expect(names).toContain('Housing all-in')
    expect(names).toContain('Electric')
    expect(names).toContain('Fuel')
    expect(names).toContain('Claude')
  })

  it('does NOT seed car insurance as an expense line (no-double-count)', async () => {
    await storage.seedExpensesIfEmpty()
    const list = await storage.listExpenseItems()
    const hasInsurance = list.some(i => /insurance/i.test(i.name))
    expect(hasInsurance).toBe(false)
  })

  it('does NOT seed whey or supplement (EXP-07 guard)', async () => {
    await storage.seedExpensesIfEmpty()
    const list = await storage.listExpenseItems()
    const hasWhey = list.some(i => /whey|supplement/i.test(i.name))
    expect(hasWhey).toBe(false)
  })

  it('is idempotent: running twice inserts rows only once', async () => {
    await storage.seedExpensesIfEmpty()
    await storage.seedExpensesIfEmpty()
    const list = await storage.listExpenseItems()
    expect(list).toHaveLength(4)
  })

  it('does not re-seed when the user still has data (sentinel guard)', async () => {
    // Manually add a protected row â€” simulates Ian's existing data
    await storage.addExpenseItem({ name: 'Custom', amount: 999, cadence: 'monthly', classification: 'protected' })
    await storage.seedExpensesIfEmpty()
    const list = await storage.listExpenseItems()
    // Only the custom row should exist â€” seed is skipped
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('Custom')
  })
})

// â”€â”€ Export / import round-trip (Pitfall 6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('export + import round-trip for expenses (Pitfall 6)', () => {
  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  it('expense row survives export then import into a fresh DB', async () => {
    await storage.addExpenseItem({ name: 'Fuel', amount: 238, cadence: 'monthly', classification: 'protected' })

    const envelope = await storage.exportAll()
    expect(envelope.data.expenseItems).toHaveLength(1)

    // Wipe DB and re-import
    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const list = await storage.listExpenseItems()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('Fuel')
    expect(list[0]!.amount).toBe(238)
  })

  it('import rejects a non-finite amount in expense row (T-03-01)', async () => {
    const malformed = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [{ name: 'Bad', amount: NaN, cadence: 'monthly', classification: 'protected' }],
        sinkingFunds: [],
        accounts: [],
        settings: {},
      },
    }
    await expect(storage.importAll(makeFile(JSON.stringify(malformed)))).rejects.toThrow()
  })
})
