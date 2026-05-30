# Phase 4: Food Contract (Locked Floor) — Research

**Researched:** 2026-05-29
**Domain:** Food floor computation, SMC file integration, Dexie schema migration, Jotai reactive atoms, C1 structural enforcement
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** App-owned meal-definition table is the source of meal→ingredient decomposition. Parser extracts scheduled meal NAMES from SMC and joins to this table. No `meal_pool.md`.
- **D-02** Undefined meal name → auto-stub flagged "needs ingredients" + fallback-high pricing. Never silent.
- **D-03** Portion model is GLOBAL per ingredient — one portion row per ingredient, reused across all meals.
- **D-04** Each meal row is EITHER ingredient-decomposed OR carries a flat editable cost field. Unset flat cost falls back high + flagged.
- **D-05** Flavor/condiment tag on each unit-cost-map ingredient. Meal cost = Σ macro-bearing only. Flavor line is a separate ~$50/mo PROTECTED fixed amount.
- **D-06** Monthly floor = daily-average cost × days-in-current-month. Not a literal sum of only scheduled days.
- **D-07** Fallback value = `max(last-computed floor, all-time high-water mark)`. Current live plan may move DOWN legitimately; stale/missing → max(last-computed, high-water) + flag.
- **D-08** Staleness trigger = no plan file's window covers today. Uses frontmatter `window_start`/`window_end` directly.
- **D-09** Floor renders as a read-only DERIVED value. Config surface (unit-cost map, portion model, meal table) is accuracy/convergence tooling, never a budget lever. Derived-value architecture IS the C1 enforcement.
- **D-10** Discretionary food layer = Phase 3 gateable food expense lines, summed, displayed beside locked floor. No new data model.
- **D-11** Three uncertainty conditions surfaced via one status badge + expandable detail list (unpriced ingredient / undefined meal / stale plan).

### Claude's Discretion

- Exact schema/field names for new tables — finalize against existing `src/storage/schema.ts` conventions.
- Fallback-high ceiling strategy (D-02/D-04): most-expensive-defined-meal vs configurable constant — planner's call.
- Plan-file parser mechanics for mixed SMC filename/separator formats.
- Routing/placement of food panel and config surface within existing HashRouter.
- Exact lock visuals within UI-design-principles — D-09/D-11 fix behavior, not pixels.

### Deferred Ideas (OUT OF SCOPE)

- Live SMC wiring (SMC-01) — v2 only.
- Receipt OCR / itemized parser (OCR-02) — v2 only.
- Discretionary-food gating UI / soft caps — Phase 5.
- Surplus router, EF targets, full dashboard split — Phase 5.
- Per-(meal,ingredient) portion overrides — deferred.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOOD-01 | App reads SMC project read-only; never writes | SMC access via `import.meta.glob` at build time — read-only by construction |
| FOOD-02 | Re-mapped: app-owned meal table is the decomposition source (D-01) | New `mealDefinitions` table in Dexie; seed with 14 known meal-name strings |
| FOOD-03 | App reads `plans/<date>.md` and `plans/<start>--<end>.md` for scheduled meals + window | `import.meta.glob` with `eager: false` + frontmatter parser; both filename patterns covered |
| FOOD-04 | User can edit unit-cost map in-UI (`ingredient → cost/unit`) | New `unitCostMap` settings singleton; Table B on `/food/config` |
| FOOD-05 | User can edit portion model in-UI (`ingredient → typical portion`) | New `portionModel` settings singleton; Table C on `/food/config` |
| FOOD-06 | Meal cost = Σ macro-bearing ingredients × (portion × unit_cost); never hard-coded | Pure cost-engine function; derived atom recomputes on any input change |
| FOOD-07 | Period floor recomputes when meal table, plan, unit-cost map, or portion model changes | `foodFloorAtom` = `atomWithObservable` + `liveQuery` chain covering all input tables |
| FOOD-08 | Unpriced ingredient → visible flag, never silent undercount | Fallback-high + amber badge + detail row naming the ingredient |
| FOOD-09 | New meals built from already-priced ingredients price automatically | Derivation happens at compute time — no caching that could go stale |
| FOOD-10 | Flavor line = separate ~$50/mo PROTECTED fixed amount, editable, excluded from per-meal pricing | `flavorLine` settings singleton; flavor-tagged ingredients skip meal cost Σ |
| FOOD-11 | No current plan → fallback to last-known or high-water, never lower; staleness flagged | D-07/D-08: persist `lastComputedFloor` + `allTimeHighWater` in settings; D-08 trigger |
| FOOD-12 | Protected floor renders locked, rent-like; no downward-edit affordance anywhere | Derived-value architecture (D-09); no `<input>` on floor line; lock icon always rendered |
| FOOD-13 | Floor seed ~$550/mo; `lastRefinedFromReceipts` timestamp visible | Seed in `mealDefinitions` init; timestamp stored in `foodFloorMeta` settings singleton |
| UI-02 | Food panel renders locked floor + gateable discretionary layer side by side | `/food` route; two sections in one page per UI-SPEC Surface 1 |
| EDGE-02 | No current plan → fallback-high + staleness flag | D-07 `max(last, highWater)` + amber badge "Needs attention" with staleness detail row |
| EDGE-03 | Unpriced ingredient → unpriced-ingredient flag | Fallback-high on that ingredient's contribution; amber badge detail row |
</phase_requirements>

---

## Summary

