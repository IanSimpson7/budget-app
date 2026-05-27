# Phase 1: Foundation, Storage, Deploy - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

**What this phase delivers:** A deployed Vite + React + TypeScript app on GitHub Pages, with IndexedDB persistence behind a storage abstraction, JSON export/import for backup, and a minimal Settings surface for the three editable floor parameters (passive, defended, food-floor seed). Phase 1 is "done" when Ian can open the deployed URL on his phone, change a floor value, refresh, and see it persist — and when he can export/import JSON to move state between devices.

**In scope (REQ-IDs):** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, UI-05, DEP-01, DEP-02, DEP-03

**Out of scope (explicit, not just "later"):**
- Dashboard, Food panel, Entry surface, Funds surface — Phases 2-5
- Income / expense / sinking-fund data entry — Phase 2+
- Food floor computation from SMC files — Phase 4
- Surplus router logic — Phase 5
- Any UI for the locked food floor display — Phase 4 (Phase 1 just stores the seed)

</domain>

<decisions>
## Implementation Decisions

### State Management Architecture (LEVERAGE-PAUSE-1 — RESOLVED)

- **D-01:** Use **Jotai** for state management. Atomic state model with derived atoms maps directly to spec FOUND-06 ("derived values recompute, never store stale copies"). Survival floor, EF targets, surplus, and food floor are all chains of computation — Jotai's derived atoms make the recompute-on-input-change rule the library's default behavior rather than discipline-enforced.
- **D-02:** Colocate atoms with domain logic. Each domain area (income, expenses, food, surplus, settings) owns its own `*.atoms.ts` file. No central `store.ts`. Cross-domain derived atoms (e.g., `survivalFloorAtom`) live in the domain whose output they are.
- **D-03:** TypeScript-first. Every atom is typed; entity contracts (`Floors`, `IncomeCheck`, `ExpenseItem`, `FoodFloor`, `SurplusPlan`) defined as exported types and referenced from atoms.

### IndexedDB Wrapper

- **D-04:** Use **Dexie.js** as the IndexedDB wrapper. Chosen over `idb` (Jake Archibald) and `idb-keyval` because (a) the spec has a real 10-entity schema worth declaring up front, (b) date-range queries on income checks and expense items benefit from Dexie's indexing, (c) Dexie's built-in migration ladder is the answer to schema versioning (see D-08). ~22 KB gzipped bundle cost is acceptable for a personal app.
- **D-05:** Storage abstraction (FOUND-02) sits *above* Dexie. Domain code talks to a `storage/` module with methods like `getFloors()`, `saveFloors(...)`, `listIncomeChecks(range)`. Dexie is the implementation, not the surface. If we ever swap implementations (e.g., move to a backend), domain code doesn't change.

### Data Model Organization

- **D-06:** Four collection tables + one settings key-value table:
  ```
  incomeChecks: '++id, date, source'
  expenseItems: '++id, name, category, protected, cadence'
  sinkingFunds: '++id, name, payoutDate'
  accounts:     '++id, type'
  settings:     '&key'  // singleton entities keyed by string:
                        //   'floors', 'emergencyFund', 'foodFloor',
                        //   'flavorLine', 'unitCostMap', 'portionModel'
  ```
- **D-07:** Singletons (`floors`, `emergencyFund`, `foodFloor`, `flavorLine`, `unitCostMap`, `portionModel`) live as keyed rows in the `settings` table. Avoids mixing libraries (one Dexie, no idb-keyval) and keeps the singleton-vs-collection distinction visible in queries.

### Schema Versioning + JSON Export/Import

- **D-08:** Every JSON export carries a `schemaVersion` (Phase 1 ships `schemaVersion: 1`). Export envelope:
  ```json
  {
    "schemaVersion": 1,
    "exportedAt": "<ISO timestamp>",
    "appVersion": "<package.json version>",
    "data": { ... }
  }
  ```
- **D-09:** Migration ladder lives in `storage/migrations.ts` as pure functions `migrate_N_to_N+1(data) → data`. **Same migration functions are used by both** Dexie's `db.version(N).upgrade(...)` callback AND the JSON-import path. One source of truth, both directions.
- **D-10:** On import, if file's `schemaVersion < currentVersion` → run migration ladder, then load. If `schemaVersion > currentVersion` → refuse import with explicit error message ("This backup was created by a newer version of the app. Update the app to import it."). Never silently drop or coerce fields.
- **D-11:** Import is **replace, not merge** for v1. Importing overwrites the current Dexie state entirely after migration. Merging is harder than it looks and not needed for the single-user-multi-device sync model.

### Phase 1 Visible UI Scope

- **D-12:** Minimal Settings surface with three editable number inputs:
  - Passive floor (default `2400`, label "Passive income floor — solvency baseline")
  - Defended line (default `3000`, label "Defended line — backfill trigger")
  - Food floor seed (default `550`, label "Food floor seed — refines from receipts later")
- **D-13:** Backup surface with two actions:
  - "Export backup" → triggers download of `budget-app-backup-YYYY-MM-DD.json`
  - "Import backup" → file picker, schema check, migration, replace state, confirmation toast
- **D-14:** No dashboard, no other surfaces in Phase 1. Settings + Backup are sufficient to satisfy FOUND-01..06, UI-05, DEP-01..03.

### Claude's Discretion (decided independently per spec calibration)

