---
phase: 04-food-contract-locked-floor
plan: "05"
subsystem: food-domain/ui
tags: [food, ui, c1-critical, locked-floor, react-router, tailwind, tdd, human-verify]
dependency_graph:
  requires: [04-01, 04-04]
  provides: [FoodPage, FoodConfigPage, food-routes, appshell-food-nav, saveFoodFloorMetaAtom]
  affects: [App.tsx, AppShell.tsx]
tech_stack:
  added: []
  patterns: [page-suspense-boundary, jotai-write-atoms, tokens-only-tailwind, font-mono-financials, lock-icon-c1]
key_files:
  created:
    - src/pages/FoodPage.tsx
    - src/pages/FoodConfigPage.tsx
    - src/pages/FoodPage.test.tsx
  modified:
    - src/App.tsx
    - src/components/AppShell.tsx
    - src/domains/food/food.atoms.ts
decisions:
  - "C1 visual contract verified by human-verify checkpoint (6 conditions) on the live phone-readable UI — Ian approved 2026-05-30"
  - "Protected floor rendered read-only with a persistent Lock icon; no input/stepper/decrement affordance anywhere on the floor line"
  - "Config framed as 'Meal cost configuration' (accuracy tooling) — never a budget lever; FOOD-13 'mark refined' records a timestamp only, never edits the floor value"
  - "New unit-cost rows default Tag to macro-bearing (I-05); unpriced (cost 0) rows render amber + a readable text flag"
  - "Discretionary food (gateable) shown as a SEPARATE figure beside the protected floor — not folded into the floor (I-06, no double-count)"
  - "Displayed floor consumes FoodFloorResult.floor (conservative-high); solvency uses solvencyFloor (04-06) — two-floor separation preserved"
metrics:
  duration: "~12 minutes (implementation) + human-verify checkpoint"
  completed: "2026-05-30"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
---

# Phase 4 Plan 05: Food UI Surfaces (Locked Floor) Summary

The two food surfaces per `04-UI-SPEC.md`: `/food` (locked protected floor + status badge with expandable gap detail + flavor line + gateable discretionary layer + empty states) and `/food/config` (Table A meal definitions, Table B unit-cost map, Table C portion model, "mark refined" timestamp). Routes registered, AppShell "Food" nav link added. Closed with a human-verify checkpoint on the C1 visual contract (6 conditions) — **approved by Ian on the live UI, 2026-05-30**.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for FoodPage + FoodConfigPage | `df183b7` | src/pages/FoodPage.test.tsx |
| 1 GREEN | FoodPage locked floor + badge + flavor + gateable + routes + nav + saveFoodFloorMetaAtom | `7928e88` | src/pages/FoodPage.tsx, src/App.tsx, src/components/AppShell.tsx, src/domains/food/food.atoms.ts, src/pages/FoodPage.test.tsx |
| 2 GREEN | FoodConfigPage Tables A/B/C + FOOD-13 + I-05 macro-bearing default | `259a8fe` | src/pages/FoodConfigPage.tsx |
| 3 | Human-verify checkpoint — C1 visual contract (6 conditions) | — (approval) | — |

## What Was Built

### `src/pages/FoodPage.tsx` (`/food`)
- **Locked protected floor**: the floor dollar value (`font-mono`) is read-only with a persistent **Lock icon** and the explainer *"Computed from your meal plan — protected."* No input, pencil, stepper, or decrement affordance — C1 structural lock at the UI layer.
- **Status badge** (`foodBadgeStatusAtom`): `clean` → "Plan current"; `needs-attention` → amber, expandable to the named gap list (unpriced ingredients / undefined meals / stale plan) from `foodFloorAtom.gaps` (D-11).
- **Flavor line**: *"Flavor & condiments — protected"* with an upward-only amount edit.
- **Gateable discretionary layer**: rendered as a **separate** figure beside the protected floor (I-06 — not folded into the floor; no double-count).
- Designed empty/loading/error states; phone-readable (no horizontal scroll); `min-h-[44px]` tap targets; tokens-only styling.

### `src/pages/FoodConfigPage.tsx` (`/food/config`)
- **Table A** meal definitions; **Table B** unit-cost map (cost + unit + macro/flavor Tag — new rows default Tag to macro-bearing, I-05; unpriced rows render amber + text flag); **Table C** portion model.
- **FOOD-13** "mark refined from receipts" records a `lastRefinedFromReceipts` timestamp ONLY — never edits the floor value directly.
- Editing a unit cost recomputes the displayed floor reactively via the write atoms.

### `src/App.tsx` / `src/components/AppShell.tsx`
- `/food` and `/food/config` routes registered (HashRouter); "Food" nav link added to the AppShell after Funds.

### `src/domains/food/food.atoms.ts`
- Added `saveFoodFloorMetaAtom` (used by FoodConfigPage "mark refined", FOOD-13) — bumps the meta refresh counter; cannot set an arbitrary floor value.

## Verification Results
- `npx tsc -b`: clean.
- Full suite at checkpoint: **891/891 pass** (post-04-06: 929/929). 0 failures.
- **Human-verify checkpoint (C1 visual contract): APPROVED by Ian** on the live UI (http://localhost:5174/budget-app/), 2026-05-30. All 6 conditions confirmed: (a) floor read-only, (b) persistent Lock icon, (c) "Computed from your meal plan — protected" visible, (d) no cut/reduce/trim wording, (e) "Meal cost configuration" framing, (f) flavor line upward-only.

## C1 Compliance
- No UI affordance lowers the protected food floor. The config tables refine meal definitions / unit costs / portions (which can only raise or sharpen the computed floor); they never override the floor downward.
- Displayed floor = `FoodFloorResult.floor` (conservative-high, fallback on gaps). Solvency consumes `solvencyFloor` (04-06) — the displayed floor is never understated.

## Checkpoint-surfaced follow-up (resolved in 04-06)
During this checkpoint Ian observed the survival floor jump to $4,265 because an unconfigured cost map (3 of ~15 ingredients seeded) sent all 16 scheduled slots to the fallback ceiling. Diagnosed as correct C1 fallback-high behavior, not a bug. Gap plan **04-06** landed three complementary fixes: (b) kind-aware fallback ceiling (snack $5 / meal $15), (c) `survivalFloorAtom` now consumes a realistic `solvencyFloor` (so solvency is no longer hostage to the unconfigured map), (d) overlap double-count guard. Displayed floor (C1) unchanged.

## Self-Check: PASSED

Files created:
- `src/pages/FoodPage.tsx` ✓
- `src/pages/FoodConfigPage.tsx` ✓
- `src/pages/FoodPage.test.tsx` ✓

Files modified:
- `src/App.tsx` ✓
- `src/components/AppShell.tsx` ✓
- `src/domains/food/food.atoms.ts` ✓

Commits: `df183b7` (RED) ✓ · `7928e88` (GREEN) ✓ · `259a8fe` (GREEN) ✓ · checkpoint approved ✓

Full suite: 929/929 passing ✓
