---
phase: 04-food-contract-locked-floor
plan: "02"
subsystem: food-domain/parser
tags: [tdd, food, parser, pure-function, fixtures]
dependency_graph:
  requires: [04-01]
  provides: [parsePlanFile, tokenizeMealName, ParsedPlan, __fixtures__]
  affects: [04-03-cost-engine, 04-04-atoms]
tech_stack:
  added: []
  patterns: [pure-function-parser, vite-raw-import-for-test-fixtures, regex-per-key-frontmatter]
key_files:
  created:
    - src/domains/food/planParser.ts
    - src/domains/food/planParser.test.ts
    - src/domains/food/__fixtures__/2026-05-18.md
    - src/domains/food/__fixtures__/2026-05-19.md
    - src/domains/food/__fixtures__/2026-05-21.md
    - src/domains/food/__fixtures__/2026-05-25--2026-05-28.md
    - src/domains/food/__fixtures__/2026-05-29--2026-05-31.md
  modified: []
decisions:
  - "FINDING (resolves RESEARCH A3/OQ2): date-range files can use either body format — 2026-05-25--2026-05-28 uses table format; 2026-05-29--2026-05-31 uses **Food:** prose format. Parser tries table first, falls back to prose regardless of filename type."
  - "Test fixtures use Vite ?raw static imports (not Node fs/readFileSync) — avoids @types/node dependency, consistent with how food.atoms.ts will load plan files at runtime."
  - "FOOD_PROSE_GLOBAL_RE is a module-level constant with lastIndex reset before each use — avoids state leakage across calls for a global-flag regex."
  - "noUncheckedIndexedAccess compliance: get() helper for Record<string,string> lookup; explicit non-null checks after all regex match group accesses."
metrics:
  duration_seconds: ~260
  completed_date: "2026-05-30"
  tasks: 2
  files: 7
---

# Phase 4 Plan 02: SMC Plan Parser Summary

Pure parser + hermetic fixtures: (raw md string, filename) → ParsedPlan | null. Proven by TDD against 5 live SMC plan snapshots, covering all 14 known meal strings across both body formats and both filename formats.

## Tasks

### Task 1: Copy 5 live SMC plan files into hermetic __fixtures__ snapshot

Verbatim copies of 5 live SMC plan files committed to `src/domains/food/__fixtures__/`:
- `2026-05-18.md`, `2026-05-19.md`, `2026-05-21.md` — single-date, **Food:** prose format
- `2026-05-25--2026-05-28.md` — date-range batch, table body format (`| # | Time | Meal | Selector |`)
- `2026-05-29--2026-05-31.md` — date-range batch, **Food:** prose format

**Commit:** `204f573`

### Task 2: TDD parsePlanFile + tokenizeMealName (RED → GREEN)

RED commit (`12ceed5`): 35 failing tests covering V1 parser behaviors, V2 tokenizer, filename fallback, and null path.

GREEN commit (`7f768ed`): Implementation of `parsePlanFile` and `tokenizeMealName`. Updated tests to use Vite `?raw` imports (no `@types/node`). tsc -b clean. All 35 tests pass; full suite 286/286 green.

## Resolved Open Questions

**RESEARCH A3 / OQ2 — single-day body format:** Confirmed via direct file read:
- `2026-05-18.md`, `2026-05-19.md`, `2026-05-21.md` all use `**Food:**` prose format (one per slot)
- `plan_version: "1.1"` files use `date:` frontmatter (no `window_start`/`window_end`)
- `plan_version: "1.2"` files use `window_start:`/`window_end:` frontmatter

**Body format is NOT determined by filename type:**
- `2026-05-25--2026-05-28.md` (range): table format
- `2026-05-29--2026-05-31.md` (range): **Food:** prose format
- Parser tries table format first; falls back to prose format — handles all 5 fixtures correctly.

## Body Format Confirmed (Single-Day vs Batch)