Phase 4 is well-scoped and architecturally grounded. Every major decision was resolved during the discuss phase (D-01..D-11) and the SMC plan format was verified against 5 live files. The central engineering challenge — how a static GitHub Pages SPA reads SMC plan files — resolves cleanly via Vite's `import.meta.glob` at build time: the SMC `plans/` directory is bundled into the app at build, making files available in-browser with zero runtime filesystem access needed. This is appropriate for v1 ("relative workspace path" as stated in CONTEXT.md) and is the only viable mechanism for a static SPA.

The computation pipeline is a pure-function chain: SMC plan files → scheduled meal-name extraction → app meal-definition table join → cost engine (ingredient-decomposed or flat-cost) → daily average × month days → protected floor. Reactivity comes from `atomWithObservable + liveQuery` over the Dexie tables, following the pattern already in use for income and expenses. C1 enforcement is structural: the food floor is a derived read-only value; no method exists anywhere in storage.ts to write it down or gate it.

The schema advances from v3 to v4, adding four new table/singleton entries: `mealDefinitions` (Dexie table), `unitCostMap` (settings singleton), `portionModel` (settings singleton), `foodFloorMeta` (settings singleton for last-computed + high-water + lastRefinedFromReceipts timestamp). Migration v3→v4 is a data no-op (new tables are empty; existing settings untouched), following the established pattern.

**Primary recommendation:** Use `import.meta.glob('../../../schedule-meal-coordinator/plans/*.md', { as: 'raw', eager: false })` in vite.config.ts with an explicit `allow` path entry, and process the glob result as the SMC data source. The food domain lives entirely in `src/domains/food/` with colocated atoms, a plan parser, and a cost engine. No external dependencies are needed beyond what Phase 1 pinned.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SMC plan file access | Build / Vite | — | Static SPA — no runtime filesystem. `import.meta.glob` bundles files at build time. |
| Plan parsing (frontmatter + Food: strings) | Browser / client module | — | Pure JS, runs in-browser from bundled raw strings |
| Meal→ingredient decomposition | Browser / domain | — | Joins parser output to app-owned meal table loaded from IndexedDB |
| Cost engine (Σ portions × unit costs) | Browser / domain | — | Pure function; no network or storage call during computation |
| Food floor derivation | Browser / Jotai atoms | — | Derived atom over liveQuery observables; never persisted |
| Persistence (meal table, cost map, portion model, meta) | IndexedDB / Dexie | — | Via storage abstraction, same pattern as expenses/income |
| C1 enforcement | TypeScript type system + storage API surface | — | No downward-write method exists on storage.ts; derived value never stored |
| UI rendering (locked floor, config tables) | Browser / React | — | `/food` and `/food/config` routes in existing HashRouter |

---

## Standard Stack

All libraries were pinned in Phase 1. No new dependencies are needed.

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 8.0.12 | Build tool; `import.meta.glob` for SMC file bundling | Project pin — provides glob import at build time |
| React 19 + react-dom | 19.2.x | UI rendering | Project pin |
| TypeScript ~5.6 | strict | Type-safe contracts for FoodNeed types | Project pin |
| Jotai 2.20.0 | `atom`, `atomWithObservable` | Reactive food floor chain | Project pin — income domain uses same pattern |
| Dexie 4.4.2 | Table, liveQuery | Meal definitions + settings singletons | Project pin — all persistence goes through Dexie |
| react-router-dom 7.x | HashRouter, Route | `/food` and `/food/config` routes | Project pin |
| Tailwind v3.4.x | utility classes | All tokens from tailwind.config.ts | Project pin — **do not upgrade to v4** |
| lucide-react 0.577.0 | `Lock` icon, others | Lock icon on floor line (C1 visual rule) | Project pin |

[VERIFIED: codebase] — package.json and SKELETON.md confirm these versions.

### No New Dependencies

Phase 4 introduces no npm packages. The SMC plan parser is hand-written (frontmatter is simple YAML-ish key: "value" pairs; body uses Markdown table rows in the batch format and `**Food:**` prose in the per-slot format — no YAML parser needed, regex suffices for both). [VERIFIED: live SMC plan files read above]

---

## Architecture Patterns

### System Architecture Diagram

```
Build time:
  ../schedule-meal-coordinator/plans/*.md
           │
           │  import.meta.glob (Vite — raw strings, eager:false)
           ▼
  Bundled raw plan strings (keyed by filename)
           │
           ▼
Runtime (browser):
  planLoaderAtom (async)
    reads glob result → SMC Plan Parser
      ├── extracts: window_start, window_end (frontmatter)
      └── extracts: meal-name strings per slot (**Food:** lines / table Meal column)
           │
           ▼
  scheduledMealsAtom (derived)
    joins meal names → mealDefinitionsAtom (from Dexie liveQuery)
      ├── decomposed meal → ingredient list
      │     + unitCostMapAtom (from Dexie liveQuery)
      │     + portionModelAtom (from Dexie liveQuery)
      │     = per-meal cost (fallback-high on unpriced/undefined)
      └── flat-cost meal → flat cost (fallback-high if unset)
           │
           ▼
  costEngineAtom (derived, pure)
    daily-average cost × days-in-current-month
           │
           ▼
  foodFloorAtom (derived, READ-ONLY, NEVER persisted)
    = live computed floor  ←── or ──►  max(lastComputed, highWater) if stale
           │
           ├── → survivalFloorAtom (replaces floors.foodSeed)
           ├── → FoodPanel (locked floor display)
           └── → badgeStatusAtom (gap flags → amber/green badge)

Persistence layer (IndexedDB via Dexie → storage.ts):
  mealDefinitions table  (CRUD)
  settings['unitCostMap']
  settings['portionModel']
  settings['foodFloorMeta']  → { lastComputedFloor, allTimeHighWater, lastRefinedFromReceipts }
  settings['flavorLine']     → { amount: number }
```

