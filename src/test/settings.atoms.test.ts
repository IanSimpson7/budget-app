import { describe, it, expect } from 'vitest'

// Wave 0 stubs — implemented in plan 02.
describe('settings atoms test file discovery', () => {
  it('is discovered by vitest', () => {
    expect(1 + 1).toBe(2)
  })
})

describe('floors atom (FOUND-05)', () => {
  it.todo('floorsLoadAtom loads from Dexie, not hardcoded defaults when row exists')
  it.todo('floorsLoadAtom returns DEFAULT_FLOORS when settings row absent')
})

describe('derived recompute (FOUND-06)', () => {
  it.todo('derived atom recomputes when input atom value changes')
})
