---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 UI-SPEC approved
last_updated: "2026-05-30T02:41:35.493Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 16
  completed_plans: 11
  percent: 69
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

**Phase:** 4 (food-contract-locked-floor)
**Plan:** Not started
**Status:** Ready to execute
**Progress:** ████░░░░░░ 60% (3/5 phases complete)
**Last completed:** Phase 3 — expense-model-sinking-funds (3/3 plans, UAT passed 2026-05-29)

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

**Last session:** 2026-05-30T01:03:04.225Z

**Stopped at:** Phase 4 UI-SPEC approved

**Next session action:** Start Phase 4 (Food Contract — Locked Floor) — `/clear` then `/gsd-discuss-phase 4`. PLAN-FORMAT-CONFIRM is now RESOLVED — read the "SMC plan format — confirmed" block above before planning; it changes the parser scope (date-range filenames, no SMC pricing → app's own unit-cost map, prose ingredient tokenization, fallback-high unpriced guard, non-decomposable meals like "Qdoba bowl"). Phase 4 must respect C1: food floor structurally non-editable downward; `settings['foodFloor']` singleton guarded. NOTE dated follow-up: bump GitHub Actions tags before 2026-06-02 (armed scheduled agent runs 2026-06-01).

---

*Last updated: 2026-05-29*
