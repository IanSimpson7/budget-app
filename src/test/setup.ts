// structuredClone polyfill MUST come BEFORE fake-indexeddb/auto import.
// fake-indexeddb v5+ calls structuredClone internally, but jsdom does not implement it.
// See: github.com/dumbmatter/fakeIndexedDB/issues/88 and RESEARCH.md Pitfall 4.
if (typeof globalThis.structuredClone === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj)) as any
}

import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
