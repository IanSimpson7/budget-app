# Phase 2: Income Model with Two Floors - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18 (2 have no direct analog — parser + reactive source atom)

> Every analog excerpt below is from a Phase-1 file that is the architectural source of truth.
> The inviolable structural rule: **domain code (`src/domains/`) imports `src/storage/storage.ts`, NEVER `src/storage/db.ts`.** Phase 2 introduces exactly ONE controlled seam to this (the reactive `liveQuery` source) and the recommended resolution keeps even that db-free via `storage.observeIncomeChecks()`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/storage/schema.ts` | schema/types | — | itself (Phase 1) | exact (extend) |
| `src/storage/db.ts` | persistence/Dexie | CRUD | itself (Phase 1) | exact (extend) |
| `src/storage/migrations.ts` | migration | transform | itself (Phase 1) | exact (extend) |
| `src/storage/storage.ts` | storage abstraction | CRUD + observable | itself (`getFloors/saveFloors`) | exact (extend) |
| `src/domains/income/income.atoms.ts` (source atom) | atom (reactive source) | event-driven (liveQuery) | `settings.atoms.ts` (boundary only) | **no direct analog** (new reactive pattern) |
| `src/domains/income/income.atoms.ts` (derived chain) | atom (derived) | transform/compute | `derivedSurvivalFloorAtom` | role-match |
| `src/domains/income/income.types.ts` | types re-export | — | `settings.types.ts` | exact |
| `src/domains/income/parser/parseStatement.ts` | utility (pure fn) | transform (string→rows) | — | **no analog** (new pure parser) |
| `src/domains/income/parser/checkingAdapter.ts` | utility (pure fn) | transform | — | **no analog** (RESEARCH Pattern 3) |
| `src/domains/income/parser/adapter.types.ts` | types/interface (seam) | — | `schema.ts` type-decl style | partial |
| `src/domains/income/classify.ts` | utility (pure fn) | transform/compute | `derivedSurvivalFloorAtom` logic style | partial |
| `src/domains/income/CheckEntryForm.tsx` | component (form) | request-response (write) | `SettingsPage.tsx` (draft+save+toast) | role-match |
| `src/domains/income/PasteParseFlow.tsx` | component (multi-step) | transform→write | `BackupPage.tsx` (state machine) | role-match |
| `src/domains/income/ConfirmTable.tsx` | component (editable table) | transform | `SettingsPage.tsx` (controlled inputs) | partial |
| `src/domains/income/BackfillAlertCard.tsx` | component (presentation) | read-only | `Toast.tsx` (role/aria block) | partial |
| `src/components/IncomeBar.tsx` | component (meter) | read-only | `Toast.tsx` (token-only presentation) | partial |
| `src/components/MetricCard.tsx` | component (presentation) | read-only | `NumberInput.tsx` (variant+token styling) | partial |
| `src/components/EntryTabBar.tsx` | component (ARIA tabs) | request-response | `AppShell.tsx` nav (active-state styling) | partial |
| `src/pages/DashboardPage.tsx` | page | read-only | `SettingsPage.tsx` / `BackupPage.tsx` | role-match |
| `src/pages/EntryPage.tsx` | page | request-response | `SettingsPage.tsx` | role-match |
| `src/App.tsx` (routes) | route config | — | itself (Phase 1) | exact (extend) |
| `src/components/AppShell.tsx` (nav) | nav | — | itself (Phase 1) | exact (extend) |

---

## Pattern Assignments

### `src/storage/schema.ts` (schema/types — EXTEND in place)

**Analog:** itself — `src/storage/schema.ts` lines 1–14.

**Existing type-declaration convention to copy** (lines 6–14):
```typescript
export const CURRENT_SCHEMA_VERSION = 1 as const   // → bump to 2