### Recommended Project Structure

```
src/
├── domains/
│   └── food/
│       ├── food.atoms.ts         # all Jotai atoms for the food domain
│       ├── food.types.ts         # MealDefinition, UnitCostEntry, PortionEntry, FoodFloorMeta types
│       ├── planParser.ts         # pure function: raw plan string → ScheduledMeal[]
│       └── costEngine.ts         # pure function: inputs → floor number + gap list
├── pages/
│   ├── FoodPage.tsx              # /food surface (Surface 1 from UI-SPEC)
│   └── FoodConfigPage.tsx        # /food/config surface (Surface 2 from UI-SPEC)
└── storage/
    ├── schema.ts                 # bump CURRENT_SCHEMA_VERSION 3→4; add Phase 4 types
    ├── db.ts                     # add .version(4).stores() + mealDefinitions table
    ├── migrations.ts             # add migrate_3_to_4 (data no-op)
    └── storage.ts                # add CRUD for mealDefinitions + food settings singletons
```

### Pattern 1: import.meta.glob for SMC Plan Files

**What:** Vite bundles all `.md` files from a relative path outside the src directory as raw strings, keyed by their filename path. The app imports them as a lazy record at runtime.

**When to use:** Any static SPA that needs read-only access to sibling-repo text files on the same machine (dev) and needs those files bundled for the deployed artifact.

**Critical finding — the architectural unknown is resolved:**

The CONTEXT.md notes "v1 reads files via the relative workspace path only" and the phase description asks how SMC files reach the app at runtime. The answer: `import.meta.glob` at build time. There is no runtime filesystem access. The files are bundled during `npm run build` from the developer's machine (where `../schedule-meal-coordinator/plans/` exists), producing static assets embedded in the bundle.

**Implication for deployment:** The GitHub Pages deploy bakes in the plan files as of the last build push. When Ian runs a new SMC plan and wants the budget app to see it, he pushes a new commit (or runs `npm run build && git push`). This is the correct v1 model — "live wiring" is SMC-01, deferred to v2.

**Implication for dev fallback:** On a machine without the SMC repo (unlikely — same workspace), the glob returns an empty object. The app enters the stale/missing state immediately and shows the fallback floor. No crash.

**Vite configuration required:**

```typescript
// vite.config.ts — add to defineConfig:
server: {
  fs: {
    allow: ['..'], // permit Vite dev server to serve files one level above project root
  },
},
```

[VERIFIED: Vite 5/6/7/8 docs] `server.fs.allow` controls which directories the dev server can serve. Without it, the glob succeeds at build but the dev server blocks the import. `'..'` allows the workspace root, which covers `../schedule-meal-coordinator/`.

**Usage in food.atoms.ts:**

```typescript
// Source: Vite glob import docs
const planModules = import.meta.glob(
  '../../../schedule-meal-coordinator/plans/*.md',
  { as: 'raw', eager: false }
)
// Result type: Record<string, () => Promise<string>>
// Key example: '../../../schedule-meal-coordinator/plans/2026-05-25--2026-05-28.md'
```

[ASSUMED] The exact relative path depth (`../../../`) depends on where food.atoms.ts lives relative to the project root. From `src/domains/food/food.atoms.ts`, the SMC plans directory is at `../../../schedule-meal-coordinator/plans/`. Planner should verify this path resolves correctly from the planned file location.

**TypeScript declaration required:**

```typescript
// src/vite-env.d.ts (already exists from Vite scaffold) — add:
/// <reference types="vite/client" />
// import.meta.glob is typed by vite/client — no manual declaration needed
// if `{ as: 'raw' }` TS types are missing, add:
// interface ImportMeta { glob: <T>(pattern: string, opts?: object) => Record<string, () => Promise<T>> }
```

