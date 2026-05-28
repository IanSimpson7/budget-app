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

// jsdom's Blob / File do not implement .text() / .arrayBuffer(). Polyfill from
// the constructor parts so storage.importAll(file) can read backups in tests.
// Real browsers ship these natively; this shim only runs in the test env.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

afterEach(() => {
  cleanup()
})
