---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 2 UI-SPEC approved
last_updated: "2026-05-28T15:39:22.057Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 8
  completed_plans: 3
  percent: 40
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

Phase: 02 (income-model-with-two-floors) — EXECUTING
Plan: 1 of 5
**Phase:** 3
**Plan:** Not started
**Status:** Ready to plan
**Progress:** ██░░░░░░░░ 20% (3/3 Phase-1 plans, 1/5 phases)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Phases complete | 1 |
| v1 Requirements | 58 (all mapped) |
| Requirements complete | 10 (FOUND-01..06, UI-05, DEP-01..03) |

---

## Quick Tasks Completed

| Date | Task | Commit |
|------|------|--------|
| 2026-05-28 | dev server auto-opens in OS default browser (`server.open: true`) | `55fb07b` |

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

### Key Decisions (added 01-03)

- GitHub coordinates: account **IanSimpson7**, repo **budget-app** — matches hardcoded vite base '/budget-app/'; no config change needed.
- Deploy workflow test-gates (`npm run test -- --run`) BEFORE build; a failing test blocks deploy.
- Pages source = "GitHub Actions" (artifact flow), not a gh-pages branch. All actions are official GitHub-owned, pinned to MAJOR tags (T-01-13).
- Live URL: https://iansimpson7.github.io/budget-app/ — phone-verified by Ian.

### Deferred (v1 → v2)

- OCR-01, OCR-02 (screenshot OCR ingestion + itemized receipt parser) — architect storage seam in v1, defer implementation
- IMPORT-01 (CSV/QFX transaction file import)
- FORECAST-01, FORECAST-02 (forecasting + relocation modeling)
- SMC-01 (live wiring to SMC; v1 reads files only)

### Blockers

None.

### Dated Follow-ups

- **[ACT BEFORE 2026-06-02] Bump GitHub Actions major-version tags.** `deploy.yml` uses `@v4`/`@v3` actions running on Node 20; GitHub force-migrates runners to Node 24 on 2026-06-02. Bump checkout/setup-node/configure-pages/upload-pages-artifact/deploy-pages to latest majors before then. (Also in 01-03-SUMMARY.md and phase deferred-items.md.)

### Provisional values to converge during build (per spec §12)

- Passive floor (~$2,400 → ~$2,900) — validate at August 2026 review against June–July checks
- Food floor (~$550/mo) — converge from receipts
- Flavor line (~$50/mo) — refine from receipts
- EF sweep (~$1,000) — confirm landed after ~May 29 payday

---

## Session Continuity

**Last session:** 2026-05-28T11:30:35.008Z

**Stopped at:** Phase 2 UI-SPEC approved

**Next session action:** Plan Phase 2 (Income Model with Two Floors) — `/gsd-plan` or `/gsd-execute-phase` for Phase 2. Lifts the atomWithObservable ban; validate React 19 atomWithObservable+liveQuery path. NOTE the dated follow-up: bump Actions tags before 2026-06-02.

---

*Last updated: 2026-05-28*
