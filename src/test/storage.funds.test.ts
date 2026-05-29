// Storage layer tests for SinkingFund CRUD, seeds, and round-trip (EXP-04, EXP-05).
// Mirrors storage.expenses.test.ts structure; resets IDB between every test.

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import * as storage from '../storage/storage'
import type { SinkingFund } from '../storage/schema'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

const CAR_FUND: Omit<SinkingFund, 'id'> = {
  name: 'Car insurance',
  annualAmount: 982,
  monthlyAccrual: 82,
  balance: 0,
  payoutDate: '2027-03',
  cadence: 'annual',
  provisional: true,
}

// â”€â”€ addSinkingFund / listSinkingFunds (EXP-04) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('addSinkingFund + listSinkingFunds (EXP-04)', () => {
  it('persists a fund row and returns it via listSinkingFunds', async () => {
    const id = await storage.addSinkingFund(CAR_FUND)
    expect(typeof id).toBe('number')

    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Car insurance', annualAmount: 982 })
    expect(list[0]!.id).toBe(id)
  })

  it('throws when annualAmount is NaN (T-03-02)', async () => {
    await expect(
      storage.addSinkingFund({ ...CAR_FUND, annualAmount: NaN }),
    ).rejects.toThrow()
  })

  it('throws when monthlyAccrual is Infinity (T-03-02)', async () => {
    await expect(
      storage.addSinkingFund({ ...CAR_FUND, monthlyAccrual: Infinity }),
    ).rejects.toThrow()
  })
})

// â”€â”€ Two independent fund instances (EXP-05) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('two sinking fund instances (EXP-05)', () => {
  it('a second addSinkingFund creates an independent row â€” both returned by listSinkingFunds', async () => {
    await storage.addSinkingFund(CAR_FUND)
    await storage.addSinkingFund({
      name: 'Car purchase',
      annualAmount: 5000,
      monthlyAccrual: 417,
      balance: 0,
      payoutDate: '2028-06',
      cadence: 'oneoff',
    })

    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(2)
    const names = list.map(f => f.name)
    expect(names).toContain('Car insurance')
    expect(names).toContain('Car purchase')
  })
})

// â”€â”€ updateSinkingFund / deleteSinkingFund â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('updateSinkingFund', () => {
  it('updates a persisted field', async () => {
    const id = await storage.addSinkingFund(CAR_FUND)
    await storage.updateSinkingFund(id, { balance: 164 })
    const list = await storage.listSinkingFunds()
    expect(list[0]!.balance).toBe(164)
  })
})

describe('deleteSinkingFund', () => {
  it('removes the fund row', async () => {
    const id = await storage.addSinkingFund(CAR_FUND)
    await storage.deleteSinkingFund(id)
    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(0)
  })
})

// â”€â”€ seedFundsIfEmpty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('seedFundsIfEmpty', () => {
  it('inserts the car-insurance fund on a fresh DB', async () => {
    await storage.seedFundsIfEmpty()
    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('Car insurance')
    expect(list[0]!.annualAmount).toBe(982)
    expect(list[0]!.monthlyAccrual).toBe(82)
    expect(list[0]!.balance).toBe(0)
    expect(list[0]!.payoutDate).toBe('2027-03')
    expect(list[0]!.cadence).toBe('annual')
    expect(list[0]!.provisional).toBe(true)
  })

  it('is idempotent: running twice inserts the fund only once', async () => {
    await storage.seedFundsIfEmpty()
    await storage.seedFundsIfEmpty()
    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(1)
  })

  it('does not re-seed when user already has a fund', async () => {
    await storage.addSinkingFund({ ...CAR_FUND, name: 'Custom fund' })
    await storage.seedFundsIfEmpty()
    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('Custom fund')
  })
})

// â”€â”€ Export / import round-trip (Pitfall 6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('export + import round-trip for funds (Pitfall 6)', () => {
  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  it('fund row survives export then import into a fresh DB', async () => {
    await storage.addSinkingFund(CAR_FUND)

    const envelope = await storage.exportAll()
    expect(envelope.data.sinkingFunds).toHaveLength(1)

    // Wipe DB and re-import
    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const list = await storage.listSinkingFunds()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('Car insurance')
    expect(list[0]!.annualAmount).toBe(982)
  })

  it('import rejects a non-finite annualAmount in fund row (T-03-01)', async () => {
    const malformed = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [{ ...CAR_FUND, annualAmount: NaN }],
        accounts: [],
        settings: {},
      },
    }
    await expect(storage.importAll(makeFile(JSON.stringify(malformed)))).rejects.toThrow()
  })

  it('both an expense and a fund row survive the same round-trip', async () => {
    await storage.addExpenseItem({ name: 'Fuel', amount: 238, cadence: 'monthly', classification: 'protected' })
    await storage.addSinkingFund(CAR_FUND)

    const envelope = await storage.exportAll()
    expect(envelope.data.expenseItems).toHaveLength(1)
    expect(envelope.data.sinkingFunds).toHaveLength(1)

    await Dexie.delete('BudgetApp')
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const expenses = await storage.listExpenseItems()
    const funds = await storage.listSinkingFunds()
    expect(expenses).toHaveLength(1)
    expect(expenses[0]!.name).toBe('Fuel')
    expect(funds).toHaveLength(1)
    expect(funds[0]!.name).toBe('Car insurance')
  })
})