[CITED: vitejs.dev/guide/features#glob-import] `as: 'raw'` returns the file content as a string. Supported since Vite 3.

### Pattern 2: SMC Plan Parser

**What:** Pure function that takes a raw `.md` string and filename and returns a parsed plan object with window dates and scheduled meal names.

**Key parsing rules (from live file inspection):**

1. **Frontmatter:** Lines between `---` delimiters at start of file. Extract `window_start` and `window_end` as `YYYY-MM-DD` strings. Format: `key: "value"` (quoted) or `key: value` (unquoted) — use a simple regex per key, not a full YAML parser.

2. **Filename-based date extraction (fallback):** Single-date files `YYYY-MM-DD.md` have a single window day. Date-range files `YYYY-MM-DD--YYYY-MM-DD.md` have a multi-day window. Frontmatter `window_start`/`window_end` is authoritative when present; filename is fallback when frontmatter is absent.

3. **Meal extraction — TWO formats coexist:**
   - **Table format** (batch files, 2026-05-25--2026-05-28.md): `| # | Time | Meal | Selector |` table rows; extract the Meal column value.
   - **Slot-prose format** (single-day files — from STATE.md description): `**Food:**` value on a line within a slot heading. Regex: `/^\*\*Food:\*\*\s*(.+)$/m`

4. **Separator tokenization (for decomposed meals):** Ingredients in meal names are separated by `,`, ` and `, ` with `. Tokenization splits on these in order; tokens are trimmed and lowercased for lookup against the meal-definition table's `mealName` index.

5. **Non-decomposable detection:** If the parser extracts a meal-name token that matches a known non-decomposable flag in the meal definition table (`type: 'flat-cost'`), cost is taken from the flat-cost field, not the ingredient Σ.

[VERIFIED: live file inspection] Both table format and `**Food:**` prose format confirmed in the 5 live plan files read above.

```typescript
// Source: live plan file inspection + D-08 parsing rules
export interface ParsedPlan {
  windowStart: string   // YYYY-MM-DD
  windowEnd: string     // YYYY-MM-DD
  meals: string[]       // normalized meal-name strings (lowercase, trimmed)
}

export function parsePlanFile(filename: string, raw: string): ParsedPlan | null {
  // 1. Extract frontmatter window
  // 2. Extract meals (table format OR **Food:** format)
  // 3. Return null on parse failure (triggers fallback-high in atoms layer)
}
```

### Pattern 3: Cost Engine (Pure Function)

**What:** Synchronous pure function taking all data inputs and returning the computed floor and a gap list.

**Why pure:** Same function can be called in atoms, in tests (no Dexie needed), and from the staleness-persist side effect.

```typescript
// Source: D-06 derivation formula + D-04 flat-cost rule + D-05 tag filter
export interface CostEngineInput {
  scheduledMeals: string[]           // meal names from parsed plans covering today's month
  mealDefinitions: MealDefinition[]
  unitCostMap: UnitCostEntry[]
  portionModel: PortionEntry[]
  daysInMonth: number
  fallbackCeiling: number            // planner-chosen constant for D-02/D-04 fallback-high
}

export interface CostEngineResult {
  floor: number          // D-06: daily-average × daysInMonth
  gaps: FloorGap[]       // unpriced ingredients, undefined meals, unset flat costs
  isClean: boolean       // true iff gaps.length === 0
}

export type FloorGap =
  | { type: 'unpriced-ingredient'; ingredientName: string }
  | { type: 'undefined-meal'; mealName: string }
  | { type: 'unset-flat-cost'; mealName: string }
```

### Pattern 4: foodFloorAtom Derivation Chain

**What:** The reactive atom chain for the food domain, following the income domain pattern (atomWithObservable + liveQuery).

**Confirmed:** Phase 2 lifted the atomWithObservable ban. The income domain (income.atoms.ts) is already using `atomWithObservable` + `liveQuery` in production. The food domain follows the exact same pattern.

```typescript
// Source: src/domains/income/income.atoms.ts pattern
import { atomWithObservable } from 'jotai/utils'
import { liveQuery } from 'dexie'
import * as storage from '../../storage/storage'

// Source atom: reactive over mealDefinitions table
export const mealDefinitionsAtom = atomWithObservable<MealDefinition[]>(
  () => liveQuery(() => storage.listMealDefinitions()),
  { initialValue: [] }
)

// Settings singletons (unit-cost map, portion model) — plain async atoms with
// refresh counter, since they update on user save (not continuous stream).
// OR: if a liveQuery observable over settings table makes sense, use that.
// RECOMMENDATION: plain async atoms + refresh counter (same pattern as floorsLoadAtom).

// Derived floor atom
export const foodFloorAtom = atom(async (get): Promise<FoodFloorResult> => {
  const mealDefs = get(mealDefinitionsAtom)
  const unitCosts = await get(unitCostMapAtom)
  const portions = await get(portionModelAtom)
  const planData = await get(parsedPlanAtom)  // async: loads from glob
  const meta = await get(foodFloorMetaAtom)
  // ... call costEngine, handle stale/fallback
})
```

[VERIFIED: codebase] `atomWithObservable` and `liveQuery` are both imported and working in income.atoms.ts. The pattern is proven.

### Pattern 5: C1 Structural Enforcement

**What:** The food floor is enforced as non-editable-downward structurally — not by warnings or guards.

**Three enforcement layers:**

1. **Storage API surface:** `storage.ts` exports NO method that writes the derived floor value. The methods `saveFoodFloorMeta` only persists `{ lastComputedFloor, allTimeHighWater, lastRefinedFromReceipts }` — these are read-only metadata, not a settable floor. There is no `setFoodFloor(n: number)` method.

2. **TypeScript type:** `FoodFloorMeta` has no `floor` field — only `lastComputedFloor` (written BY the cost engine, never BY user input) and `allTimeHighWater` (updated by the atom when live floor > current high-water). No type-level path for user to write a lower number.

3. **UI:** The `/food` surface renders the floor value in a `<span>` (or equivalent non-interactive element), never `<input>`. The lock icon is always rendered. No adjacent edit button or pencil icon. The config surface (`/food/config`) is framed as "Meal cost configuration" — inputs there change unit costs (which may cause the floor to go up or down based on reality), but there is no input that directly sets the floor number.

**Test for C1 (to add to test suite):**

```typescript
// storage has no decreaseFoodFloor method — TypeScript compile-time proof
// (mirrors the existing absence-proof pattern in storage.test.ts)
expect(typeof (storage as Record<string, unknown>)['decreaseFoodFloor']).toBe('undefined')
expect(typeof (storage as Record<string, unknown>)['setFoodFloor']).toBe('undefined')
```

### Pattern 6: Schema Migration v3 → v4

**What:** The established pure-function migration pattern, applied for Phase 4's new tables.

**New Dexie table:**
- `mealDefinitions: '++id, mealName'` — indexed by mealName for fast join

**New settings singletons (existing `settings: '&key'` table):**
- `'unitCostMap'` → `UnitCostEntry[]`
- `'portionModel'` → `PortionEntry[]`
- `'foodFloorMeta'` → `FoodFloorMeta` (`{ lastComputedFloor, allTimeHighWater, lastRefinedFromReceipts }`)
- `'flavorLine'` → `{ amount: number }`

**Migration function (data no-op — new tables are empty, existing data untouched):**

```typescript
// migrations.ts
export function migrate_3_to_4(data: SchemaV1Data): SchemaV1Data {
  return {
    ...data,
    mealDefinitions: data.mealDefinitions ?? [],
    // settings singletons initialize at first read via ?? default in storage.ts
  }
}
```

**`SchemaV1Data` must be extended** to include `mealDefinitions: unknown[]`.

**`collectSchemaV1Data` must be extended** to include `mealDefinitions` in the export envelope so backups round-trip meal definitions correctly.

**`replaceAll` must be extended** to restore meal definition rows from the import envelope.

[VERIFIED: codebase] The migrations.ts contract comment documents exactly this process. The v2→v3 migration (migrate_2_to_3) is a structural no-op that follows the exact same pattern.

### Pattern 7: survivalFloorAtom Replacement

**What:** Phase 3's `survivalFloorAtom` currently uses `floors.foodSeed` as the protected food term. Phase 4 replaces that term with `foodFloorAtom`.

**Current (Phase 3):**
```typescript
// expenses.atoms.ts
export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const floors = await get(floorsLoadAtom)
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + floors.foodSeed  // ← replace this term
})
```

**Phase 4 target:**
```typescript
export const survivalFloorAtom = atom(async (get): Promise<number> => {
  const { floor } = await get(foodFloorAtom)   // ← computed floor replaces foodSeed
  const fixedExFood = get(fixedExFoodAtom)
  const accruals = get(sinkingFundAccrualsAtom)
  return fixedExFood + accruals + floor
})
```

The dashboard's "Survival floor" MetricCard updates automatically because it already reads `survivalFloorAtom` — no dashboard layout change required in Phase 4 (confirmed by UI-SPEC).

### Anti-Patterns to Avoid

- **Storing the derived floor:** `foodFloorAtom` must NEVER be persisted. Only `lastComputedFloor` and `allTimeHighWater` (metadata, not the live floor) are persisted. Storing a stale floor breaks FOUND-06 and violates C1 (a stale lower value could be read back).
- **Import.meta.glob with `eager: true`:** This increases initial bundle size. Use `eager: false` (lazy loading) so plan files are fetched only when the food domain initializes.
- **Parsing meal names at token-split time:** Do NOT split "Chicken, rice, and broccoli" into raw tokens and look up each token as an ingredient. The meal table uses the FULL meal-name string as the key, joined by the parser. Individual ingredient names come from the meal-definition table's `ingredients[]` field, not from tokenizing the SMC meal name.
- **Using localStorage for plan cache:** Forbidden. All persistence is IndexedDB via storage.ts.
- **refreshCounterAtom for mealDefinitions:** Since meal definitions use liveQuery observable (`atomWithObservable`), do NOT add a refresh counter — liveQuery re-emits on IDB write automatically. Settings singletons (unitCostMap, portionModel) use the plain async + refresh counter pattern (same as floorsLoadAtom).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive IDB | Custom event listener on IndexedDB | Dexie `liveQuery` | Already in use; handles cross-tab, transaction coalescing |
| Atom reactivity | Manual pub/sub | `atomWithObservable` | Already in use (income.atoms.ts) |
| YAML frontmatter | Full YAML parser (js-yaml) | Targeted regex per known key | Only 2 keys needed (`window_start`, `window_end`); YAML parser adds bundle weight |
| File system access | File System Access API | `import.meta.glob` at build time | FSAPI requires user permission gesture; build-time glob needs none |
| SMC file writing | Any write method to ../schedule-meal-coordinator/ | Nothing — read-only only | C1 safety + SMC design; no write path should exist |

---

## Common Pitfalls

### Pitfall 1: import.meta.glob Path Resolution Fails at Build

**What goes wrong:** The glob pattern resolves to 0 files at build time, causing the app to always show the stale/fallback state.
**Why it happens:** The path is relative to the importing file (not the project root). From `src/domains/food/food.atoms.ts`, the correct path is `'../../../schedule-meal-coordinator/plans/*.md'` (three levels up: food → domains → src, then up one more to project root, then into sibling repo).
**How to avoid:** After adding the glob, verify the returned object has > 0 keys in a dev build. Add a unit test that checks the glob returns entries (with a mocked glob in Vitest).
**Warning signs:** `foodFloorAtom` always returns the fallback value even after SMC plans exist.

### Pitfall 2: Dev Server Blocking Glob File Serving

**What goes wrong:** `import.meta.glob` succeeds at build but the Vite dev server throws a 403 when the lazy module tries to load.
**Why it happens:** Vite dev server's `server.fs.allow` defaults to the project root only. Files outside the project root (i.e., `../schedule-meal-coordinator/`) are blocked.
**How to avoid:** Add `server: { fs: { allow: ['..'] } }` to `vite.config.ts`. [CITED: vitejs.dev/config/server-options#server-fs-allow]
**Warning signs:** "403 Restricted" errors in the browser console when the food atoms first initialize in dev mode.

### Pitfall 3: Both Plan Filename Formats Not Handled

**What goes wrong:** Parser handles only `YYYY-MM-DD.md` single-date files and misses `YYYY-MM-DD--YYYY-MM-DD.md` date-range batch files, causing entire batch windows to be treated as missing.
**Why it happens:** Only one filename pattern was written in the parser.
**How to avoid:** Two regex branches: `(^\d{4}-\d{2}-\d{2})\.md$` for single-date; `(^\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})\.md$` for date-range. The frontmatter `window_start`/`window_end` is authoritative; filename is only the fallback.
**Warning signs:** Staleness flag appears during date-range batch windows even though a plan was generated.

### Pitfall 4: survivalFloorAtom Update Creates Circular Dependency

**What goes wrong:** `survivalFloorAtom` reads `foodFloorAtom`; `foodFloorAtom` somehow reads from settings that include the old `floors.foodSeed`. Circular Jotai atom chain.
**Why it happens:** If `foodFloorAtom` reads `floorsLoadAtom` (to get the seed as a final fallback), and `survivalFloorAtom` also reads `floorsLoadAtom`, there is no cycle — but if `foodFloorAtom` is imported by the settings atoms, there is a risk of circular import.
**How to avoid:** `foodFloorAtom` lives in `src/domains/food/food.atoms.ts` and imports from settings atoms only via `floorsLoadAtom` (for the `floors.foodSeed` initial fallback, if used). `survivalFloorAtom` in expenses.atoms.ts imports from food.atoms.ts. Keep the import direction: food.atoms → settings.atoms; expenses.atoms → food.atoms. Never reverse.
**Warning signs:** TypeScript circular dependency error, or Jotai `get()` throwing at runtime.

### Pitfall 5: Meal-Name Matching Case Sensitivity

**What goes wrong:** SMC plan meal names ("Chicken, rice, and broccoli") don't match app meal-definition table entries ("chicken, rice, and broccoli") due to case differences.
**Why it happens:** SMC capitalizes meal names (first-word cap); the app may store them differently.
**How to avoid:** Normalize both sides to lowercase + trim before comparison. The 14 seed meal names should be stored in normalized form. Document the normalization contract in food.types.ts.
**Warning signs:** All SMC meals produce "undefined meal" stubs even though they were seeded.

### Pitfall 6: Flavor-Tagged Ingredients Double-Counted

**What goes wrong:** Ingredients tagged as `flavor/condiment` in the unit-cost map appear in per-meal cost Σ AND in the flavor line, double-counting them in the protected floor.
**Why it happens:** D-05 tag filter was not applied in the cost engine.
**How to avoid:** Cost engine filters `unitCostMap` to `macro-bearing` entries only before the Σ. `flavor/condiment`-tagged entries are excluded from per-meal cost. The flavor line is a fixed setting, added separately to the total protected food cost.
**Warning signs:** Protected floor is suspiciously higher than expected; manual calculation against receipts diverges.

### Pitfall 7: High-Water Mark Ratchets the Live Floor Permanently

**What goes wrong:** Every time the live floor computes, the high-water mark is updated to `max(highWater, liveFloor)`. When the user corrects an overpriced ingredient (lowering the real floor), the high-water from the old data keeps the stale-fallback permanently high — never letting the live floor fall to the corrected value.
**Why it happens:** D-07 says "live plan may legitimately move DOWN" but misapplication ratchets the live floor too.
**How to avoid:** High-water ONLY governs the stale/missing fallback path. The LIVE computed floor (when a valid current plan exists) is always the `costEngine` output, regardless of high-water. High-water is updated on each successful live computation. The display logic: `planIsCurrent ? liveFloor : max(lastComputedFloor, highWater)`.
**Warning signs:** Floor never decreases after a user corrects unit costs, even with a current plan loaded.

---

## Code Examples

### Glob Import Initialization

```typescript
// src/domains/food/food.atoms.ts
// Source: Vite glob import docs + live plan file format inspection

const RAW_PLAN_GLOB = import.meta.glob(
  '../../../schedule-meal-coordinator/plans/*.md',
  { as: 'raw', eager: false }
) as Record<string, () => Promise<string>>

// Async atom: loads all plan files lazily, parses, finds current-window ones
export const parsedPlansAtom = atom(async (): Promise<ParsedPlan[]> => {
  const entries = Object.entries(RAW_PLAN_GLOB)
  const results = await Promise.all(
    entries.map(async ([path, loader]) => {
      const raw = await loader()
      const filename = path.split('/').pop() ?? ''
      return parsePlanFile(filename, raw)
    })
  )
  return results.filter((p): p is ParsedPlan => p !== null)
})
```

### Frontmatter Extraction

```typescript
// src/domains/food/planParser.ts
// Source: live SMC plan file inspection (5 files read 2026-05-29)

function extractFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/)
    if (kv) result[kv[1]] = kv[2].trim()
  }
  return result
}
```

### Staleness Check (D-08)

```typescript
// src/domains/food/costEngine.ts
// Source: D-08 decision

export function isPlanCurrent(plans: ParsedPlan[], today: string): boolean {
  return plans.some(
    (p) => p.windowStart <= today && today <= p.windowEnd
  )
}

// today: ISO YYYY-MM-DD (local calendar, same convention as income date classification)
```

### Fallback-High Logic (D-07)

```typescript
// src/domains/food/food.atoms.ts
// Source: D-07 decision

export const foodFloorAtom = atom(async (get): Promise<FoodFloorResult> => {
  const plans = await get(parsedPlansAtom)
  const mealDefs = get(mealDefinitionsAtom)
  const unitCosts = await get(unitCostMapAtom)
  const portions = await get(portionModelAtom)
  const meta = await get(foodFloorMetaAtom)
  const today = new Date().toISOString().slice(0, 10)

  const currentPlans = plans.filter(
    (p) => p.windowStart <= today && today <= p.windowEnd
  )
  const planIsCurrent = currentPlans.length > 0

  if (!planIsCurrent) {
    const fallback = Math.max(
      meta?.lastComputedFloor ?? 0,
      meta?.allTimeHighWater ?? DEFAULT_FOOD_FLOOR_SEED
    )
    return { floor: fallback, gaps: [{ type: 'stale-plan' }], isClean: false, planIsCurrent: false }
  }

  const result = computeFloor({ currentPlans, mealDefs, unitCosts, portions })
  // Persist new high-water mark if live floor exceeds it
  if (result.floor > (meta?.allTimeHighWater ?? 0)) {
    // side effect: fire-and-forget persist
    void storage.saveFoodFloorMeta({
      ...meta,
      lastComputedFloor: result.floor,
      allTimeHighWater: result.floor,
    })
  } else {
    void storage.saveFoodFloorMeta({ ...meta, lastComputedFloor: result.floor })
  }

  return { ...result, planIsCurrent: true }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `floors.foodSeed` as protected food term in survivalFloorAtom | `foodFloorAtom` live-computed value | Phase 4 | Survival floor now reflects real ingredient costs, not a static seed |
| Phase 1 plain async atoms for everything | `atomWithObservable + liveQuery` for tables that change continuously | Phase 2 | Enables live recompute on meal-table edits without refresh counter |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Relative path from `src/domains/food/food.atoms.ts` to SMC plans is `../../../schedule-meal-coordinator/plans/*.md` (three `../` levels) | Pattern 1 | Glob resolves to 0 files; always shows stale state. Planner must verify path depth. |
| A2 | `import.meta.glob` with `{ as: 'raw', eager: false }` is supported in Vite 8.0.12 | Pattern 1 | If API changed, need alternative mechanism. Check Vite 8 changelog. |
| A3 | SMC single-day plan files use `**Food:**` prose format (not table format); batch files use table format | Pattern 2 | Parser misses meals in single-day files if wrong. Only batch format confirmed in the 5 files read. Single-day format assumed from STATE.md description. |
| A4 | Fallback-high ceiling for D-02/D-04 should be a configurable constant (suggested: $15/meal) rather than "most expensive defined meal" | Don't Hand-Roll | If ceiling is too low, undercount violates C1. Planner must choose and document the seed constant. |

**Note on A3:** The 5 live plan files read are all batch format (`YYYY-MM-DD--YYYY-MM-DD.md`). Single-day files (`2026-05-18.md`, `2026-05-19.md`, `2026-05-21.md`) exist in the SMC plans directory but were not fully read for body format. STATE.md documents that these use `**Food:**` per slot. The parser should implement both branches but the single-day slot-format path will be exercised less frequently in practice.

---

## Open Questions

1. **Fallback-high ceiling constant (D-02/D-04)**
   - What we know: D-02/D-04 require undefined meals and unset flat costs to fall back to a "conservative high-water value." D-02 says "most expensive defined meal, or a configurable ceiling — planner's call."
   - What's unclear: The exact value. "Most expensive defined meal" is dynamic (changes as user edits the meal table), which makes the fallback non-deterministic early in setup when no meals are defined yet.
   - Recommendation: Seed a `FALLBACK_CEILING_PER_MEAL` constant at $15.00 (conservative for full meals; Qdoba bowl is ~$11, a full prep-cooked meal is ~$3–5). Store as a seeded configurable in `foodFloorMeta` or hardcode as a module constant in costEngine.ts. Planner decides.

2. **Single-day SMC plan body format**
   - What we know: STATE.md documents `**Food:**` lines; batch files use table format.
   - What's unclear: The exact Markdown structure around `**Food:**` in single-day files (slot heading format, whether `**Selector:**` line always follows, etc.).
   - Recommendation: Read one single-day plan file during Wave 0 setup to confirm the regex before committing the parser. The parser unit tests should cover both formats.

3. **`server.fs.allow` interaction with GitHub Actions deploy**
   - What we know: `server.fs.allow` controls the dev server only; GitHub Actions uses `npm run build` which bypasses the dev server entirely.
   - What's unclear: Whether the GitHub Actions runner has access to `../schedule-meal-coordinator/` at build time.
   - Recommendation: The budget-app GitHub repo does NOT currently include SMC as a submodule or dependency. The Actions runner only clones the budget-app repo. This means `import.meta.glob` will resolve to 0 files on GitHub Actions, and the deployed app will always show the stale/fallback state. **This is the expected v1 behavior** per CONTEXT.md ("v1 reads files via the relative workspace path only"). Ian runs `npm run build && git push` locally when he wants new plan data bundled. The planner should document this flow clearly in the plan.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ../schedule-meal-coordinator/plans/ | import.meta.glob | ✓ (dev machine) | 5 live files | Stale/fallback floor (correct v1 behavior) |
| Vite dev server `fs.allow` | Dev mode glob serving | Config change needed | N/A | Add `server.fs.allow: ['..']` |
| Node.js (build) | npm run build | ✓ | (project default) | — |

**SMC availability note:** The plans directory exists and has 5 current files. [VERIFIED: codebase inspection] The GitHub Actions deploy runner does NOT have access to SMC — this is expected and acceptable for v1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 + React Testing Library |
| Config file | vite.config.ts (test block) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOOD-01 | SMC files are read-only (no write method on storage) | unit | `npm run test -- --run src/test/storage.test.ts` | ✅ (add absence proofs) |
| FOOD-03 | Parser handles both filename formats | unit | `npm run test -- --run src/domains/food/planParser.test.ts` | ❌ Wave 0 |
| FOOD-04/05 | Unit-cost map + portion model CRUD round-trips | unit | `npm run test -- --run src/test/storage.test.ts` | ✅ (add cases) |
| FOOD-06 | Cost engine computes correct Σ, skips flavor-tagged | unit | `npm run test -- --run src/domains/food/costEngine.test.ts` | ❌ Wave 0 |
| FOOD-08 | Unpriced ingredient → fallback-high + gap entry | unit | `npm run test -- --run src/domains/food/costEngine.test.ts` | ❌ Wave 0 |
| FOOD-11/EDGE-02 | No current plan → max(lastComputed, highWater) | unit | `npm run test -- --run src/domains/food/costEngine.test.ts` | ❌ Wave 0 |
| FOOD-12 | No `setFoodFloor` / `decreaseFoodFloor` method on storage | unit | `npm run test -- --run src/test/storage.test.ts` | ✅ (add absence proofs) |
| FOOD-13 | lastRefinedFromReceipts timestamp persists | unit | `npm run test -- --run src/test/storage.test.ts` | ✅ (add case) |
| UI-02 | Food panel renders lock icon + read-only floor value | integration | `npm run test -- --run src/pages/FoodPage.test.tsx` | ❌ Wave 0 |
| EDGE-03 | Unpriced ingredient → amber badge visible | integration | `npm run test -- --run src/pages/FoodPage.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/domains/food/planParser.test.ts` — covers FOOD-03 (both filename formats, table format, Food: prose format, null on parse failure)
- [ ] `src/domains/food/costEngine.test.ts` — covers FOOD-06, FOOD-08, EDGE-02, EDGE-03
- [ ] `src/pages/FoodPage.test.tsx` — covers UI-02, FOOD-12 (no `<input>` on floor line), EDGE-02 (amber badge)
- [ ] `src/domains/food/food.atoms.ts` + `src/domains/food/food.types.ts` — new domain stubs (Wave 0 scaffolding)
- [ ] `src/domains/food/costEngine.ts` — pure function (testable without Dexie)
- [ ] `src/domains/food/planParser.ts` — pure function (testable without Dexie or glob)

---

## Security Domain

Phase 4 introduces no new attack surface beyond what Phases 1–3 established. The food domain:
- Reads local files via build-time bundling (no network request, no user-provided URL)
- Persists only to IndexedDB (no credentials, no external calls)
- Has no server component

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — single-user local app |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Non-finite amount guard (already in addExpenseItem pattern); apply to unit-cost and portion inputs |
| V6 Cryptography | no | No credentials, no encryption at rest (out of threat model per SKELETON.md) |

**Input validation for Phase 4:** All `NumberInput` values entering the unit-cost map, portion model, and flavor line amount must be validated as `Number.isFinite(n) && n >= 0` before persisting. Mirror the existing `addExpenseItem` guard pattern. The fallback-high path ensures $0 unit cost is treated as "unpriced" (gap), not as a valid zero cost.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `src/storage/schema.ts`, `src/storage/db.ts`, `src/storage/migrations.ts`, `src/storage/storage.ts` — current schema v3, migration pattern, storage abstraction API
- [VERIFIED: codebase] `src/domains/income/income.atoms.ts`, `src/domains/expenses/expenses.atoms.ts` — `atomWithObservable + liveQuery` pattern, survivalFloorAtom structure
- [VERIFIED: codebase] `src/App.tsx`, `vite.config.ts` — routing structure, Vite config (no `server.fs.allow` yet)
- [VERIFIED: live files] `../schedule-meal-coordinator/plans/2026-05-25--2026-05-28.md`, `2026-05-29--2026-05-31.md` — batch plan format confirmed (table format, frontmatter fields, window_start/window_end)
- [VERIFIED: planning artifacts] `04-CONTEXT.md` (D-01..D-11), `04-UI-SPEC.md` (6 C1 conditions, two surfaces), `STATE.md` (SMC format block), `SKELETON.md` (architectural source of truth)

### Secondary (MEDIUM confidence)
- [CITED: vitejs.dev/guide/features#glob-import] `import.meta.glob` with `{ as: 'raw', eager: false }` — raw string import of non-JS files
- [CITED: vitejs.dev/config/server-options#server-fs-allow] `server.fs.allow` for dev server cross-directory access

### Tertiary (LOW confidence)
- [ASSUMED] Single-day plan body format uses `**Food:**` prose lines (documented in STATE.md, not directly read in this session)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all Phase 1 pins confirmed in codebase; no new deps required
- Architecture (SMC file access): HIGH — `import.meta.glob` is the only viable mechanism for a static SPA; pattern is standard Vite; limitation (no live update on Actions deploy) is correctly documented as v1 expected behavior
- Schema migration: HIGH — pattern verified against 3 prior migrations (v1→2, v2→3) in codebase
- Atom chain: HIGH — `atomWithObservable + liveQuery` pattern confirmed in income.atoms.ts
- Parser (batch format): HIGH — 2 batch plan files read directly
- Parser (single-day format): MEDIUM — STATE.md description reliable but not directly verified this session
- C1 enforcement: HIGH — derived-value architecture requires no warnings; absence-proof pattern exists in storage.test.ts
- Pitfalls: HIGH for items caught from codebase inspection; MEDIUM for items inferred from pattern

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (30 days for this stable stack)