export type Floors = Readonly<{
  passive: number
  defended: number
  foodSeed: number
}>
export const DEFAULT_FLOORS: Floors = { passive: 2400, defended: 3000, foodSeed: 550 }
```

**Add (per RESEARCH Pattern 4 + D-08/D-12):** `IncomeCheck` type as a `Readonly<{...}>` (same style), `category: 'payroll' | 'gift' | 'other'`, `taxable: boolean`, `surplusOverride?: boolean`. Bump `CURRENT_SCHEMA_VERSION = 2 as const`. Add a `KnownSource` type and an `estimatePerCheck` settings shape. **Keep the header comment contract (lines 1–4): bumping the version REQUIRES paired edits in db.ts + migrations.ts.** No Dexie import here (line 1 rule).

**Note on `SchemaV1Data`** (lines 18–24): currently the data arrays are `unknown[]`. Phase 2 either keeps `incomeChecks: unknown[]` generic or introduces a `SchemaV2Data`. Match the existing loose-typed envelope shape; `replaceAll` (storage.ts) iterates settings by key, so adding `knownSources`/`estimatePerCheck` settings keys requires no envelope-shape change.

---

### `src/storage/db.ts` (Dexie — EXTEND with `.version(2)`)

**Analog:** itself — `src/storage/db.ts` lines 14–30.

**Existing version-declaration + table-typing pattern** (lines 7–22):
```typescript
export class BudgetDatabase extends Dexie {
  incomeChecks!: Table<unknown, number>
  // ...
  constructor() {
    super('BudgetApp')
    this.version(1).stores({
      incomeChecks: '++id, date, source',   // ALREADY declared — Phase 2 populates it
      // ...
    })
    this.on('versionchange', () => { this.close() })   // keep — multi-tab upgrade guard
  }
}
```

**Add (RESEARCH Pattern 4, Assumption A2):** chain a `this.version(2).stores({...})` after `.version(1)`. The `incomeChecks` index `'++id, date, source'` already covers all Phase-2 queries (date-month filter + source match are array scans on the liveQuery result), so the v2 store declaration can repeat the same indexes — **the version MUST still advance** so Dexie and the import ladder stay aligned. `category`/`taxable` are field-only additions → `.upgrade()` is a no-op row-rewrite (matches `migrate_1_to_2`). Consider typing the table `Table<IncomeCheck, number>` instead of `unknown`. KEEP the `versionchange` handler (lines 27–29).

---

### `src/storage/migrations.ts` (migration ladder — REGISTER `migrate_1_to_2`)

**Analog:** itself — `src/storage/migrations.ts` lines 1–21.

**The CONTRACT block to follow verbatim** (lines 6–11):
```
// CONTRACT — when CURRENT_SCHEMA_VERSION advances to N:
//   1. Write migrate_${N-1}_to_${N}(data): SchemaV(N)Data here
//   2. Register it: MIGRATIONS[N-1] = migrate_${N-1}_to_${N}
//   3. Add matching .version(N).stores().upgrade() in db.ts
//   4. Bump CURRENT_SCHEMA_VERSION in schema.ts
```

**Existing shape** (lines 17–21):
```typescript
export type MigrationFn = (data: SchemaV1Data) => SchemaV1Data
export const MIGRATIONS: Record<number, MigrationFn> = {}   // currently EMPTY
```

**Add (RESEARCH Pattern 4):** a PURE `migrate_1_to_2(data)` — NO Dexie import (line 1 rule). v1 had zero income rows; nothing to backfill. Seed empty `knownSources`: `{ ...data, settings: { ...data.settings, knownSources: data.settings.knownSources ?? [] } }`. Register `MIGRATIONS[1] = migrate_1_to_2`. **This is what makes a v1 JSON backup importable into v2** — `storage.importAll` walks `MIGRATIONS[v]` for `v` in `[schemaVersion, CURRENT)` and throws `INVALID_ENVELOPE` if a step is missing (storage.ts lines 123–129).

---

### `src/storage/storage.ts` (storage abstraction — ADD income CRUD + observable)

**Analog:** itself — `src/storage/storage.ts` lines 19–28 (the `getFloors/saveFloors` pair) and lines 1–6 (the structural-constraint header).

**Existing CRUD pattern to copy** (lines 19–28):
```typescript
const FLOORS_KEY = 'floors'

