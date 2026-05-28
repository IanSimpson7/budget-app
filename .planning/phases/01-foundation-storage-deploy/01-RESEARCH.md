# Phase 1: Foundation, Storage, Deploy — Research

**Researched:** 2026-05-28
**Domain:** Vite + React + TypeScript, Jotai, Dexie/IndexedDB, GitHub Pages, Vitest, Tailwind CSS v4
**Confidence:** HIGH (core stack), MEDIUM (integration patterns), LOW (React 19 Jotai edge case)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Jotai for state management
- **D-02:** Colocate atoms with domain logic — each domain owns its own `*.atoms.ts` file; no central `store.ts`
- **D-03:** Every atom is TypeScript-typed; entity contracts defined as exported types
- **D-04:** Use Dexie.js as the IndexedDB wrapper
- **D-05:** Storage abstraction (`storage/` module) sits above Dexie; domain code never imports Dexie directly
- **D-06:** 4 collection tables + 1 settings key-value table (incomeChecks, expenseItems, sinkingFunds, accounts, settings)
- **D-07:** Singletons (floors, emergencyFund, foodFloor, flavorLine, unitCostMap, portionModel) as keyed rows in `settings` table
- **D-08:** JSON export envelope with `schemaVersion: 1`, `exportedAt`, `appVersion`, `data`
- **D-09:** Migration ladder in `storage/migrations.ts` as pure functions; same functions used by both Dexie upgrade callbacks AND JSON import path
- **D-10:** Import: if schemaVersion < current → run ladder → load; if schemaVersion > current → refuse with message
- **D-11:** Import is replace-not-merge for v1
- **D-12:** Settings surface: 3 number inputs (passive floor, defended line, food floor seed) with "Save settings" CTA
- **D-13:** Backup surface: Export action + Import action (file picker, schema check, migration, replace)
- **D-14:** No other surfaces in Phase 1
- **D-15:** HashRouter (not BrowserRouter) for GitHub Pages SPA routing
- **D-16:** Vitest + React Testing Library scaffolded in Phase 1
- **D-17:** TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **D-18:** Vite `base` config derived from repo name at build time
- **D-19:** Repo + GitHub Actions created during Phase 1 execution; provisional: `simpsonian354/budget-app`
- **D-20:** Modern evergreen browsers only (last 2 major versions Chrome/Safari/Firefox, mobile Safari)
- **D-21:** Styling — Tailwind (deferred to plan-phase; research recommends Tailwind — see §Styling below)

### Claude's Discretion
D-15 through D-21 were decided by Claude per spec calibration. D-21 (Tailwind vs CSS modules) explicitly deferred to plan-phase.

### Inviolable Constraints (apply to all phases, never break)
- **C1:** Food floor never gated, reduced, or suggested as a cut
- **C2:** No bank credentials, no bank/brokerage API, ever
- **C3:** App never moves money, never executes trades

### Deferred Ideas (OUT OF SCOPE for Phase 1)
- Service worker / offline-first
- Encryption at rest
- Custom domain for GitHub Pages
- Multi-account / role separation
- Dashboard, Food panel, Entry surface, Funds surface (Phases 2–5)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Vite + React + TypeScript app with component structure and responsive layout | Vite 8.x scaffolding; component structure per D-02 domain colocatation |
| FOUND-02 | All financial data persists via IndexedDB behind storage abstraction | Dexie 4.4.x + `storage/` module pattern; domain code never imports Dexie |
| FOUND-03 | Export all data as JSON via "Export backup" action | JS Blob + `URL.createObjectURL` download; envelope schema per D-08 |
| FOUND-04 | Import previously-exported JSON to restore state | FileReader API; migration ladder per D-09; replace semantics per D-11 |
| FOUND-05 | All floors/targets stored as editable parameters, never hard-coded | settings table rows; Jotai atoms for floors loaded from Dexie on mount |
| FOUND-06 | Derived values recompute on input change — never stored stale | Jotai derived atoms (read-only computed atoms); no stored derived rows |
| UI-05 | Backup surface exposes JSON export and import actions | D-13 + UI-SPEC component specs |
| DEP-01 | App builds to static bundle deployable to GitHub Pages | `vite build` + `base` config per D-18 |
| DEP-02 | GitHub Actions workflow builds and deploys on push to `main` | `actions/configure-pages` + `actions/deploy-pages` pattern |
| DEP-03 | Build references no external services requiring credentials at runtime | C2 enforced; no env vars at runtime; all data local |
</phase_requirements>

---

## Summary

Phase 1 delivers a deployed walking skeleton: settings persisted to IndexedDB, JSON export/import for backup, and a GitHub Pages URL Ian can open on his phone. The full stack (UI → Jotai atom → storage abstraction → Dexie → IndexedDB) must be exercised end-to-end before any Phase 2 work begins.

