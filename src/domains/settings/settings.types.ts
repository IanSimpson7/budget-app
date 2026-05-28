// Settings domain types — single source of truth lives in the storage schema.
// Re-exported here so domain consumers can import from the domain barrel without
// reaching into src/storage/. The storage abstraction boundary (D-05) only
// constrains DATA-level imports (no Dexie in domains); shared TS types are fine.
export { DEFAULT_FLOORS, type Floors } from '../../storage/schema'