export async function getFloors(): Promise<Floors> {
  const row = await db.settings.get(FLOORS_KEY)
  return (row?.value as Floors | undefined) ?? DEFAULT_FLOORS
}
export async function saveFloors(floors: Floors): Promise<void> {
  await db.settings.put({ key: FLOORS_KEY, value: floors })
}
```

**Add (RESEARCH Responsibility Map + Open Question 1):**
- `addIncomeCheck(check)`, `addIncomeChecks(checks)` (batch — parallel per the parallelize-by-default rule), `listIncomeChecks(range?)`, `updateIncomeCheck(id, patch)`, `deleteIncomeCheck(id)` — all over `db.incomeChecks`.
- `getKnownSources()/saveKnownSources(list)` and `getEstimatePerCheck()/saveEstimatePerCheck(n)` — follow the `FLOORS_KEY` settings-singleton pattern exactly (a `KNOWN_SOURCES_KEY`/`ESTIMATE_KEY` constant + `db.settings.get/put`).
- **`observeIncomeChecks(): Observable<IncomeCheck[]>`** returning `liveQuery(() => db.incomeChecks.toArray())` (import `liveQuery` from `dexie`). This is the recommended seam (RESEARCH Pattern 1 note + Open Question 1) so the atom imports `storage`, not `db` — preserving the structural boundary (Pitfall 5).

**INVIOLABLE — copy this header intent** (lines 1–6): the C1/C2/C3 enforcement is the *absence* of credential/money-move/floor-lowering methods. **Add NO `saveCredentials`/`setApiKey`/`moveMoney`/`executeSweep`/`decreaseFoodFloor`.** Extend the absence-proof test (see test section).

**Also touch `replaceAll`** (lines 134–153): it currently clears + only re-seeds `settings`. Phase 2 must also re-seed `incomeChecks` from the imported data so a v2 backup round-trips income rows (Phase-1 left this `// empty in v1`).

---

### `src/domains/income/income.atoms.ts` — SOURCE atom (NO direct analog; new reactive pattern)

**Analog for the BOUNDARY only:** `settings.atoms.ts` lines 13–15 (imports `storage`, never `db`).

**Boundary convention from the analog** (settings.atoms.ts lines 9–15):
```typescript
// Boundary: this file imports from '../../storage/storage' (the public
// abstraction), NEVER from '../../storage/db' (the Dexie implementation).
import { atom } from 'jotai'
import * as storage from '../../storage/storage'
```

**New pattern (RESEARCH Pattern 1 — the de-risked React 19 path):**
```typescript
import { atomWithObservable } from 'jotai/utils'
import type { IncomeCheck } from './income.types'
import * as storage from '../../storage/storage'

// initialValue:[] → never suspends → sidesteps the React-19 re-suspense bug (Pitfall 1).
export const incomeChecksAtom = atomWithObservable<IncomeCheck[]>(
  () => storage.observeIncomeChecks(),    // recommended db-free seam
  { initialValue: [] },
)
```
**Why no `atomWithObservable` analog exists:** Phase 1 BANNED it (CLAUDE.md "no atomWithObservable until Phase 2"; SKELETON line 74). The settings atom (lines 20–35) uses the OLD plain-async + manual `refreshCounterAtom` pattern instead — DO NOT copy that for the live dashboard; use `atomWithObservable` now that the ban is lifted.

---

### `src/domains/income/income.atoms.ts` — DERIVED chain (role-match analog)

**Analog:** `settings.atoms.ts` lines 40–43 (`derivedSurvivalFloorAtom`) — the read-only-derived, never-persisted pattern (FOUND-06).

**Existing derived-atom pattern** (settings.atoms.ts lines 37–43):
```typescript
// Per FOUND-06 this is NEVER persisted — always recomputed from input atoms.
export const derivedSurvivalFloorAtom = atom(async (get): Promise<number> => {
  const floors = await get(floorsLoadAtom)
  return floors.passive
})
```

**Build the chain (RESEARCH Pattern 2 + Code Examples):** `currentMonthChecksAtom` → `mtdTotalAtom`, `mtdPayrollAtom`, `baselinePayrollAtom`, `landedPayrollCountAtom`, `projectedMonthPayrollAtom` (D-11), `surplusAtom` (D-03 passive floor), `backfillActiveAtom` (D-09 payroll-only vs defended). The defended-line atom comes from `floorsLoadAtom` (reuse the settings atom). **Three correctness rules baked into the math (Pitfalls 2/4 + Anti-patterns):**
1. Month classification = LOCAL midnight: `new Date(iso + 'T00:00:00')`, compare `getFullYear()/getMonth()` (NOT `new Date('2026-06-01')` UTC).
2. `backfillActiveAtom` compares **payroll-only** projection vs defended — gift income must NOT suppress it.
3. Never persist `projectedMonth`/`surplus`/`backfillActive` (FOUND-06).

---

### `src/domains/income/income.types.ts` (types re-export)

**Analog:** `src/domains/settings/settings.types.ts` (full file, 5 lines) — exact pattern.
```typescript
// Re-exported so domain consumers import from the domain barrel without
// reaching into src/storage/. Shared TS types are fine across the boundary.
export { DEFAULT_FLOORS, type Floors } from '../../storage/schema'
```
**Copy exactly:** re-export `type IncomeCheck` (and `Category`) from `../../storage/schema`. Add `CandidateRow` locally (a parse-time shape, not persisted). Note the comment's distinction (settings.types.ts lines 3–5): the boundary constrains DATA imports, not shared TYPE imports.

