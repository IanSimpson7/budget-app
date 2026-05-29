import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { CURRENT_SCHEMA_VERSION, ImportError, type Floors, toMonthlyEquivalent } from '../storage/schema'
import { migrate_1_to_2, migrate_2_to_3, MIGRATIONS } from '../storage/migrations'
import * as storage from '../storage/storage'

// Reset IDB between every test so each test sees a fresh DB.
beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

describe('schema version', () => {
  it('CURRENT_SCHEMA_VERSION is 3', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3)
  })
})

describe('migrate_1_to_2', () => {
  it('is registered at MIGRATIONS[1]', () => {
    expect(MIGRATIONS[1]).toBe(migrate_1_to_2)
  })

  it('seeds knownSources to [] when absent', () => {
    const v1Data = {
      incomeChecks: [],
      expenseItems: [],
      sinkingFunds: [],
      accounts: [],
      settings: { floors: { passive: 2400, defended: 3000, foodSeed: 550 } as Floors },
    }
    const result = migrate_1_to_2(v1Data)
    expect(result.settings.knownSources).toEqual([])
  })

  it('preserves existing knownSources if already present', () => {
    const existing = [{ source: 'GLI EAST LANSING', category: 'payroll', taxable: true }]
    const v1Data = {
      incomeChecks: [],
      expenseItems: [],
      sinkingFunds: [],
      accounts: [],
      settings: { knownSources: existing },
    }
    const result = migrate_1_to_2(v1Data)
    expect(result.settings.knownSources).toBe(existing)
  })

  it('does not mutate the input data object', () => {
    const v1Data = {
      incomeChecks: [],
      expenseItems: [],
      sinkingFunds: [],
      accounts: [],
      settings: {},
    }
    const result = migrate_1_to_2(v1Data)
    expect(result).not.toBe(v1Data)
    expect(result.settings).not.toBe(v1Data.settings)
  })
})

describe('import ladder (v1 backup migration)', () => {
  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  it('importAll of a schemaVersion:1 envelope succeeds (MIGRATIONS[1] exists)', async () => {
    const floors: Floors = { passive: 2700, defended: 3100, foodSeed: 600 }
    const v1Envelope = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [],
        accounts: [],
        settings: { floors },
      },
    }
    await expect(storage.importAll(makeFile(JSON.stringify(v1Envelope)))).resolves.toBeUndefined()
    // settings should have been restored
    const after = await storage.getFloors()
    expect(after).toEqual(floors)
  })

  it('importAll of a schemaVersion:4 envelope throws ImportError VERSION_TOO_NEW', async () => {
    const tooNew = {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: { incomeChecks: [], expenseItems: [], sinkingFunds: [], accounts: [], settings: {} },
    }
    try {
      await storage.importAll(makeFile(JSON.stringify(tooNew)))
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
      expect((e as ImportError).code).toBe('VERSION_TOO_NEW')
    }
  })

  it('importAll of current schemaVersion:3 envelope succeeds', async () => {
    const floors: Floors = { passive: 2500, defended: 3000, foodSeed: 550 }
    const v2Envelope = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [],
        accounts: [],
        settings: { floors, knownSources: [] },
      },
    }
    await expect(storage.importAll(makeFile(JSON.stringify(v2Envelope)))).resolves.toBeUndefined()
    const after = await storage.getFloors()
    expect(after).toEqual(floors)
  })
})

describe('migrate_2_to_3', () => {
  it('is registered at MIGRATIONS[2]', () => {
    expect(MIGRATIONS[2]).toBe(migrate_2_to_3)
  })

  it('returns expenseItems as [] when absent from input', () => {
    const withoutArrays = {
      incomeChecks: [],
      expenseItems: undefined as unknown as unknown[],
      sinkingFunds: undefined as unknown as unknown[],
      accounts: [],
      settings: { floors: { passive: 2400, defended: 3000, foodSeed: 550 } as Floors },
    }
    const result = migrate_2_to_3(withoutArrays)
    expect(result.expenseItems).toEqual([])
    expect(result.sinkingFunds).toEqual([])
  })

  it('passes through existing expenseItems and sinkingFunds rows untouched', () => {
    const expenseRow = { id: 1, name: 'Housing', amount: 1300, cadence: 'monthly', classification: 'protected' }
    const fundRow = { id: 1, name: 'Car insurance', annualAmount: 982, monthlyAccrual: 82, balance: 0, payoutDate: '2027-03', cadence: 'annual' }
    const data = {
      incomeChecks: [],
      expenseItems: [expenseRow],
      sinkingFunds: [fundRow],
      accounts: [],
      settings: {},
    }
    const result = migrate_2_to_3(data)
    expect(result.expenseItems).toEqual([expenseRow])
    expect(result.sinkingFunds).toEqual([fundRow])
  })

  it('preserves all settings and incomeChecks unchanged', () => {
    const check = { id: 1, date: '2026-05-01', netAmount: 3000, source: 'GLI', note: '', category: 'payroll', taxable: true }
    const data = {
      incomeChecks: [check],
      expenseItems: [],
      sinkingFunds: [],
      accounts: [],
      settings: { floors: { passive: 2400, defended: 3000, foodSeed: 550 } as Floors, knownSources: [] },
    }
    const result = migrate_2_to_3(data)
    expect(result.incomeChecks).toBe(data.incomeChecks)
    expect(result.settings).toEqual(data.settings)
  })

  it('does not mutate the input data object', () => {
    const data = {
      incomeChecks: [],
      expenseItems: [] as unknown[],
      sinkingFunds: [] as unknown[],
      accounts: [],
      settings: {},
    }
    const result = migrate_2_to_3(data)
    expect(result).not.toBe(data)
  })
})

describe('toMonthlyEquivalent', () => {
  it('returns amount as-is for monthly cadence', () => {
    expect(toMonthlyEquivalent(1200, 'monthly')).toBe(1200)
  })

  it('returns amount/12 for annual cadence', () => {
    expect(toMonthlyEquivalent(982, 'annual')).toBeCloseTo(982 / 12)
  })

  it('returns 0 for oneoff cadence', () => {
    expect(toMonthlyEquivalent(500, 'oneoff')).toBe(0)
  })

  it('returns 0 for monthly cadence with amount 0', () => {
    expect(toMonthlyEquivalent(0, 'monthly')).toBe(0)
  })
})