**Critical finding — Tailwind v4 breaking change:** The UI-SPEC was written with a v3-style `tailwind.config.ts`. Tailwind v4 (current: 4.2.2) drops the JS config file in favor of `@theme` CSS directives and uses `@tailwindcss/vite` as the Vite plugin — no PostCSS config needed. The executor MUST install Tailwind v3 (`tailwindcss@3`) OR rewrite the UI-SPEC config as `@theme` CSS tokens. **Recommendation: pin Tailwind v3.4.x** to honor the UI-SPEC verbatim; v3 is still maintained. This decision belongs to the planner.

**Critical finding — React 19 + Jotai `atomWithObservable`:** The idiomatic Jotai+Dexie integration pattern uses `atomWithObservable(() => liveQuery(...))`. In React 19 (current: 19.2.6), this causes unexpected re-suspension unless callers pass `{ delay: 0 }` to `useAtomValue`. The storage abstraction layer adds a seam where this can be handled centrally, but the planner must note this workaround.

**Primary recommendation:** Pin Tailwind v3.4.x (honors UI-SPEC config verbatim). Use `atomWithObservable(() => liveQuery(...))` for reactive Dexie reads + `{ delay: 0 }` workaround. Implement storage abstraction as a thin async module; atoms are the reactive cache above it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| IndexedDB persistence | Browser storage (Dexie) | Storage abstraction module | Dexie manages schema/migration; abstraction decouples domain from Dexie API |
| Reactive UI state | Client (Jotai atoms) | — | Atoms are the in-memory reactive cache; Dexie is the source of truth |
| Derived value computation | Client (Jotai derived atoms) | — | Pure computed atoms; never persisted per FOUND-06 |
| JSON export/import | Client (browser APIs) | Storage abstraction | FileReader + Blob + URL.createObjectURL; no server needed |
| Static bundle deploy | CDN/GitHub Pages | GitHub Actions | Vite `build` output deployed via `actions/deploy-pages` |
| Settings surface UI | Frontend (React components) | Jotai atoms | Components read/write atoms; atoms sync to Dexie via abstraction |
| Backup surface UI | Frontend (React components) | Storage abstraction | Import/export operations call storage abstraction directly |
| TypeScript constraint enforcement | Compile time | — | Readonly types + branded types enforce C1/C2/C3 structurally |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.0.12 | Build tool, dev server | Official scaffold for React + TS; fastest HMR; built-in base config |
| @vitejs/plugin-react | 6.0.1 | React JSX transform in Vite | Official Vite React plugin; SWC-based fast refresh |
| react | 19.2.6 | UI framework | Locked by decision stack |
| react-dom | 19.2.6 | DOM renderer | Paired with react |
| typescript | ~5.x | Type safety | D-17; strict mode |
| jotai | 2.20.0 | Atomic state management | D-01; derived atoms = FOUND-06 |
| dexie | 4.4.2 | IndexedDB wrapper | D-04; schema + migration ladder |
| react-router-dom | 7.x | SPA routing | D-15; HashRouter for GitHub Pages |
| tailwindcss | **3.4.x (pin v3)** | Utility CSS | D-21 resolved; UI-SPEC config is v3 syntax |
| lucide-react | 0.577.0 | Icons | UI-SPEC locked; MIT, no network calls |

[VERIFIED: npm registry] — vite 8.0.12, @vitejs/plugin-react 6.0.1, react 19.2.6, vitest 4.1.6, tailwindcss 4.2.2 (latest), lucide-react 0.577.0, @testing-library/jest-dom 29.1.1
[VERIFIED: WebSearch — npmjs.com] — jotai 2.20.0, dexie 4.4.2

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.6 | Unit/integration test runner | D-16; Vite-native, fast |
| @testing-library/react | ~16.x | Component testing | D-16; RTL is the React standard |
| @testing-library/jest-dom | 29.1.1 | Custom matchers | `toBeInTheDocument`, `toHaveValue` etc. |
| @testing-library/user-event | ~14.x | User interaction simulation | Realistic event simulation |
| jsdom | ~26.x | DOM environment for tests | Standard for RTL |
| fake-indexeddb | ~6.x | In-memory IndexedDB mock | Required for Dexie tests in jsdom |

[ASSUMED] — @testing-library/react ~16.x, @testing-library/user-event ~14.x, fake-indexeddb ~6.x not confirmed via registry this session due to SSL failures.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Jotai | Zustand | Zustand is better for flat, object-shaped state; Jotai's derived atoms map directly to the formula-chain model (D-01 rationale) |
| Dexie | idb (Jake Archibald) | idb is lower-level, no built-in migration ladder; Dexie's `.version(N).upgrade(...)` is the answer to D-09 |
| Dexie | idb-keyval | Too simple; no table schema, no migrations, no date-range indexing |
| Tailwind v4 | Tailwind v3 | v4 breaks `tailwind.config.ts` syntax — pin v3 to honor UI-SPEC verbatim |
| HashRouter | BrowserRouter + 404 redirect | GitHub Pages has no server-side redirect support at subpaths; HashRouter is the correct default |