---

### `src/domains/income/parser/parseStatement.ts` + `checkingAdapter.ts` (NO analog — new pure functions)

**No codebase analog** — this is the one genuinely-new logic of the phase. Pattern source is RESEARCH Pattern 3 (full implementation given there, lines 286–313) + D-02..D-05. Key invariants:
- Pure `(text, adapter) → CandidateRow[]`. No I/O, no Dexie, no `eval`, no dynamic regex from input (Security V5).
- Block-based: `^\d{2}\/\d{2}\/\d{4}` starts a block; skip header `^date\s+description\s+amount\s+balance`/i; trailing `(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$` = `(netAmount, balanceAfter)`.
- `StatementAdapter` interface (`statementType: 'checking' | 'creditcard'`) is the Phase-3 seam (D-01) — Phase 2 ships only `checkingAdapter`.
- **Acceptance gate (Assumption A3):** validate against the real captured sample in `02-DISCUSSION-LOG.md`, copied verbatim to `parser/__fixtures__/checking-may-2026.txt`.

**Adapter-interface declaration style** — borrow the `Readonly`/explicit-export style from `schema.ts` (lines 8–12, 33–40).

---

### `src/domains/income/classify.ts` (NO analog — pure classification)

**No direct analog.** Pure functions for: default taxability from category (D-08: payroll→taxable, gift→non-taxable, other→taxable), surplus classification (D-12: 3rd+ payroll check by LOCAL calendar month, `surplusOverride` deviation), conservative auto-check default (D-05). Style: small pure exported functions, same local-midnight date rule as the atoms. Unit-tested in isolation (heavily testable — RESEARCH Test Map).

---

### `src/domains/income/CheckEntryForm.tsx` (component — form, role-match)

**Analog:** `src/pages/SettingsPage.tsx` lines 15–82 — the draft-state + validate + save + toast pattern.

**Pattern to copy** (SettingsPage lines 18–39):
```typescript
const persisted = useAtomValue(floorsLoadAtom, { delay: 0 })   // { delay: 0 } prophylaxis — copy
const save = useSetAtom(saveFloorsAtom)
const [draft, setDraft] = useState<Floors>(persisted)
const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
// per-field validation:
const passiveError = !(draft.passive > 0) ? 'Must be greater than 0' : undefined
const handleSave = async (): Promise<void> => {
  if (hasError) return
  await save(draft)
  setToast({ message: 'Settings saved.', variant: 'success' })
}
```
**Apply:** local draft per `IncomeCheck` field, `NumberInput` for `netAmount` (reuse), date + source + category inputs, validate (`netAmount > 0`, valid date), `storage.addIncomeCheck` via a write atom, success Toast. **Carry the `{ delay: 0 }`** at consumption sites (SettingsPage line 18 + comment lines 16–17) as belt-and-suspenders against Pitfall 1.

---

### `src/domains/income/PasteParseFlow.tsx` (component — multi-step state machine, role-match)

**Analog:** `src/pages/BackupPage.tsx` lines 24–71 — the explicit `useState` step-machine + try/catch + toast pattern.

**State-machine pattern to copy** (BackupPage lines 15, 24–28, 59–71):
```typescript
type ImportState = 'idle' | 'fileSelected' | 'importing'
const [importState, setImportState] = useState<ImportState>('idle')
const handleConfirmImport = async (): Promise<void> => {
  setImportState('importing')
  try {
    await storage.importAll(pendingFile)
    setToast({ message: 'Backup imported. Data restored.', variant: 'success' })
    reset()
  } catch (e) {
    const code = e instanceof ImportError ? e.code : 'PARSE_ERROR'
    setToast({ message: IMPORT_ERROR_COPY[code], variant: 'error' })
    reset()
  }
}
```
**Apply (RESEARCH diagram):** steps `textarea → parseStatement(text, checkingAdapter) → apply knownSources auto-check → ConfirmTable → commit checked rows via storage.addIncomeChecks + remember new sources`. Use the same `type Step = 'input' | 'confirm' | 'committing'` literal-union state. Render conditionally per step (BackupPage lines 90–128). **Never concatenate parsed content into toast text** (BackupPage comment lines 12–13, threat T-01-09 / Security V5).

---

### `src/domains/income/ConfirmTable.tsx` (component — editable table, partial)

