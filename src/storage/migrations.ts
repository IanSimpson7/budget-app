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

export const MIGRATIONS: Record<number, MigrationFn> = {
  1: migrate_1_to_2,
}