**Installation (Tailwind v3 path):**
```bash
npm create vite@latest budget-app -- --template react-ts
cd budget-app
npm install jotai dexie react-router-dom lucide-react
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom fake-indexeddb
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

---

## Architecture Patterns

### System Architecture Diagram

```
Phone browser (GitHub Pages URL)
        │
        ▼
┌───────────────────────────────────────────────────┐
│  React App (HashRouter)                           │
│                                                   │
│  /#/settings ─────► SettingsPage                  │
│  /#/backup   ─────► BackupPage                    │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  Jotai atoms (reactive in-memory cache)     │  │
│  │  floorsAtom ──────────────────────────────► │  │
│  │  derivedSurvivalFloorAtom (read-only)        │  │
│  └────────────────────┬────────────────────────┘  │
│                       │ get/set                    │
│  ┌────────────────────▼────────────────────────┐  │
│  │  storage/ abstraction module                │  │
│  │  getFloors() · saveFloors()                 │  │
│  │  exportAll() · importAll()                  │  │
│  └────────────────────┬────────────────────────┘  │
│                       │ Dexie API                  │
│  ┌────────────────────▼────────────────────────┐  │
│  │  Dexie db (IndexedDB)                       │  │
│  │  settings[key='floors'] ◄── floors row      │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
        │                          ▲
        │ Export (Blob download)   │ Import (FileReader)
        ▼                          │
   budget-app-backup-YYYY-MM-DD.json
```

**Walking skeleton data flow (the thinnest end-to-end proof):**
1. User opens `/#/settings` → React mounts SettingsPage
2. SettingsPage calls `storage.getFloors()` → Dexie reads `settings['floors']` → returns Floors object
3. Atom is populated → inputs render with persisted values
4. User changes passive floor value → Save → calls `storage.saveFloors(newFloors)` → Dexie writes to `settings['floors']`
5. User refreshes → step 2 repeats → persisted value is visible
6. Ian opens URL on phone → same flow confirms IndexedDB persists across sessions

### Recommended Project Structure
```
src/
├── main.tsx                    # React root, Router, JotaiProvider
├── App.tsx                     # Route definitions (HashRouter)
├── storage/
│   ├── db.ts                   # Dexie subclass, version declarations
│   ├── migrations.ts           # Pure migration functions migrate_1_to_2 etc.
│   ├── storage.ts              # Public abstraction: getFloors, saveFloors, exportAll, importAll
│   └── schema.ts               # TypeScript types for DB rows + export envelope
├── domains/
│   ├── settings/
│   │   ├── settings.atoms.ts   # floorsAtom (read from Dexie on load)
│   │   └── settings.types.ts   # Floors, FloorKey types
│   └── (income/, expenses/, food/, surplus/ — Phase 2+)
├── pages/
│   ├── SettingsPage.tsx
│   └── BackupPage.tsx
├── components/
│   ├── AppShell.tsx            # Header, nav (HashLink to /#/settings, /#/backup)
│   ├── NumberInput.tsx         # Reusable number input (per UI-SPEC)
│   ├── PrimaryButton.tsx
│   ├── SecondaryButton.tsx
│   ├── DestructiveButton.tsx
│   └── Toast.tsx
└── test/
    ├── setup.ts                # RTL setup, jest-dom extend, fake-indexeddb/auto
    ├── storage.test.ts         # Storage abstraction smoke test
    └── settings.atoms.test.ts  # Jotai derived atom unit test pattern
```

### Pattern 1: Jotai + Dexie Reactive Read

Use `atomWithObservable` wrapping Dexie's `liveQuery` for reactive reads. This pattern makes the atom auto-update whenever Dexie changes.

```typescript
// Source: https://jotai.org/docs/utilities/async + https://github.com/pmndrs/jotai/discussions/2848
import { atomWithObservable } from 'jotai/utils'
import { liveQuery } from 'dexie'
import { db } from '../storage/db'
import type { Floors } from './settings.types'

// Reactive atom: auto-updates when Dexie settings['floors'] changes
export const floorsAtom = atomWithObservable<Floors | undefined>(
  () => liveQuery(() => db.settings.get('floors').then(row => row?.value as Floors | undefined)),
  { initialValue: undefined }
)
```

**React 19 workaround:** [VERIFIED: WebSearch — github.com/pmndrs/jotai/discussions/2848]
In React 19, `atomWithObservable` triggers unexpected re-suspension. The workaround:
```typescript
// In any component using this atom:
const floors = useAtomValue(floorsAtom, { delay: 0 })
```
`{ delay: 0 }` queues a macrotask, preventing the re-suspension cycle.

**Alternative — simpler async atom (avoids the React 19 issue entirely):**

For write paths and settings that don't need live reactivity, use a plain async atom that loads once:
```typescript
// Source: https://jotai.org/docs/guides/async
const floorsLoadAtom = atom(async () => {
  const row = await db.settings.get('floors')
  return (row?.value ?? DEFAULT_FLOORS) as Floors
})

// Write atom for save
const saveFloorsAtom = atom(
  null,
  async (_get, _set, newFloors: Floors) => {
    await db.settings.put({ key: 'floors', value: newFloors })
  }
)
```