**Analog:** `SettingsPage.tsx` controlled-input pattern (lines 46–69) + `NumberInput` reuse. No table analog exists. Each row = controlled checkbox (default per D-05) + editable category/taxable + amount. `min-h-[44px]` on every interactive element (CLAUDE.md). Commit only checked rows.

---

### `src/components/IncomeBar.tsx` (component — meter, partial)

**Analog:** `src/components/Toast.tsx` lines 16–48 — token-only presentation with ARIA role.

**Token-only + role pattern to copy** (Toast lines 22–44):
```typescript
const border = variant === 'success' ? 'border-success'
  : variant === 'error' ? 'border-destructive' : 'border-surface-border'
return (
  <div role="status" aria-live="polite" className={['fixed z-50', /* token classes only */].join(' ')}>
```
**Apply (D-13):** `role="meter"` with `aria-valuenow`/`aria-valuemax`; segments = solid MTD fill, lighter "ghost" to projected, solvency band to passive, marker tick at defended. **All colors from `tailwind.config.ts` tokens — NO inline hex** (CLAUDE.md). Financial values `font-mono`.

---

### `src/components/MetricCard.tsx` (component — presentation, partial)

**Analog:** `src/components/NumberInput.tsx` lines 8–15, 27–36 — the `variant`-prop + token-class-composition style.

**Variant + class-composition pattern** (NumberInput lines 27–36):
```typescript
const inputBase = 'bg-surface-raised text-text-primary font-sans text-[20px] font-semibold ...'
const errorClass = error ? 'border-destructive' : ''
// composed: `${inputBase} ${errorClass}`.trim()
```
**Apply (D-14):** `variant?: 'default' | 'alert'`; render the financial number in `font-mono`; the surplus card swaps to `BackfillAlertCard` when `backfillActiveAtom` is true (in-place replacement, pre-mirrors Phase-5 SURP-07).

---

### `src/domains/income/BackfillAlertCard.tsx` (component — alert, partial)

**Analog:** `Toast.tsx` lines 29–44 — the `role`/`aria-live` + token-class block. Use `role="alert"` (RESEARCH INC-06 row). Copy: "projected $X, below $3,000 — add sessions to defend" (D-14). Tokens only, `font-mono` for the dollar figure.

---

### `src/components/EntryTabBar.tsx` (component — ARIA tabs, partial)

**Analog:** `AppShell.tsx` lines 10–19 — the active-state class-toggle pattern.
```typescript
const navItemBase = 'inline-flex items-center min-h-[44px] px-sp-2 font-sans text-sm font-semibold ...'
function navClasses({ isActive }: { isActive: boolean }): string {
  return isActive ? `${navItemBase} ... border-b-2 border-accent`
    : `${navItemBase} ... border-b-2 border-transparent`
}
```
**Apply (UI-03):** two-tab control (Manual entry default + Paste-parse) with `role="tablist"`/`role="tab"`/`aria-selected`; `min-h-[44px]`; active border-accent indicator copied from the nav.

---

### `src/pages/DashboardPage.tsx` + `EntryPage.tsx` (pages, role-match)

**Analog:** `SettingsPage.tsx` / `BackupPage.tsx` — page shell pattern.
```typescript
return (
  <div className="flex flex-col gap-sp-6">
    <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Dashboard</h2>
    {/* card container */}
    <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6 ...">
```
(SettingsPage lines 41–45.) DashboardPage composes `IncomeBar` + 3× `MetricCard`/`BackfillAlertCard` over derived atoms (read-only, `{ delay: 0 }`). EntryPage composes `EntryTabBar` + `CheckEntryForm`/`PasteParseFlow`.

---

### `src/App.tsx` (routes — EXTEND) + `src/components/AppShell.tsx` (nav — EXTEND)

**Analog:** itself. App.tsx lines 18–23 (Route list) + AppShell.tsx lines 26–33 (NavLink list).

**Add routes** (App.tsx pattern, lines 19–22):
```typescript
<Route path="/dashboard" element={<DashboardPage />} />
<Route path="/entry" element={<EntryPage />} />
```
**Add nav links** (AppShell pattern, lines 27–32): `<NavLink to="/dashboard" className={navClasses}>Dashboard</NavLink>` etc. SKELETON caps at 6 flat routes (line 103) — Dashboard + Entry fit. Consider changing the index redirect (App.tsx line 19 `Navigate to="/settings"`) to `/dashboard` now that there is a dashboard. The `Suspense` fallback (App.tsx lines 15–17) already covers async atoms.

---

## Shared Patterns

