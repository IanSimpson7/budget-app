// Pure migration ladder. NO Dexie imports — these functions transform plain JS
// data structures so the SAME ladder can be used by (a) Dexie's .version(N).upgrade()
// callback during in-place schema upgrades and (b) the JSON-import path when
// loading a backup that was created against an older schema version (D-09).
//
// CONTRACT — when CURRENT_SCHEMA_VERSION advances to N:
//   1. Write `migrate_${N-1}_to_${N}(data: SchemaV(N-1)Data): SchemaV(N)Data` here
//   2. Register it: MIGRATIONS[N-1] = migrate_${N-1}_to_${N}
//   3. Add a matching `.version(N).stores({...}).upgrade(tx => { /* call same fn */ })`
//      in db.ts so existing Dexie databases pick up the new schema in-place
//   4. Bump CURRENT_SCHEMA_VERSION in schema.ts
//
// v1 ships an EMPTY MIGRATIONS map — there is no historical source version to
// migrate FROM. importAll will refuse any source schemaVersion that doesn't have
// a path to CURRENT_SCHEMA_VERSION (i.e. v1 only accepts schemaVersion === 1).

import type { KnownSource, SchemaV1Data } from './schema'

export type MigrationFn = (data: SchemaV1Data) => SchemaV1Data

// v1 → v2: seed settings.knownSources to [] when absent.
// Income rows untouched — v1 had none (table existed but was always empty).
// NO Dexie import — this is a pure data transform used by both the JSON import
// ladder (storage.ts importAll) and Dexie's .upgrade() callback (db.ts).
export function migrate_1_to_2(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    settings: {
      ...data.settings,
      knownSources:
        (data.settings.knownSources as KnownSource[] | undefined) ?? [],
    },
  }
}

// v2 → v3: expenseItems and sinkingFunds tables were created in v1 but never
// populated in Phases 1–2 (collectSchemaV1Data always exported [] stubs).
// This is structurally a no-op data transform — no rows to migrate. The step
// MUST exist to keep the migration ladder contiguous (D-09 single source of truth).
// Also handles the case where a v2 export envelope omits those keys (nullish-coalesce
// to [] ensures the caller always gets typed arrays back).
export function migrate_2_to_3(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    expenseItems: data.expenseItems ?? [],
    sinkingFunds: data.sinkingFunds ?? [],
  }
}

// v3 → v4: mealDefinitions table added (food domain, Phase 4).
// This is a data no-op: the new table is empty on upgrade; settings singletons
// (unitCostMap, portionModel, foodFloorMeta, flavorLine) initialize with defaults
// on first storage.get*() call — no migration data needed for them.
// The step MUST exist to keep the migration ladder contiguous (D-09).
// Also nullish-coalesces mealDefinitions to [] when the key is absent from a v3 export.
export function migrate_3_to_4(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    mealDefinitions: data.mealDefinitions ?? [],
    // settings singletons initialize at first read via ?? default in storage.ts
  }
}

export const MIGRATIONS: Record<number, MigrationFn> = {
  1: migrate_1_to_2,
  2: migrate_2_to_3,
  3: migrate_3_to_4,
}