- **D-15:** Routing — use `react-router-dom` from day one with `HashRouter` (not `BrowserRouter`). GitHub Pages doesn't serve a custom 404 → index redirect for SPAs at subpaths; HashRouter avoids the issue entirely. Routes scaffolded: `/settings`, `/backup`. Future phases add `/dashboard`, `/food`, `/entry`, `/funds` without re-architecting.
- **D-16:** Testing — Vitest + React Testing Library scaffolded in Phase 1. A financial app's derived values (survival floor, EF targets, surplus, food floor pricing) are exactly the kind of pure logic that benefits from unit tests. Phase 1 includes a smoke test for the storage abstraction and one Jotai derived-atom test as the pattern for later phases to copy.
- **D-17:** TypeScript strict mode — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Financial app; cheap defects are unforgivable.
- **D-18:** Vite `base` config — derived from repo name at build time so the GitHub Pages subpath (`/budget-app/`) is correct without hardcoding. Defaults assume repo named `budget-app`; reconfirm at plan-phase time.
- **D-19:** Repo creation + GitHub Actions Pages workflow — created during Phase 1 execution, not before. Phase 1 plan will surface the GitHub username and repo name as input parameters (provisional default: `simpsonian354/budget-app`) before deploy work begins.
- **D-20:** Bundle / build target — modern evergreen browsers only (last 2 major versions of Chrome/Safari/Firefox, mobile Safari). No legacy polyfills, no IE shims.
- **D-21:** Styling — TBD, defer to plan-phase. Likely Tailwind given the responsive-layout requirement and Ian's prior React patterns, but Phase 1 has minimal UI so a CSS-modules baseline would also work. Plan-phase to make the call with cost framing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs (load-bearing — read in full)
- `../../../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` — Full v1 spec. §0 inviolable constraints, §7 persistence, §8 data model, §calibration leverage-pause directive.
- `../../../../roles/FinancialAdviser/specs/budget_app_build_CLAUDE.md` — Build session boot doc. Three inviolable constraints, build order, tech posture.

### Project-level planning artifacts
- `.planning/PROJECT.md` — Core value, inviolable constraints, key decisions log.
- `.planning/REQUIREMENTS.md` — 58 v1 REQ-IDs; Phase 1 covers FOUND-01..06, UI-05, DEP-01..03.
- `.planning/ROADMAP.md` — Phase 1 goal + success criteria.
- `.planning/STATE.md` — Open loops (LEVERAGE-PAUSE-1 resolved here; PLAN-FORMAT-CONFIRM still open for Phase 4).

### External library docs (researcher should validate at plan time)
- Jotai — https://jotai.org/docs — atoms, derived atoms, persistence patterns.
- Dexie.js — https://dexie.org/docs/ — schema declaration, versioning, migrations.
- Vite GitHub Pages — https://vitejs.dev/guide/static-deploy.html#github-pages — `base` config and Actions workflow template.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — Phase 1 is greenfield. No prior React code in this repo to inherit from.

### Established Patterns
- None inside this repo. Sibling project conventions (bed-planner, schedule-meal-coordinator) are markdown/skill-based, not React, so they don't transfer.

### Integration Points
- **SMC file paths** — Read-only access from Phase 4 onward at `../../schedule-meal-coordinator/meal_pool.md` and `../../schedule-meal-coordinator/plans/*.md`. Phase 1 does NOT touch these; capturing here so the storage abstraction (D-05) reserves a future seam for it.
- **GitHub repository** — to be created during Phase 1 execution with name `budget-app` under user `simpsonian354` (provisional — reconfirm). GitHub Pages Action deploys from `gh-pages` branch (or `main` via Actions, TBD at plan-phase).

</code_context>

<specifics>
## Specific Ideas

- **Inviolable constraints C1/C2/C3 propagate structurally, not by comment.** The storage abstraction MUST NOT expose credential-storage methods (C2). The state model MUST NOT have a `moveMoney()` or `executeSweep()` operation (C3). The food-floor singleton MUST NOT have a "decreaseFloor()" method, only "setSeedValue(higher_value_only)"-style guard at the storage layer (C1).
- **Phone-readability is real, not theoretical.** Settings surface in Phase 1 is the first thing Ian will check on his phone after the GH Pages deploy works. Tap targets ≥ 44px, no horizontal scroll, no off-screen content. Phase 1 doesn't need to be pretty; it needs to be usable on a phone.
- **Backup file naming convention:** `budget-app-backup-YYYY-MM-DD.json`. Predictable, sortable, no spaces.

</specifics>

<deferred>
## Deferred Ideas

- **Tailwind vs CSS modules** — pushed to plan-phase; Phase 1's UI is too small to be the deciding case alone.
- **Custom domain for GitHub Pages** — not raised; default `<user>.github.io/budget-app/` is fine. Can add a CNAME later without code changes.
- **Service worker / offline-first** — IndexedDB already works offline once loaded; a service worker would make the *initial* load work offline too. Nice-to-have, not required by any v1 REQ. Defer to v2.
- **Encryption at rest** — IndexedDB is per-origin and per-device. No credentials in this app (C2), so the threat model doesn't justify encryption complexity for v1. Revisit if v2 ever adds receipt content with PII.
- **Multi-account / role separation** — out of scope (single-user app by design).

</deferred>

---

*Phase: 1-Foundation-Storage-Deploy*
*Context gathered: 2026-05-27*