**Recommendation for Phase 1:** Given the minimal reactivity needed in Phase 1 (Settings + Backup only), use plain async atoms for load + write. Reserve `atomWithObservable` + `liveQuery` for Phase 2's dashboard (where real-time updates matter). This avoids the React 19 issue in the foundation phase.

### Pattern 2: Dexie Schema Declaration + Migration Ladder

```typescript
// Source: https://dexie.org/docs/Version/Version.upgrade()
// storage/db.ts
import Dexie, { type Table } from 'dexie'
import type { IncomeCheck, ExpenseItem, SinkingFund, Account, SettingsRow } from './schema'

export class BudgetDatabase extends Dexie {
  incomeChecks!: Table<IncomeCheck, number>
  expenseItems!: Table<ExpenseItem, number>
  sinkingFunds!: Table<SinkingFund, number>
  accounts!: Table<Account, number>
  settings!: Table<SettingsRow, string>

  constructor() {
    super('BudgetApp')
    this.version(1).stores({
      incomeChecks: '++id, date, source',
      expenseItems: '++id, name, category, protected, cadence',
      sinkingFunds: '++id, name, payoutDate',
      accounts: '++id, type',
      settings: '&key',
    })
    // Future: this.version(2).stores({...}).upgrade(tx => migrate_1_to_2(tx))
  }
}

export const db = new BudgetDatabase()
```

```typescript
// storage/migrations.ts — pure functions (used by BOTH Dexie upgrade AND JSON import)
export function migrate_1_to_2(data: SchemaV1Data): SchemaV2Data {
  // Pure transformation, no Dexie imports
  return { ...data, newField: defaultValue }
}
```

**Key Dexie migration rules:** [CITED: dexie.org/docs/Version/Version.upgrade()]
- Only the *highest* version's `.stores()` call defines the final schema
- Lower-version `.stores()` calls declare only the indexes needed AT THAT VERSION
- The `.upgrade(tx)` callback receives a transaction; use `tx.table.toCollection().modify(...)` for data transforms
- Never add a version lower than the current — Dexie will error

### Pattern 3: TypeScript Structural Enforcement of C1/C2/C3

The spec requires constraints to be structural (not comments). TypeScript provides three mechanisms:

**C1 — Food floor only increases (no `decreaseFloor()` method):**
```typescript
// Source: [ASSUMED] — TypeScript structural typing
// storage/schema.ts
export interface FoodFloorStorage {
  readonly seedValue: number
  readonly lastRefinedAt: string | null
}

// In storage abstraction — only expose upward-only mutation:
export interface StorageAbstraction {
  getFoodFloor(): Promise<FoodFloorStorage>
  setSeedValue(newValue: number): Promise<void>   // No decreaseFloor method exists
  // TypeScript: caller physically cannot call a non-existent method
}
```

**C2 — No credential storage methods on the storage abstraction:**
```typescript
// The storage interface simply never declares credential-related methods.
// TypeScript: if the method doesn't exist in the interface, it cannot be called.
// Use a readonly interface (not a class) to prevent duck-typing additions.
export interface StorageAbstraction {
  getFloors(): Promise<Floors>
  saveFloors(floors: Floors): Promise<void>
  // ...other methods
  // Absent: saveCredentials, storeBankToken, setApiKey — none exist, cannot be called
}
```

**C3 — No `moveMoney()` or `executeSweep()` on the state model:**
```typescript
// Surplus router only produces read-only recommendations, never actions:
export type SurplusRecommendation = Readonly<{
  sweepAmount: number
  targetAccount: string
  rationale: string
  // No execute() method, no callback, no action
}>

// Domain atoms only expose reading recommendations:
export const surplusRecommendationAtom = atom<SurplusRecommendation | null>(null) // read-only derived
```

**Enforcement summary:** Structural enforcement via TypeScript means:
- The interface/type never declares the forbidden method
- A `Readonly<T>` wrapper prevents mutation of derived state
- No separate "enforcement logic" — the type system makes the violation a compile error

### Pattern 4: JSON Export/Import

