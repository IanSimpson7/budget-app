import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FLOORS,
  ImportError,
  type ExportEnvelope,
  type Floors,
} from '../storage/schema'
import * as storage from '../storage/storage'

// Reset IDB between every test so each test sees a fresh DB.
beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

describe('storage abstraction (FOUND-02)', () => {
  it('getFloors returns DEFAULT_FLOORS when settings table is empty', async () => {
    const floors = await storage.getFloors()
    expect(floors).toEqual(DEFAULT_FLOORS)
  })

  it('saveFloors writes to settings table; subsequent getFloors returns the saved value', async () => {
    const next: Floors = { passive: 2900, defended: 3100, foodSeed: 600 }
    await storage.saveFloors(next)
    const floors = await storage.getFloors()
    expect(floors).toEqual(next)
  })

  it('storage public surface exposes no credential / money-movement / floor-lowering methods', () => {
    // Compile-time + runtime structural enforcement of C1 / C2 / C3.
    // The forbidden methods MUST NOT exist on the storage module export surface.
    const s = storage as unknown as Record<string, unknown>
    expect(s.saveCredentials).toBeUndefined()
    expect(s.setApiKey).toBeUndefined()
    expect(s.storeBankToken).toBeUndefined()
    expect(s.moveMoney).toBeUndefined()
    expect(s.executeSweep).toBeUndefined()
    expect(s.decreaseFoodFloor).toBeUndefined()

    // TypeScript-level enforcement: the property does not exist on the typed surface.
    // @ts-expect-error — saveCredentials is structurally absent from storage (C2)
    storage.saveCredentials
    // @ts-expect-error — moveMoney is structurally absent from storage (C3)
    storage.moveMoney
  })
})

describe('export envelope (FOUND-03)', () => {
  it('exportAll returns envelope with schemaVersion === CURRENT_SCHEMA_VERSION and a parseable ISO exportedAt', async () => {
    const envelope = await storage.exportAll()
    expect(envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(envelope.schemaVersion).toBe(2)
    expect(typeof envelope.exportedAt).toBe('string')
    expect(Number.isNaN(Date.parse(envelope.exportedAt))).toBe(false)
    expect(typeof envelope.appVersion).toBe('string')
  })

  it('envelope.data.settings contains the current floors (defaults when nothing saved)', async () => {
    const envelope = await storage.exportAll()
    expect(envelope.data.settings.floors).toEqual(DEFAULT_FLOORS)
  })

  it('envelope.data.settings.floors reflects a persisted save', async () => {
    const next: Floors = { passive: 2500, defended: 3050, foodSeed: 575 }
    await storage.saveFloors(next)
    const envelope = await storage.exportAll()
    expect(envelope.data.settings.floors).toEqual(next)
  })
})

describe('import path (FOUND-04)', () => {
  const validEnvelope = (overrides: Partial<ExportEnvelope> = {}): ExportEnvelope =>
    ({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [],
        accounts: [],
        settings: { floors: { passive: 2700, defended: 3150, foodSeed: 700 } as Floors },
      },
      ...overrides,
    }) as ExportEnvelope

  const makeFile = (content: string, name = 'backup.json'): File =>
    new File([content], name, { type: 'application/json' })

  it('importAll with schemaVersion === current replaces settings state', async () => {
    // Seed the DB with one value, then import a different value, observe replacement.
    await storage.saveFloors({ passive: 1, defended: 2, foodSeed: 3 })
    const envelope = validEnvelope()
    await storage.importAll(makeFile(JSON.stringify(envelope)))
    const after = await storage.getFloors()
    expect(after).toEqual(envelope.data.settings.floors)
  })

  it('importAll with schemaVersion > current throws ImportError VERSION_TOO_NEW and leaves state unchanged', async () => {
    const seed: Floors = { passive: 1234, defended: 5678, foodSeed: 90 }
    await storage.saveFloors(seed)

    const tooNew = validEnvelope({ schemaVersion: 999 })

    await expect(storage.importAll(makeFile(JSON.stringify(tooNew)))).rejects.toBeInstanceOf(
      ImportError,
    )
    try {
      await storage.importAll(makeFile(JSON.stringify(tooNew)))
    } catch (e) {
      expect((e as ImportError).code).toBe('VERSION_TOO_NEW')
    }

    const after = await storage.getFloors()
    expect(after).toEqual(seed)
  })

  it('importAll with invalid JSON throws ImportError PARSE_ERROR and leaves state unchanged', async () => {
    const seed: Floors = { passive: 11, defended: 22, foodSeed: 33 }
    await storage.saveFloors(seed)

    try {
      await storage.importAll(makeFile('not json at all {{{'))
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
      expect((e as ImportError).code).toBe('PARSE_ERROR')
    }

    const after = await storage.getFloors()
    expect(after).toEqual(seed)
  })

  it('importAll with JSON missing schemaVersion throws ImportError INVALID_ENVELOPE', async () => {
    const broken = JSON.stringify({ exportedAt: new Date().toISOString(), data: { settings: {} } })
    try {
      await storage.importAll(makeFile(broken))
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
      expect((e as ImportError).code).toBe('INVALID_ENVELOPE')
    }
  })

  it('importAll with schemaVersion === 0 runs migration ladder (identity placeholder for v1)', async () => {
    // The MIGRATIONS map ships empty in v1 (no historical source versions to migrate from).
    // Asking for migration FROM version 0 must therefore raise INVALID_ENVELOPE
    // — i.e. the import path refuses unknown source versions rather than silently coercing.
    const envelope = validEnvelope({ schemaVersion: 0 })
    try {
      await storage.importAll(makeFile(JSON.stringify(envelope)))
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
      expect((e as ImportError).code).toBe('INVALID_ENVELOPE')
    }
  })
})
