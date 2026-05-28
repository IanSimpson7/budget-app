---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-28T02:10:00.000Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 13
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

**Phase:** 1 — Foundation, Storage, Deploy
**Plan:** 01-02 complete; next is 01-03 (GitHub Actions deploy + phone verification)
**Status:** Executing
**Progress:** ██░░░░░░░░ 13% (2/3 Phase-1 plans, 0/5 phases)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Phases complete | 0 |
| v1 Requirements | 58 (all mapped) |
| Requirements complete | 0 |

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
- **PLAN-FORMAT-CONFIRM**: Confirm real `plans/<date>.md` format against a live sample in `../schedule-meal-coordinator/plans/` BEFORE Phase 4 parser implementation (per spec §5g)

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

### Deferred (v1 → v2)

- OCR-01, OCR-02 (screenshot OCR ingestion + itemized receipt parser) — architect storage seam in v1, defer implementation
- IMPORT-01 (CSV/QFX transaction file import)
- FORECAST-01, FORECAST-02 (forecasting + relocation modeling)
- SMC-01 (live wiring to SMC; v1 reads files only)

### Blockers

None.

### Provisional values to converge during build (per spec §12)

- Passive floor (~$2,400 → ~$2,900) — validate at August 2026 review against June–July checks
- Food floor (~$550/mo) — converge from receipts
- Flavor line (~$50/mo) — refine from receipts
- EF sweep (~$1,000) — confirm landed after ~May 29 payday

---

## Session Continuity

**Last session:** 2026-05-28T02:15:00.000Z

**Stopped at:** Completed 01-02-PLAN.md (walking-skeleton vertical slice). Working tree clean. `npm run build`, `npm test -- --run` (23/23 passing, 0 todo), `npm run typecheck` all green. Commits this plan: `b91d051` (RED storage), `6f6ff23` (GREEN storage), `a0a75a7` (RED atoms), `426cfc6` (GREEN atoms + components), `fd5ca96` (RED BackupPage), `9efd70a` (GREEN pages + App).

**Next session action:** Execute `01-03-PLAN.md` — GitHub Actions deploy + phone-browser verification + CLAUDE.md/README.md update. Phase 1 ships when the live URL is reachable.

---

*Last updated: 2026-05-28*