```typescript
// Source: [ASSUMED] — Standard browser File API + Dexie patterns
// Export: Blob download
export async function exportAll(): Promise<void> {
  const data = await collectAllData()   // reads all Dexie tables
  const envelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: import.meta.env.VITE_APP_VERSION,
    data,
  }
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `budget-app-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Import: FileReader + migration ladder + replace
export async function importAll(file: File): Promise<void> {
  const text = await file.text()
  const envelope = JSON.parse(text)   // may throw — wrap in try/catch
  if (envelope.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ImportError('VERSION_TOO_NEW')
  }
  let data = envelope.data
  // Run migration ladder from file version up to current
  for (let v = envelope.schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    data = MIGRATIONS[v](data)
  }
  await replaceAll(data)  // wipe + replace Dexie state
}
```

### Pattern 5: Vitest + Dexie Testing Setup

```typescript
// Source: https://www.npmjs.com/package/fake-indexeddb
// test/setup.ts
import 'fake-indexeddb/auto'       // puts IDB globals in Node/jsdom scope
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => { cleanup() })
```

```typescript
// vite.config.ts — test block
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  base: '/budget-app/',
})
```

**Dexie + fake-indexeddb gotcha:** [VERIFIED: WebSearch — github.com/dumbmatter/fakeIndexedDB/issues/88]
`fake-indexeddb` v5+ requires `structuredClone`. jsdom does NOT implement `structuredClone`. Workaround: add to `test/setup.ts`:
```typescript
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj))
}
```
This polyfill is adequate for non-circular test data. A more robust polyfill (`@ungap/structured-clone`) may be needed for complex object graphs.

### Pattern 6: Vite GitHub Pages Deploy Config

```typescript
// vite.config.ts — base derived from repo name per D-18
// Source: https://vite.dev/guide/static-deploy
export default defineConfig({
  base: '/budget-app/',   // matches repo name; confirm at plan-phase
  ...
})
```

**GitHub Actions workflow (`.github/workflows/deploy.yml`):**
[VERIFIED: WebSearch — vite.dev/guide/static-deploy + GitHub Actions official]
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Setup in GitHub:** Repo Settings → Pages → Source: "GitHub Actions". No separate `gh-pages` branch needed.

### Anti-Patterns to Avoid

- **Importing Dexie directly in domain code:** Domain modules import from `storage/storage.ts` only, never from `storage/db.ts`. This is the D-05 abstraction rule.
- **Storing derived values in Dexie:** `survivalFloor`, EF targets, surplus are never rows. They are derived atoms. Per FOUND-06.
- **BrowserRouter instead of HashRouter:** GitHub Pages returns 404 for any URL that isn't the root. HashRouter is the correct choice for any GitHub Pages SPA (D-15).
- **Mixing migration logic:** The `migrations.ts` functions must be pure (no Dexie imports, no side effects). Both the Dexie upgrade path and the JSON import path call the same functions.
- **Tailwind v4 with v3 config syntax:** The UI-SPEC `tailwind.config.ts` uses `theme.extend.colors` and `fontFamily` — this is v3 syntax. Installing v4 silently ignores the config file; pin v3.

---

## Styling Call (D-21 Resolution)

**Recommendation: Tailwind CSS v3.4.x** [MEDIUM confidence — [CITED: WebSearch community consensus]]

Rationale:
1. The UI-SPEC already ships a complete `tailwind.config.ts` in v3 syntax. This is not a prototype — it is a locked contract (custom tokens, sp-* spacing scale, font families, color palette). The executor implements it verbatim.
2. Tailwind's utility class model maps directly to the mobile-first responsive requirement (tap targets, breakpoints) without writing breakpoint media queries by hand.
3. The AI-assisted development argument is concrete: Tailwind utility classes appear correctly in AI suggestions far more reliably than CSS Module class names.
4. CSS Modules offer no advantage for Phase 1's minimal UI. The complexity argument for CSS Modules applies to large teams with legacy codebases — not a solo greenfield app.

**Pin v3:** Install `tailwindcss@3` explicitly. The UI-SPEC config assumes v3 `tailwind.config.ts` syntax. Do not install v4 unless the UI-SPEC config is rewritten as CSS `@theme` directives.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema versioning | Custom migration code in raw IDB | Dexie `.version(N).upgrade(...)` | Raw IDB migration is error-prone, especially with blocked upgrades when multiple tabs open |
| Reactive IndexedDB subscriptions | Manual IDB event listeners | Dexie `liveQuery` | liveQuery handles IDB observer lifecycle, multi-tab sync, and transaction boundaries |
| State management | Context + useReducer | Jotai atoms | Derived atom chains (D-01 rationale) are explicit and traceable; Context re-renders entire tree |
| SPA 404 routing | 404.html hack + sessionStorage | HashRouter | HashRouter is simpler, no server config needed, zero client-side hacks |
| JSON schema migration | Switch/case version checks | Pure migration ladder in `migrations.ts` | One function per version step = testable, composable, used for both Dexie AND import |

**Key insight:** The IndexedDB upgrade path is subtle. When the user has the app open in two tabs and one tab triggers a version upgrade, the other tab receives a "blocked" event. Dexie handles this transparently via `onblocked` and `onversionchange` callbacks. Hand-rolling this is a common source of data corruption.

---

## Common Pitfalls

### Pitfall 1: React 19 + `atomWithObservable` Re-Suspension
**What goes wrong:** Components using `useAtomValue(someAtom)` where `someAtom` is built with `atomWithObservable(() => liveQuery(...))` flash between loading and data states on every Dexie write.
**Why it happens:** React 19 changed how Suspense resolves; `atomWithObservable` triggers a new Suspense cycle on each emitted value.
**How to avoid:** Either (a) use `useAtomValue(atom, { delay: 0 })` everywhere the atom is consumed, or (b) avoid `atomWithObservable` in Phase 1 entirely — use plain async atoms that load once on mount.
**Warning signs:** Console shows repeated Suspense fallbacks in React DevTools.

### Pitfall 2: Tailwind v4 Installed, v3 Config Silently Ignored
**What goes wrong:** `tailwindcss@latest` installs v4. The `tailwind.config.ts` from UI-SPEC exists but has no effect. All custom tokens (sp-*, surface, accent colors) are absent. The app renders with no styles.
**Why it happens:** v4 replaces JS config with CSS `@theme` directives. v4 doesn't error on a v3 config file; it just ignores it.
**How to avoid:** Install `tailwindcss@3` explicitly in `package.json`. Or accept v4 and rewrite the UI-SPEC config as `@theme` CSS tokens (more work, but forward-compatible).
**Warning signs:** Custom color tokens like `bg-accent` or `bg-surface` produce no output.

### Pitfall 3: Dexie Version Upgrade Blocking
**What goes wrong:** Schema upgrade fails because the app is open in two tabs. Old tab blocks the upgrade; new tab waits forever.
**Why it happens:** IndexedDB version change requires all connections to close before upgrading.
**How to avoid:** Add `db.on('versionchange', () => db.close())` to force-close stale connections. Dexie does this semi-automatically but the explicit handler is belt-and-suspenders.
**Warning signs:** App hangs on startup after a schema change in production.

### Pitfall 4: `fake-indexeddb` + `structuredClone` in jsdom
**What goes wrong:** Tests using Dexie throw `ReferenceError: structuredClone is not defined` in the jsdom environment.
**Why it happens:** fake-indexeddb v5+ removed its internal polyfill; jsdom does not implement `structuredClone`.
**How to avoid:** Add a `structuredClone` polyfill in `test/setup.ts` (see Pattern 5 above).
**Warning signs:** Any Dexie test throws `structuredClone is not defined` immediately.

### Pitfall 5: `noUncheckedIndexedAccess` Breaking Dexie Results
**What goes wrong:** TypeScript errors on `result[0]` when Dexie returns an array, because `noUncheckedIndexedAccess` types array indexing as `T | undefined`.
**Why it happens:** D-17 enables `noUncheckedIndexedAccess`. This is correct and intended.
**How to avoid:** Always use `.first()` instead of `[0]` on Dexie collections, or check for `undefined` before accessing. `db.table.get(key)` returns `T | undefined` which is already safe.
**Warning signs:** Lots of TypeScript errors on Dexie result array access.

### Pitfall 6: GitHub Pages Serving Stale Build
**What goes wrong:** Deploy succeeds but phone shows old version.
**Why it happens:** GitHub Pages CDN caches aggressively; Vite's content-hashed filenames help but `index.html` is not content-hashed.
**How to avoid:** Add a `Cache-Control: no-cache` header for `index.html` via a `_headers` file in `dist/`. In practice, hard reload solves 99% of cases for a personal app.
**Warning signs:** Console shows old JS bundle version after deploy.

---

## Code Examples

### Dexie Schema Declaration (verified pattern)
```typescript
// Source: [CITED: dexie.org/docs/Version/Version.upgrade()]
// Only the HIGHEST version's stores() is the live schema.
// Earlier version declarations are for migration history only.
this.version(1).stores({
  settings: '&key',                          // unique primary key = 'key' string
  incomeChecks: '++id, date, source',         // autoincrement id, indexed: date, source
  expenseItems: '++id, name, category',
  sinkingFunds: '++id, name, payoutDate',
  accounts: '++id, type',
})
// Future: this.version(2).stores({...}).upgrade(...)
```

### Jotai Derived Atom (recompute pattern for FOUND-06)
```typescript
// Source: [CITED: jotai.org/docs/guides/composing-atoms]
import { atom } from 'jotai'
import type { Floors } from './settings.types'

