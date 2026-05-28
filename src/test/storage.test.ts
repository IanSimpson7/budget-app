import { describe, it, expect } from 'vitest'

// Wave 0 stubs — these will be implemented in plan 02.
// Placeholder real test ensures Vitest discovers this file.
describe('storage test file discovery', () => {
  it('is discovered by vitest', () => {
    expect(1 + 1).toBe(2)
  })
})

describe('storage abstraction (FOUND-02)', () => {
  it.todo('getFloors returns defaults when settings table is empty')
  it.todo('saveFloors writes to settings table keyed by floors')
  it.todo('storage interface exposes no credential methods')
})

describe('export envelope (FOUND-03)', () => {
  it.todo('exportAll returns envelope with schemaVersion 1 and exportedAt ISO string')
  it.todo('envelope.data contains settings.floors')
})

describe('import path (FOUND-04)', () => {
  it.todo('importAll with schemaVersion === current replaces state')
  it.todo('importAll with schemaVersion > current throws VERSION_TOO_NEW')
  it.todo('importAll with invalid JSON throws PARSE_ERROR')
})
