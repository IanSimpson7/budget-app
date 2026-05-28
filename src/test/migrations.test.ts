import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { CURRENT_SCHEMA_VERSION, ImportError, type Floors } from '../storage/schema'
import { migrate_1_to_2, MIGRATIONS } from '../storage/migrations'
import * as storage from '../storage/storage'

// Reset IDB between every test so each test sees a fresh DB.
beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

describe('schema version', () => {
  it('CURRENT_SCHEMA_VERSION is 2', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2)
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

  it('importAll of a schemaVersion:3 envelope throws ImportError VERSION_TOO_NEW', async () => {
    const tooNew = {
      schemaVersion: 3,
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

  it('importAll of current schemaVersion:2 envelope succeeds', async () => {
    const floors: Floors = { passive: 2500, defended: 3000, foodSeed: 550 }
    const v2Envelope = {
      schemaVersion: 2,
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
