// Public storage abstraction. Domain code talks to this module ONLY — Dexie is
// never imported outside src/storage/. The public surface is intentionally
// minimal: getFloors, saveFloors, exportAll, importAll. Inviolable constraints
// C1 / C2 / C3 are STRUCTURALLY enforced by the absence of forbidden methods —
// no saveCredentials, setApiKey, storeBankToken, moveMoney, executeSweep,
// decreaseFoodFloor. Those names simply do not exist on this surface.

import { db } from './db'
import { MIGRATIONS } from './migrations'
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FLOORS,
  ImportError,
  type ExportEnvelope,
  type Floors,
  type SchemaV1Data,
} from './schema'

const FLOORS_KEY = 'floors'

export async function getFloors(): Promise<Floors> {
  const row = await db.settings.get(FLOORS_KEY)
  return (row?.value as Floors | undefined) ?? DEFAULT_FLOORS
}

export async function saveFloors(floors: Floors): Promise<void> {
  await db.settings.put({ key: FLOORS_KEY, value: floors })
}

async function collectSchemaV1Data(): Promise<SchemaV1Data> {
  const settingsRows = await db.settings.toArray()
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows) {
    settings[row.key] = row.value
  }
  // Ensure floors are always present in the export envelope (defaults when
  // never explicitly saved). Re-importing this envelope into a fresh DB
  // should reproduce the floors the user sees in the UI.
  if (settings[FLOORS_KEY] === undefined) {
    settings[FLOORS_KEY] = DEFAULT_FLOORS
  }
  return {
    incomeChecks: [],
    expenseItems: [],
    sinkingFunds: [],
    accounts: [],
    settings,
  }
}

export async function exportAll(): Promise<ExportEnvelope> {
  const data = await collectSchemaV1Data()
  const envelope: ExportEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0',
    data,
  }

  // Trigger download in real browsers only. jsdom logs a noisy
  // "navigation not implemented" warning on anchor click, so we skip the
  // download side-effect when running in a jsdom-flagged environment. The
  // envelope return value is the contract; the download is UX sugar.
  const isJsdom =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('jsdom')
  if (
    !isJsdom &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    URL.createObjectURL
  ) {
    try {
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `budget-app-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Non-fatal: download is a UX side effect. The envelope return is the contract.
    }
  }

  return envelope
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export async function importAll(file: File): Promise<void> {
  const text = await file.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError('PARSE_ERROR')
  }

  if (!isPlainObject(parsed)) {
    throw new ImportError('INVALID_ENVELOPE')
  }

  const schemaVersion = parsed['schemaVersion']
  const data = parsed['data']
  if (typeof schemaVersion !== 'number' || !isPlainObject(data)) {
    throw new ImportError('INVALID_ENVELOPE')
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ImportError('VERSION_TOO_NEW')
  }

  // Run the migration ladder from source version up to current. Any missing
  // step is an INVALID_ENVELOPE — we never silently coerce an unknown source
  // version.
  let migrated = data as unknown as SchemaV1Data
  for (let v = schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const fn = MIGRATIONS[v]
    if (!fn) {
      throw new ImportError('INVALID_ENVELOPE')
    }
    migrated = fn(migrated)
  }

  await replaceAll(migrated)
}

async function replaceAll(data: SchemaV1Data): Promise<void> {
  await db.transaction(
    'rw',
    [db.incomeChecks, db.expenseItems, db.sinkingFunds, db.accounts, db.settings],
    async () => {
      await Promise.all([
        db.incomeChecks.clear(),
        db.expenseItems.clear(),
        db.sinkingFunds.clear(),
        db.accounts.clear(),
        db.settings.clear(),
      ])

      const settings = data.settings ?? {}
      for (const [key, value] of Object.entries(settings)) {
        await db.settings.put({ key, value })
      }
      // incomeChecks / expenseItems / sinkingFunds / accounts are empty in v1.
    },
  )
}