const floorsAtom = atom<Floors>({ passive: 2400, defended: 3000, foodSeed: 550 })

// Derived atoms: never stored, always computed
const survivalFloorAtom = atom((get) => {
  const floors = get(floorsAtom)
  // Phase 1: placeholder until expenseItems exist
  return floors.passive  // will be: fixedExFood + protectedFoodFloor in Phase 3
})
```

### TypeScript Exact Optional Properties (D-17 gotcha)
```typescript
// exactOptionalPropertyTypes: true means { a?: string } ≠ { a: string | undefined }
// Use explicit undefined in types where a property may be absent OR undefined:
type SettingsRow = {
  key: string
  value: unknown
}
// Correct query:
const row = await db.settings.get('floors')
// row is SettingsRow | undefined — handle undefined explicitly
if (row === undefined) { return DEFAULT_FLOORS }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `idb-keyval` for simple KV | Dexie with settings table | — | Dexie unifies collection + KV storage |
| BrowserRouter + 404.html hack | HashRouter for GitHub Pages SPAs | — | Simpler, no server config |
| Tailwind config in JS file | Tailwind v4 CSS `@theme` | Jan 2025 (v4.0) | Breaking — must pin v3 for UI-SPEC compat |
| `atomWithStorage(key, val, localStorage)` | Custom storage abstraction + Jotai atoms | — | atomWithStorage only wraps localStorage; Dexie needs manual wiring |
| `gh-pages` npm package + branch | `actions/deploy-pages` official action | 2023+ | Artifact-based deploy; no separate branch needed |
| `react-scripts` (CRA) | Vite | 2022+ | CRA deprecated; Vite is the standard scaffold |