| File | Filename format | Body format | Window frontmatter |
|------|----------------|-------------|-------------------|
| 2026-05-18.md | Single-date | **Food:** prose | `date: "2026-05-18"` |
| 2026-05-19.md | Single-date | **Food:** prose | `date: "2026-05-19"` |
| 2026-05-21.md | Single-date | **Food:** prose | `date: "2026-05-21"` |
| 2026-05-25--2026-05-28.md | Date-range | TABLE rows | `window_start`/`window_end` |
| 2026-05-29--2026-05-31.md | Date-range | **Food:** prose | `window_start`/`window_end` |

## Corpus Coverage

All 14 known meal strings (normalized) appear across the 5 fixtures with 0 dropped slots. Total: 55 slots (5+5+5+24+16).

Meals appearing in prose-format files retain their comma-separated form (e.g. `"pasta, beef, cheese, green beans"`, `"chicken, rice, and broccoli"`). Meals in the table-format file appear comma-free (e.g. `"chicken rice and broccoli"`, `"pasta beef cheese green beans"`). Both normalized forms must be in the meal-definition table for correct join (Plan 03 concern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Test imports rewritten to use Vite ?raw instead of Node fs/readFileSync**
- **Found during:** Task 2 GREEN — tsc -b reported `Cannot find module 'fs'` and `Cannot find name '__dirname'`
- **Issue:** The RED test used Node's `readFileSync`/`__dirname` but `@types/node` is not installed; project uses `moduleResolution: "bundler"` (Vite-native); adding `@types/node` would be a new dev-dep diverging from the established pattern.
- **Fix:** Rewrote fixture loading to use static `import raw from './__fixtures__/...?raw'` imports — consistent with how `food.atoms.ts` will load SMC plan files via `import.meta.glob` at build time. The test behavior is identical; the mechanism is now Vite-idiomatic.
- **Files modified:** `src/domains/food/planParser.test.ts`
- **Commit:** `7f768ed` (bundled with GREEN implementation)

**2. [Rule 1 - Bug] tokenizeMealName comma-then-and edge case**
- **Found during:** Task 2 first GREEN test run
- **Issue:** `"chicken, rice, and broccoli"` split on commas yielded `["chicken", "rice", "and broccoli"]`; subsequent split on ` and ` regex applied only to interior " and " (not leading "and "), so the third token was `"and broccoli"` instead of `"broccoli"`.
- **Fix:** After comma-split, strip leading `and ` or `with ` via `replace(/^and\s+/i, '')` on each segment before the `\s+and\s+` split.
- **Files modified:** `src/domains/food/planParser.ts`
- **Commit:** `7f768ed` (bundled with GREEN implementation)

## Verification Results

- `npx tsc -b`: clean (no errors)
- `npm run test -- --run src/domains/food/planParser.test.ts`: 35/35 pass
- Full suite: 286/286 pass
- No dexie/jotai/react/storage imports in planParser.ts

## TDD Gate Compliance

- RED gate: commit `12ceed5` — `test(04-02): add failing tests for parsePlanFile + tokenizeMealName (RED)`
- GREEN gate: commit `7f768ed` — `feat(04-02): implement parsePlanFile + tokenizeMealName (GREEN)`
- REFACTOR: not needed — implementation was clean on first pass.

## Known Stubs

None. This plan delivers a complete pure parser with no placeholder values or TODO paths.

## Threat Surface Scan

No new threat surface introduced:
- `parsePlanFile` is a pure function; no network calls, no storage writes, no SMC write path (T-04-07).
- Regex patterns are anchored module-level constants with no unbounded backtracking (T-04-06).
- Returns null on failure; no partial/malformed ParsedPlan leaks through (T-04-05).
- Fixtures are hermetic committed snapshots; test runs are deterministic with no live SMC access.

## Self-Check: PASSED

Files created:
- `src/domains/food/planParser.ts` — FOUND
- `src/domains/food/planParser.test.ts` — FOUND
- `src/domains/food/__fixtures__/2026-05-25--2026-05-28.md` — FOUND (window_start confirmed)

Commits:
- `204f573` — chore(04-02): add hermetic SMC plan fixtures
- `12ceed5` — test(04-02): RED failing tests
- `7f768ed` — feat(04-02): GREEN implementation
