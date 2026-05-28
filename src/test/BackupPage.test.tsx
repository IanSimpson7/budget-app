import { describe, it, expect } from 'vitest'

// Wave 0 stubs — BackupPage implemented in a later plan.
describe('BackupPage test file discovery', () => {
  it('is discovered by vitest', () => {
    expect(1 + 1).toBe(2)
  })
})

describe('BackupPage (UI-05)', () => {
  it.todo('Export backup button triggers download')
  it.todo('Import backup button opens file picker')
  it.todo('Import with schemaVersion > current shows version-too-new toast')
})