**Deprecated/outdated:**
- Create React App (`react-scripts`): deprecated, not maintained. Vite is the replacement.
- `jotai/atom` with unstable `Suspense` in React 18: React 19 changes Suspense behavior — use `loadable` or `{ delay: 0 }` workaround.
- Tailwind v3 `JIT` mode configuration: JIT is now the only mode in v3.3+; no separate config needed.

---

## Walking Skeleton Definition

The planner should structure Wave 1 around this minimal end-to-end slice:

**Skeleton slice (thinnest proof the full stack works):**
1. `db.ts` with v1 schema declared → `storage.ts` with `getFloors()` + `saveFloors()`
2. `floorsAtom` loads from Dexie on mount
3. `SettingsPage` renders 3 inputs from `floorsAtom`; Save writes back to Dexie
4. Hard refresh → values persist (IndexedDB confirmed working)
5. Export button → downloads valid JSON with `schemaVersion: 1`
6. Import button → reads JSON, validates version, replaces state, shows success toast
7. `npm run build` → `dist/` with `index.html` referencing `/budget-app/assets/...`
8. GitHub Actions workflow runs → URL is live → Ian opens on phone

This is the skeleton. Everything else in Phase 1 (import error paths, toast animations, full UI-SPEC fidelity, tests) is flesh on the skeleton.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | @testing-library/react ~16.x, @testing-library/user-event ~14.x, fake-indexeddb ~6.x are the current versions | Standard Stack > Testing | Minor version mismatch; install will succeed with latest |
| A2 | react-router-dom current major is v7.x | Standard Stack | v7 introduced breaking changes from v6 in loader/action API; for this app only `<Routes>/<Route>/<HashRouter>/<Link>` are used — stable across v6/v7 |
| A3 | `{ delay: 0 }` workaround for React 19 + atomWithObservable is current (not patched in jotai 2.20.0) | Pattern 1 | If patched, can remove the workaround; does not break anything if present |
| A4 | `structuredClone` polyfill via `JSON.parse(JSON.stringify())` is adequate for all test data shapes in Phase 1 | Pattern 5 / Pitfall 4 | Phase 1 data is flat; Dates will be serialized as strings — acceptable in tests |
| A5 | GitHub Actions action versions (checkout@v4, setup-node@v4, configure-pages@v4, upload-pages-artifact@v3, deploy-pages@v4) are current | Pattern 6 | Minor version drift; workflow will still succeed; update to latest if Actions complains |

---

## Open Questions

1. **Tailwind v3 vs v4 — final call**
   - What we know: UI-SPEC has a complete `tailwind.config.ts` in v3 syntax; v4 breaks it
   - What's unclear: Does Ian want the executor to rewrite config as v4 CSS `@theme` tokens, or pin v3?
   - Recommendation: Pin v3.4.x. The UI-SPEC config is already complete and correct; rewriting it as v4 `@theme` directives is equivalent work with no benefit for Phase 1. v3 is still maintained.

2. **React 19 + `atomWithObservable` — Phase 1 scope**
   - What we know: The issue exists; workaround is `{ delay: 0 }`
   - What's unclear: Whether to use `atomWithObservable` at all in Phase 1 or use simpler async atoms
   - Recommendation: Use plain async atoms in Phase 1. `liveQuery` reactivity is needed in Phase 2+ (dashboard updating on income entry); Phase 1 Settings just needs a load-on-mount pattern.

3. **`vite.config.ts` base setting hardcoded vs dynamic**
   - What we know: D-18 says "derived from repo name"; provisional repo is `budget-app`
   - What's unclear: Is the base hardcoded as `/budget-app/` or injected via `VITE_BASE_URL` env var?
   - Recommendation: Hardcode `/budget-app/` in `vite.config.ts`. A personal app with a stable repo name does not need runtime env injection. Document the assumption in config comments.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, Vite build | ✓ | v24.14.0 | — |