### Storage boundary (C1/C2/C3 structural enforcement)
**Source:** `src/storage/storage.ts` lines 1–6 (header) + `settings.atoms.ts` lines 9–15 (import rule).
**Apply to:** ALL `src/domains/` files and `src/storage/storage.ts`.
- Domain code imports `* as storage from '../../storage/storage'` — NEVER `db`. The single controlled exception (the reactive source) is resolved by `storage.observeIncomeChecks()` so even atoms stay db-free (Pitfall 5).
- Add NO credential/money-move/floor-lowering method to storage.ts. The forbidden-method *absence* IS the constraint.

### React-19 re-suspense prophylaxis
**Source:** `SettingsPage.tsx` lines 16–18.
**Apply to:** every atom consumption site (Dashboard, Entry, forms).
```typescript
const persisted = useAtomValue(floorsLoadAtom, { delay: 0 })   // Pitfall 1 prophylaxis
```
Primary fix is `initialValue: []` on `atomWithObservable` (source atom); `{ delay: 0 }` is belt-and-suspenders at consumers.

### Tokens-only / font-mono / 44px tap targets
**Source:** `NumberInput.tsx` lines 27–36, `Toast.tsx` lines 22–44, `AppShell.tsx` line 11, CLAUDE.md Conventions.
**Apply to:** all new components.
- No inline hex — only `tailwind.config.ts` tokens (`surface`, `accent`, `destructive`, `text-*`, `sp-*`).
- All financial values `font-mono`; use `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})` (RESEARCH Don't-Hand-Roll).
- All interactive elements `min-h-[44px]`.

### Write-atom + toast feedback
**Source:** `settings.atoms.ts` lines 32–35 (write-only atom) + `SettingsPage.tsx` lines 35–39 (await save → toast).
**Apply to:** CheckEntryForm, PasteParseFlow commit. Note: with `atomWithObservable` the manual `refreshCounterAtom` bump (settings.atoms.ts lines 20, 34) is UNNECESSARY for income — `liveQuery` re-emits automatically on write. Do NOT replicate the refresh-counter for the reactive income chain.

### Pure migration ladder (one source of truth)
**Source:** `migrations.ts` lines 1–15 (contract) + `storage.ts` lines 119–131 (ladder walk).
**Apply to:** schema v1→v2. Same `migrate_1_to_2` pure fn used by both Dexie `.upgrade()` and `importAll`. v1 backups must remain importable (register `MIGRATIONS[1]`).

### Test scaffolding
**Source:** `storage.test.ts` lines 1–16 (`beforeEach` Dexie.delete + fresh DB) + `settings.atoms.test.ts` lines 1–14 (`createStore()` per test).
**Apply to:** all Phase-2 tests (RESEARCH Wave 0 gaps).
```typescript
beforeEach(async () => { await Dexie.delete('BudgetApp') })
// atom tests:
const store = createStore()
const value = await store.get(someAtom)
```
**Extend `storage.test.ts` lines 30–46** (the absence-proof block) with any new forbidden-method assertions to keep C2/C3 structurally proven.

---

## No Analog Found

| File | Role | Data Flow | Reason | Use Instead |
|------|------|-----------|--------|-------------|
| `parser/parseStatement.ts` | utility (pure fn) | transform | No statement parser exists in Phase-1 codebase | RESEARCH Pattern 3 (full impl) + D-02..D-05 + real fixture |
| `parser/checkingAdapter.ts` | utility (pure fn) | transform | No adapter pattern exists yet | RESEARCH Pattern 3 `StatementAdapter` seam (D-01) |
| `income.atoms.ts` source atom | atom (reactive) | event-driven | `atomWithObservable` was BANNED in Phase 1 — no prior usage | RESEARCH Pattern 1 (`atomWithObservable + liveQuery`, `initialValue:[]`); boundary from settings.atoms.ts |
| `classify.ts` | utility (pure fn) | compute | No classification logic in Phase 1 | RESEARCH (D-08 taxability, D-12 surplus); local-midnight date rule |

---

## Metadata

**Analog search scope:** `src/storage/`, `src/domains/settings/`, `src/pages/`, `src/components/`, `src/test/`
**Files scanned (read):** storage.ts, schema.ts, db.ts, migrations.ts, settings.atoms.ts, settings.types.ts, SettingsPage.tsx, BackupPage.tsx, NumberInput.tsx, Toast.tsx, AppShell.tsx, App.tsx, storage.test.ts, settings.atoms.test.ts (14 source files)
**Pattern extraction date:** 2026-05-28
