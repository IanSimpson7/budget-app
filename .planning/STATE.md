---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 Plan 4 complete — food atom chain wired, survivalFloorAtom swapped to computed food floor (V7), README V8
last_updated: "2026-05-30T12:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 16
  completed_plans: 18
  percent: 97
---

# State: Budget App

**Initialized:** 2026-05-27

---

## Project Reference

**Core Value:** Show Ian where this month's income stands against the floor that matters, and where surplus should go first — without ever pressuring food or moving money.

**Inviolable Constraints:**

- C1 — Food floor never gated, reduced, or suggested as a cut
- C2 — No bank credentials, ever
- C3 — App never moves money / executes trades

**Spec:** `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md`
**Tech stack (decided):** Vite + React + TypeScript, IndexedDB behind storage abstraction, GitHub Pages deploy

---

## Current Position

Phase: 04 (food-contract-locked-floor) — EXECUTING
Plan: 5 of 5
**Phase:** 4 (food-contract-locked-floor)
**Plan:** 5 (04-04 complete; 04-05 next)
**Status:** Executing Phase 04
**Progress:** [████████░░] 97%
**Last completed:** Phase 4 Plan 4 — food atom chain (glob loader, liveQuery, foodFloorAtom, survivalFloorAtom integration, V8 README)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Phases complete | 1 |
| v1 Requirements | 58 (all mapped) |
| Requirements complete | 10 (FOUND-01..06, UI-05, DEP-01..03) |

---
| Phase 03 P01 | 40m | 3 tasks | 13 files |
| Phase 03 P02 | 7m | 3 tasks | 10 files |
| Phase 03 P03 | 286s | 2 tasks | 5 files |
| Phase 04-food-contract-locked-floor P01 | 449 | 2 tasks | 9 files |
| Phase 04-food-contract-locked-floor P02 | 260 | 2 tasks | 7 files |
| Phase 04-food-contract-locked-floor P03 | 600 | 2 tasks | 2 files |
| Phase 04-food-contract-locked-floor P04 | 1500 | 2 tasks | 6 files |

## Quick Tasks Completed

| Date | Task | Commit |
|------|------|--------|
| 2026-05-28 | dev server auto-opens in OS default browser (`server.open: true`) | `55fb07b` |
| 2026-05-30 | Bump Pages action tags to Node 24 majors (checkout/setup-node/configure-pages v6, upload-pages-artifact/deploy-pages v5) | `ffcde28` |
| 2026-05-30 | Fix ICU-dependent IncomeBar `$3k` label + bump `.nvmrc` 20→24 (surfaced by first deploy since Phase 1; Node 20 EOL) — deploy green | `0010216` |

---

## Accumulated Context

### Key Decisions (from PROJECT.md)

- Nested git repo at `projects/budget-app/.git`, separate GitHub remote
- GitHub Pages static deploy from day 1 (Phase 1) so progress is phone-visible throughout
- Vite + React + TypeScript (TS strengthens the FoodNeed/Floors/Surplus contracts)
- IndexedDB behind storage abstraction (per-device by design; sync via JSON export/import)
- SMC files read via relative workspace path `../schedule-meal-coordinator/` — one-way read-only
- Manual unit-cost map UI in v1 (no receipt parser; OCR is v2)
- Skip project-level GSD research — spec v1 already supplies stack, features, architecture, pitfalls

### Open Loops

- **LEVERAGE-PAUSE-1**: RESOLVED in CONTEXT.md (Jotai + Dexie + storage abstraction, D-01..D-11)
- **PLAN-FORMAT-CONFIRM**: ✅ RESOLVED 2026-05-29 against live samples in `../schedule-meal-coordinator/plans/`. Findings feed Phase 4 (see "SMC plan format — confirmed" below). Spec §5g was incomplete.

### SMC plan format — confirmed (2026-05-29, feeds Phase 4 parser)