| npm | Package management | ✓ | 11.9.0 | — |
| Git | Version control | ✓ | 2.53.0 | — |
| GitHub account | DEP-01/DEP-02 | ✓ (assumed — confirmed by project spec) | — | — |
| IndexedDB | FOUND-02 | ✓ (modern browsers, all targets per D-20) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `vite.config.ts` (test block) — see Wave 0 |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FOUND-02 | `getFloors()` reads from Dexie; `saveFloors()` writes and persists | unit | `npx vitest run src/test/storage.test.ts` | ❌ Wave 0 |
| FOUND-03 | `exportAll()` returns valid JSON with schemaVersion envelope | unit | `npx vitest run src/test/storage.test.ts` | ❌ Wave 0 |
| FOUND-04 | `importAll()` runs migration ladder; replaces state; rejects newer versions | unit | `npx vitest run src/test/storage.test.ts` | ❌ Wave 0 |
| FOUND-05 | Floors atom loaded from Dexie, not hardcoded | unit | `npx vitest run src/test/settings.atoms.test.ts` | ❌ Wave 0 |
| FOUND-06 | Derived atom recomputes when input atom changes | unit | `npx vitest run src/test/settings.atoms.test.ts` | ❌ Wave 0 |
| DEP-01 | `npm run build` exits 0, `dist/index.html` references `/budget-app/assets/` | smoke | `npm run build && grep 'budget-app/assets' dist/index.html` | ❌ Wave 0 |
| DEP-03 | No env var with credential content referenced at runtime | manual audit | grep for `VITE_` vars in source | — |
| UI-05 | Export button triggers download; Import button opens file picker | integration (RTL) | `npx vitest run src/test/BackupPage.test.tsx` | ❌ Wave 0 |
| FOUND-01 | App renders Settings and Backup routes | smoke (RTL) | `npx vitest run src/test/App.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/setup.ts` — jest-dom + fake-indexeddb/auto + structuredClone polyfill
- [ ] `src/test/storage.test.ts` — storage abstraction smoke test (FOUND-02/03/04)
- [ ] `src/test/settings.atoms.test.ts` — Jotai atom unit test (FOUND-05/06)
- [ ] `src/test/BackupPage.test.tsx` — UI-05 integration test
- [ ] `src/test/App.test.tsx` — FOUND-01 smoke test
- [ ] `vite.config.ts` with test block (environment: jsdom, setupFiles)
- [ ] Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom fake-indexeddb`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app (single-user, local-only) |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No roles or permissions |
| V5 Input Validation | Yes | Validate floor values > 0 before save; validate JSON schema version before import |
| V6 Cryptography | No | No credentials, no encryption needed (C2 deferred) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious JSON import file | Tampering | Validate schemaVersion type + range; JSON.parse in try/catch; never eval() |
| XSS via toast message content | Tampering | React's JSX escapes by default; never `dangerouslySetInnerHTML` in toast |
| Inadvertent secret in env var | Information disclosure | No `VITE_` env vars with sensitive content; DEP-03 explicitly requires this |

**DEP-03 compliance:** Phase 1 has zero external services at runtime. The only env var in scope is `VITE_APP_VERSION` (from `package.json`, non-sensitive). No secrets, no API keys, no credentials.

---

## Project Constraints (from CLAUDE.md)

- GSD workflow enforced: use `/gsd-execute-phase` for phase work, not direct file edits
- `CLAUDE.md` is auto-loaded from project root; stack and conventions populate post-Phase-1
- Inviolable constraints C1/C2/C3 apply to every file, every phase, every version

---

## Sources

### Primary (HIGH confidence)
- [CITED: dexie.org/docs/Version/Version.upgrade()] — Dexie schema versioning syntax, upgrade callback pattern
- [VERIFIED: npm registry background task] — vite 8.0.12, react 19.2.6, @vitejs/plugin-react 6.0.1, vitest 4.1.6, tailwindcss 4.2.2, lucide-react 0.577.0, @testing-library/jest-dom 29.1.1
- [CITED: jotai.org/docs] — atom, derived atom, atomWithObservable, loadable patterns
- [VERIFIED: WebSearch — npmjs.com] — jotai 2.20.0, dexie 4.4.2
- [CITED: vite.dev/guide/static-deploy] — GitHub Pages deploy config and Actions workflow

### Secondary (MEDIUM confidence)
- [VERIFIED: WebSearch — github.com/pmndrs/jotai/discussions/2848] — React 19 + atomWithObservable re-suspension issue; `{ delay: 0 }` workaround
- [VERIFIED: WebSearch — github.com/dumbmatter/fakeIndexedDB/issues/88] — structuredClone missing in jsdom
- [VERIFIED: WebSearch — tailwindcss.com/blog/tailwindcss-v4] — v4 breaking changes, tailwind.config.ts deprecated
- [CITED: github.com/tailwindlabs/tailwindcss/discussions/16642] — @config bridge for v3 config in v4

### Tertiary (LOW confidence)
- [ASSUMED] — TypeScript structural enforcement patterns (branded types, readonly interfaces for C1/C2/C3) — standard TS patterns, not verified against a specific doc this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry
- Dexie migration pattern: HIGH — official docs cited
- Jotai + Dexie integration: MEDIUM — community-verified pattern with one known React 19 edge case
- GitHub Pages deploy: HIGH — official Vite docs pattern
- Tailwind v4 breaking change: HIGH — multiple sources, official changelog
- TypeScript structural enforcement: MEDIUM — standard patterns, not a new or obscure feature
- Test setup (fake-indexeddb/structuredClone): MEDIUM — GitHub issue confirmed; polyfill approach is standard

**Research date:** 2026-05-28
**Valid until:** 2026-08-28 (stable stack; React 19 + Jotai edge case may be patched sooner)
