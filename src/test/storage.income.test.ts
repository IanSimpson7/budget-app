import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import type { IncomeCheck } from '../storage/schema'
import * as storage from '../storage/storage'

// Reset IDB between every test so each test sees a fresh DB.
beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

const SAMPLE_CHECK: Omit<IncomeCheck, 'id'> = {
  date: '2026-05-01',
  netAmount: 1127.51,
  source: 'GLI EAST LANSING',
  note: 'TYPE: PAYROLL\nCO: GLI EAST LANSING\nID: 123456',
  category: 'payroll',
  taxable: true,
}

describe('income CRUD (INC-01)', () => {
  it('addIncomeCheck persists a check; listIncomeChecks returns it', async () => {
    const id = await storage.addIncomeCheck(SAMPLE_CHECK)
    expect(typeof id).toBe('number')
    const list = await storage.listIncomeChecks()
    expect(list).toHaveLength(1)
    expect(list[0]!).toMatchObject(SAMPLE_CHECK)
    expect(list[0]!.id).toBe(id)
  })

  it('updateIncomeCheck patches an existing check', async () => {
    const id = await storage.addIncomeCheck(SAMPLE_CHECK)
    await storage.updateIncomeCheck(id, { netAmount: 1296.59, date: '2026-05-15' })
    const list = await storage.listIncomeChecks()
    expect(list[0]!.netAmount).toBe(1296.59)
    expect(list[0]!.date).toBe('2026-05-15')
    expect(list[0]!.source).toBe(SAMPLE_CHECK.source)
  })

  it('deleteIncomeCheck removes the check', async () => {
    const id = await storage.addIncomeCheck(SAMPLE_CHECK)
    await storage.deleteIncomeCheck(id)
    const list = await storage.listIncomeChecks()
    expect(list).toHaveLength(0)
  })

  it('addIncomeChecks persists a batch and returns ids for each inserted check', async () => {
    const second: Omit<IncomeCheck, 'id'> = {
      ...SAMPLE_CHECK,
      date: '2026-05-15',
      netAmount: 1296.59,
    }
    const ids = await storage.addIncomeChecks([SAMPLE_CHECK, second])
    expect(ids).toHaveLength(2)
    expect(typeof ids[0]).toBe('number')
    expect(typeof ids[1]).toBe('number')
    const list = await storage.listIncomeChecks()
    expect(list).toHaveLength(2)
  })
})

describe('known-source persistence (D-06)', () => {
  it('getKnownSources returns [] when unset', async () => {
    const sources = await storage.getKnownSources()
    expect(sources).toEqual([])
  })

  it('saveKnownSources then getKnownSources round-trips the list', async () => {
    const list = [
      { source: 'GLI EAST LANSING', category: 'payroll' as const, taxable: true },
    ]
    await storage.saveKnownSources(list)
    const result = await storage.getKnownSources()
    expect(result).toEqual(list)
  })
})

describe('estimatePerCheck settings (D-11)', () => {
  it('getEstimatePerCheck returns 0 when unset', async () => {
    const estimate = await storage.getEstimatePerCheck()
    expect(estimate).toBe(0)
  })

  it('saveEstimatePerCheck then getEstimatePerCheck round-trips the value', async () => {
    await storage.saveEstimatePerCheck(1250)
    const result = await storage.getEstimatePerCheck()
    expect(result).toBe(1250)
  })
})

describe('observeIncomeChecks (reactive observable)', () => {
  it('returns an object with a subscribe method', () => {
    const observable = storage.observeIncomeChecks()
    expect(typeof observable.subscribe).toBe('function')
  })

  it('subscribing yields the current rows and re-emits after addIncomeCheck', async () => {
    const observable = storage.observeIncomeChecks()
    const emissions: IncomeCheck[][] = []
    const subscription = observable.subscribe({
      next: (rows) => { emissions.push(rows) },
      error: (e) => { throw e },
    })

    // Wait for initial emission
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (emissions.length >= 1) { clearInterval(check); resolve() }
      }, 10)
    })

    expect(emissions[0]).toEqual([])

    // Add a check and wait for re-emission
    await storage.addIncomeCheck(SAMPLE_CHECK)
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (emissions.length >= 2) { clearInterval(check); resolve() }
      }, 10)
    })

    expect(emissions[1]).toHaveLength(1)
    expect(emissions[1]![0]!).toMatchObject(SAMPLE_CHECK)
    subscription.unsubscribe()
  })
})

describe('export/import round-trip with income rows (v2)', () => {
  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  it('income rows survive exportAll → wipe DB → importAll round-trip', async () => {
    const id = await storage.addIncomeCheck(SAMPLE_CHECK)

    const envelope = await storage.exportAll()
    // Envelope must contain the income check
    expect(Array.isArray(envelope.data.incomeChecks)).toBe(true)
    expect(envelope.data.incomeChecks).toHaveLength(1)

    // Wipe the DB
    await Dexie.delete('BudgetApp')

    // Re-import
    await storage.importAll(makeFile(JSON.stringify(envelope)))

    const restored = await storage.listIncomeChecks()
    expect(restored).toHaveLength(1)
    expect(restored[0]!).toMatchObject(SAMPLE_CHECK)
    // id may differ after re-import (auto-increment resets), check the data fields
    expect(restored[0]!.date).toBe(SAMPLE_CHECK.date)
    expect(restored[0]!.netAmount).toBe(SAMPLE_CHECK.netAmount)
    void id // suppress unused-var warning
  })
})