Verified against `../schedule-meal-coordinator/plans/*.md` (5 live files). Spec §5g assumed `plans/<date>.md`; reality is richer. Phase 4 parser MUST handle:

- **Filenames**: single-date `YYYY-MM-DD.md` AND date-range `YYYY-MM-DD--YYYY-MM-DD.md` (batch windows). Both forms coexist.
- **Frontmatter**: `window_start`, `window_end`, `mode` (e.g. batch), `manifest_hash`, `generated_at`, `plan_version` (currently 1.2), `constraint_conflicts[]`, `auditor_note`.
- **Body**: `## Prep this batch` (batch items), per-day `## YYYY-MM-DD (Weekday)` + context line (wake/lift/home/forbidden window), per-slot `### N. TIME — slot-type · [STATUS]` then `**Food:**` / `**Selector:**` / `**Dimensions:**` and an optional embedded ```yaml counterfactual_if_rejected / rejected_candidates``` block.
- **CRITICAL — no pricing in SMC**: `**Food:**` values are prose meal strings ("Chicken, rice, and broccoli", "Pasta, beef, cheese, green beans"), NO quantities, NO costs. The food floor CANNOT be sourced from SMC pricing — it must come from the app's OWN unit-cost map (PROJECT decision: "manual unit-cost map UI in v1"). Parser must: tokenize ingredients from mixed separators (`,`, "and", "with"), price against the map, and `fallback-high` on any unpriced token (FOOD unpriced-ingredient guard; conservative per C1 — never understate the protected floor).
- **Non-decomposable meals**: some `**Food:**` entries are whole-meal/restaurant items with no extractable ingredients (e.g. "Qdoba bowl"). Need meal-level pricing OR fallback-high; cannot assume every entry splits into ingredients.
- Known meal corpus (14 unique strings as of 2026-05-29): Cereal and milk · Chicken, rice, and broccoli · Eggs and PB toast · French Toast and Eggs · Greek yogurt with granola and berries · Oatmeal and protein slop · Oatmeal cream pie and banana · Pasta, beef, cheese, green beans · Protein Slop and Granola · Protein shake and banana · Qdoba bowl · Rice cakes with peanut butter and banana · Sweet potato, beef, cheese, green beans · Turkey sandwich with cheese and green beans.

### Key Decisions (added 01-01)

- Pinned tailwindcss ^3.4.17 (NOT v4) — UI-SPEC tailwind.config.ts is v3 syntax (Pitfall 2 locked)
- Hardcoded vite base '/budget-app/' (D-18 / RESEARCH Open Question 3)
- structuredClone polyfill placed BEFORE fake-indexeddb/auto import in src/test/setup.ts (Pitfall 4 locked)
- @testing-library/jest-dom pinned ^6.9.1 (RESEARCH cited a non-existent 29.x version)
- tsconfig project-references composite dropped; per-file emit policy left to Vite's loader

### Key Decisions (added 01-02)

- Phase 1 uses PLAIN async Jotai atoms + refresh-counter for invalidation, NOT atomWithObservable (RESEARCH Pitfall 1 lockout); liveQuery reserved for Phase 2 dashboard.
- exportAll() seeds DEFAULT_FLOORS into the envelope when no settings row has been saved, so a round-trip into a fresh DB reproduces UI state.
- importAll refuses any source schemaVersion with no migration path (empty v1 MIGRATIONS map ⇒ only schemaVersion === 1 accepted).
- ImportError code → toast copy map lives in BackupPage.tsx, NOT in storage.ts — storage layer stays UI-agnostic.
- jsdom Blob.prototype.text() polyfill added to test/setup.ts via FileReader (required for storage.importAll under Vitest).
- T-01-08 boundary recorded for Phase 4: `floors.foodSeed` is user-editable both directions in Phase 1; the C1 lock applies to the future `settings['foodFloor']` singleton specifically, not to the seed.

### Key Decisions (added 01-03)

- GitHub coordinates: account **IanSimpson7**, repo **budget-app** — matches hardcoded vite base '/budget-app/'; no config change needed.
- Deploy workflow test-gates (`npm run test -- --run`) BEFORE build; a failing test blocks deploy.
- Pages source = "GitHub Actions" (artifact flow), not a gh-pages branch. All actions are official GitHub-owned, pinned to MAJOR tags (T-01-13).
- Live URL: https://iansimpson7.github.io/budget-app/ — phone-verified by Ian.

### Key Decisions (added 04-04)

- **glob syntax**: `query: '?raw', import: 'default'` (Vite 5+ form; `as: 'raw'` is deprecated).
- **DEFAULT_FOOD_FLOOR_SEED guard**: stale path shows 550 when `max(last,highWater)=0` (never $0 — C1).
- **V7 integration**: `survivalFloorAtom` reads `foodFloorAtom.floor` (not `floors.foodSeed`); `floorsLoadAtom` no longer needed in expenses.atoms.ts.
- **I-02 DEV guard**: `console.error` when glob resolves 0 files in DEV mode — wrong path depth is caught before silently mimicking CI fallback.
- **CI fallback documented in README**: deployed app always shows stale floor (local build-then-push flow for plan data updates).

### Key Decisions (added 04-01)

- **mealDefinitions optional in SchemaV1Data** — avoids breaking all existing tests that construct v1-v3 data without the field; migrate_3_to_4 nullish-coalesces to [].
- **I-07 resolved**: "PB" normalized to "peanut butter" in seed meal ingredients; other potential synonyms left unmapped (expected gap-list noise, fallback-high covers C1).
- **Qdoba bowl seeds with flatCost unset** → triggers fallback-high gap flag (D-04) until Ian sets via /food/config.
- **SEED_UNIT_COST_MAP seeds 3 macro-bearing entries** (bulk whey, 90/10 ground beef, chicken breast); satisfies I-04/EXP-07 handoff for whey-bearing meals pricing immediately.
- **FlavorLine persisted at seed time** ({amount:50}); getFlavorLine() returns the persisted seed, not the code default, after first seed run.

### Deferred (v1 → v2)

- OCR-01, OCR-02 (screenshot OCR ingestion + itemized receipt parser) — architect storage seam in v1, defer implementation
- IMPORT-01 (CSV/QFX transaction file import)
- FORECAST-01, FORECAST-02 (forecasting + relocation modeling)
- SMC-01 (live wiring to SMC; v1 reads files only)

### Blockers

None.

### Dated Follow-ups

- ✅ **[DONE 2026-05-30] Bump GitHub Actions major-version tags.** `deploy.yml` bumped to Node 24-ready majors (checkout/setup-node/configure-pages v6, upload-pages-artifact/deploy-pages v5) ahead of the 2026-06-02 forced runner migration. Quick task `260530-81h`, commit `ffcde28`. The armed scheduled agent (2026-06-01) was cancelled by Ian on 2026-05-30 (no longer needed).

### Provisional values to converge during build (per spec §12)

- Passive floor (~$2,400 → ~$2,900) — validate at August 2026 review against June–July checks
- Food floor (~$550/mo) — converge from receipts
- Flavor line (~$50/mo) — refine from receipts
- EF sweep (~$1,000) — confirm landed after ~May 29 payday

---

## Session Continuity

**Last session:** 2026-05-30T10:51:00.850Z

**Stopped at:** Phase 4 Plan 1 complete — food storage foundation (schema v4, CRUD, singletons, seed, C1 lock)

**Next session action:** Continue Phase 4 with Plan 2 (`/gsd-execute-phase 4`). Plan 04-01 is complete: schema v4 live with mealDefinitions table, food.types.ts contracts, all storage methods, 14 seeded meals, unit-cost map seeded (bulk whey/ground beef/chicken), C1 lock proven by V6 absence tests. Plans 02–05 build the parser, cost engine, config surface, and food panel UI on top of this foundation.

---

*Last updated: 2026-05-30*
