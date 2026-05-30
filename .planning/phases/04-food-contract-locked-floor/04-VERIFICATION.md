---
phase: 04-food-contract-locked-floor
verified: 2026-05-30T16:35:00Z
status: human_needed
score: 7/7
overrides_applied: 0
human_verification:
  - test: "Open /food on a mobile device; confirm the floor dollar value is a plain <span>, no tap-to-edit, no stepper, no pencil icon anywhere on the protected floor card line"
    expected: "Floor value is static text only — Lock icon visible, 'Computed from your meal plan — protected' visible, no affordance that lowers the floor"
    why_human: "C1 visual contract — absence of downward-edit affordance cannot be fully confirmed by grep; FoodPage.tsx passes structural inspection but a rendered UI pass on a real device closes the clinical loop"
  - test: "Open /food/config; click 'Add ingredient', observe the Tag dropdown default"
    expected: "New ingredient row defaults Tag to 'Macro-bearing', never 'Flavor / condiment'"
    why_human: "I-05 default verified in source (line 678: tag: 'macro-bearing') and confirmed in the handleAddIngredient reset; visual confirmation on the live form closes the loop"
  - test: "With a configured local SMC repo, verify the /food page reflects scheduled meals from today's plan file and does NOT offer any way to edit the SMC plan files"
    expected: "Meal names from the active plan file appear in the gap list (or 'Plan current' badge if all priced); no edit/write affordance for SMC files"
    why_human: "FOOD-01 read-only guarantee — verified structurally (planParser is read-only; no write path to SMC), but live SMC integration requires a real build with the sibling repo present"
---

# Phase 4: Food Contract (Locked Floor) — Verification Report

**Phase Goal:** Ian sees the protected food floor rendered as a locked, rent-like line in every budget view — computed live from the SMC meal pool and current plan, ingredient-keyed, with explicit flags for unpriced ingredients and stale/missing plans (fallback-high, never lower).
**Verified:** 2026-05-30T16:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App reads SMC plan files and shows scheduled meals (read-only — SMC files never modified) | VERIFIED | `planParser.ts` is a pure read function; `import.meta.glob` with `?raw` query; no write path to SMC directory anywhere in src; 5 hermetic fixtures in `src/domains/food/__fixtures__/` |
| 2 | Ian can edit unit-cost map and portion model via in-UI tables; meal costs recompute immediately | VERIFIED | `FoodConfigPage.tsx` Tables A/B/C wired to `saveUnitCostMapAtom` / `savePortionModelAtom`; write atoms bump refresh counters triggering `foodFloorAtom` re-derivation |
| 3 | Food panel renders protected floor as locked line — NO downward-edit affordance, NO "cut spending" suggestion | VERIFIED | `ProtectedFloorCard` renders floor as `<span data-testid="floor-value">` only; Lock icon always present; grep confirms no "cut food"/"reduce food"/"save on food"/"trim food" strings in source; `FoodPage.test.tsx` asserts absence at lines 314–317, 361–364 |
| 4 | Unpriced ingredient triggers a visible "unpriced — needs unit cost" flag (no silent undercount) | VERIFIED | `costEngine.ts:computeFloor` emits `unpriced-ingredient` gap; `FoodPage.tsx:gapCopy()` renders named text; `FALLBACK_CEILING_SNACK`/`FALLBACK_CEILING_MEAL` used on all three gap paths — never $0 |
| 5 | Stale/missing plan falls back to last-known or high-water (never lower) and shows staleness flag | VERIFIED | `foodFloorAtom` stale path: `rawFallback > 0 ? rawFallback : DEFAULT_FOOD_FLOOR_SEED`; `fallbackFloor()` = `Math.max(lastComputedFloor, allTimeHighWater)`; staleness gap type `stale-plan` rendered in StatusBadge |
| 6 | Flavor/condiment line displays as separate ~$50/mo protected amount, editable, excluded from per-meal pricing | VERIFIED | `FlavorLineCard` in `FoodPage.tsx`; seeded at $50; `saveFlavorLine` atom; `FoodFloorMeta` has NO flavor field; cost engine excludes `flavor-condiment` tagged ingredients from per-meal sum (D-05) |
| 7 | Discretionary food layer (gateable) shown side-by-side with protected floor, never summed into it | VERIFIED | `GateableFoodCard` reads `gateableExpensesAtom`; comment at line 9 "NEVER added into foodFloorAtom.floor"; separated rendering confirmed in `FoodPage.tsx` structure |

**Score:** 7/7 truths verified

---

## C1 / C2 / C3 Constraint Verdicts

### C1 — Food floor never gated, reduced, or suggested as a cut

**VERDICT: STRUCTURALLY ENFORCED**

Evidence at each layer:

| Layer | Evidence | Status |
|-------|---------|--------|
| Storage | No `setFoodFloor` or `decreaseFoodFloor` method in `storage.ts`; confirmed by grep (only appears in comments and absence-proof tests) | ENFORCED |
| Types | `FoodFloorMeta` has no writable floor field — only `lastComputedFloor`, `allTimeHighWater`, `lastRefinedFromReceipts` | ENFORCED |
| Cost engine | All three gap paths contribute `FALLBACK_CEILING_SNACK` (5) or `FALLBACK_CEILING_MEAL` (15) — never $0 | ENFORCED |
| Atoms | `foodFloorAtom` write-back ONLY on `isClean === true`; high-water uses `Math.max` (ratchets up, never down) | ENFORCED |
| UI — FoodPage | Floor rendered as `<span>` with Lock icon; no `<input>` on floor line; no decrement/pencil affordance | ENFORCED (structural) |
| UI — FoodConfigPage | Heading "Meal cost configuration" not "Adjust food budget"; no string "cut food"/"reduce food budget"/"save on food"/"trim food" anywhere in source | ENFORCED |
| Solvency (04-06) | `survivalFloorAtom` consumes `solvencyFloor` (realistic); displayed `floor` unchanged — C1 conservative-high display preserved | ENFORCED |
| Absence tests | `storage.test.ts` lines 39–52 assert `setFoodFloor` and `decreaseFoodFloor` are `undefined` + TS `@ts-expect-error` type-level proof | ENFORCED |

### C2 — No bank credentials or live account linking

**VERDICT: NOT APPLICABLE TO PHASE 4 / ENFORCED BY DESIGN**

Phase 4 adds only local IndexedDB and Vite `import.meta.glob` (read-only file bundling). No network calls, no auth paths. No `localStorage` / `sessionStorage` in any Phase 4 source file.

### C3 — App never moves money

**VERDICT: NOT APPLICABLE TO PHASE 4 / ENFORCED BY DESIGN**

Phase 4 is advisory-only: floor computed, displayed, flagged. No transfers, no executions, no external write.

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/domains/food/food.types.ts` | VERIFIED | Exports `MealDefinition`, `UnitCostEntry`, `PortionEntry`, `FoodFloorMeta`, `FlavorLine`, `normalizeMealName`; I-05 C1 default documented |
| `src/storage/schema.ts` | VERIFIED | `CURRENT_SCHEMA_VERSION = 4 as const`; `foodSeed` preserved |
| `src/storage/migrations.ts` | VERIFIED | `migrate_3_to_4` pure function; registered as `MIGRATIONS[3]` |
| `src/storage/storage.ts` | VERIFIED | `observeMealDefinitions`, `UNIT_COST_MAP_KEY`, `PORTION_MODEL_KEY`, `FOOD_FLOOR_META_KEY`, `FLAVOR_LINE_KEY`; no `setFoodFloor` or `decreaseFoodFloor` |
| `src/domains/food/planParser.ts` | VERIFIED | Pure read-only parser; `parsePlanFile` + `tokenizeMealName`; 5 hermetic fixtures |
| `src/domains/food/costEngine.ts` | VERIFIED | `FALLBACK_CEILING_MEAL=15`, `FALLBACK_CEILING_SNACK=5`, `classifyMealKind`, `computeFloor`, `fallbackFloor`, `isPlanCurrent`; all 3 gap paths kind-aware |
| `src/domains/food/food.atoms.ts` | VERIFIED | `foodFloorAtom`, `FoodFloorResult.solvencyFloor`, overlap guard, write-back I-03, `saveFoodFloorMetaAtom` |
| `src/domains/expenses/expenses.atoms.ts` | VERIFIED | `survivalFloorAtom` destructures `solvencyFloor` from `foodFloorAtom`; V8 comment documented |
| `src/pages/FoodPage.tsx` | VERIFIED | Locked `<span>` floor, Lock icon, StatusBadge, FlavorLineCard, GateableFoodCard |
| `src/pages/FoodConfigPage.tsx` | VERIFIED | Tables A/B/C; FOOD-13 timestamp; I-05 macro-bearing default; "Meal cost configuration" heading |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `storage.ts` | `db.mealDefinitions` | `db.mealDefinitions.toArray()` | WIRED | Lines 190, 207 |
| `food.atoms.ts` | `storage.observeMealDefinitions()` | `atomWithObservable` | WIRED | Line 140 |
| `food.atoms.ts` | `planParser.parsePlanFile` | `parsedPlansAtom` async loader | WIRED | Lines 122–132 |
| `food.atoms.ts` | `costEngine.computeFloor` | `foodFloorAtom` live path | WIRED | Line 271 |
| `food.atoms.ts` | `costEngine.fallbackFloor` | `foodFloorAtom` stale path | WIRED | Line 219 |
| `expenses.atoms.ts` | `food.atoms.foodFloorAtom` | `solvencyFloor` destructure | WIRED | Line 81 |
| `FoodPage.tsx` | `food.atoms.foodFloorAtom` | `useAtomValue(foodFloorAtom)` | WIRED | Line 233 |
| `FoodConfigPage.tsx` | `food.atoms.*` write atoms | `useSetAtom` × 6 write atoms | WIRED | Lines 664–669 |
| `main.tsx` | `storage.seedMealDefinitionsIfEmpty` | first-run seed call | WIRED (claimed in SUMMARY; structurally required for seed behavior — verified via grep on `src/main.tsx`) | Per 04-01-PLAN acceptance criteria |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `FoodPage.tsx` | `floor` | `foodFloorAtom` → `computeFloor()` or `fallbackFloor()` from Dexie IDB | Yes — derived from `mealDefinitions` table + settings singletons via liveQuery | FLOWING |
| `FoodPage.tsx` | `gaps` | `foodFloorAtom.gaps` — `FloorGap[]` from cost engine | Yes — gap array populated by unpriced/undefined/stale conditions | FLOWING |
| `expenses.atoms.ts:survivalFloorAtom` | `solvencyFloor` | `foodFloorAtom.solvencyFloor` | Yes — realistic estimate, never fallback-inflated | FLOWING |
| `FoodConfigPage.tsx` | `meals`, `costMap`, `portions` | `mealDefinitionsAtom`, `unitCostMapAtom`, `portionModelAtom` from IDB | Yes — reactive via liveQuery + refresh counters | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|---------|--------|
| `tsc -b` compiles clean | `npx tsc -b` produced no output (exit 0) | PASS |
| Full vitest suite green | 929 tests, 71 files — all passing | PASS |
| `setFoodFloor` absent from storage surface | grep returns 0 non-comment matches in `src/storage/storage.ts` | PASS |
| `FALLBACK_CEILING_SNACK` used in all 3 gap paths | grep confirms lines 190, 199, 231 in `costEngine.ts` | PASS |
| `solvencyFloor` wired in `expenses.atoms.ts` | Line 81: `const { solvencyFloor } = await get(foodFloorAtom)` | PASS |
| No "cut/reduce/trim/save on food" wording in source | grep `-i` across `*.ts,*.tsx` returns only comment/test negation lines | PASS |
| No `localStorage`/`sessionStorage` in any Phase 4 src file | grep returns no matches | PASS |
| No TBD/FIXME/XXX debt markers in src | grep returns no matches | PASS |

---

### Requirements Coverage

| Requirement | Evidence | Status |
|-------------|---------|--------|
| FOOD-01 — SMC files read-only | `planParser.ts` pure read; `import.meta.glob` read-only; no write path | SATISFIED |
| FOOD-02 — Meal definition table | `mealDefinitions` Dexie table; CRUD in `storage.ts`; Table A in `FoodConfigPage` | SATISFIED |
| FOOD-03 — Ingredient tokenizer | `tokenizeMealName` in `planParser.ts` + fixtures | SATISFIED |
| FOOD-04 — Unit-cost map | `UnitCostEntry[]` settings singleton; Table B in `FoodConfigPage` | SATISFIED |
| FOOD-05 — Portion model | `PortionEntry[]` settings singleton; Table C in `FoodConfigPage` | SATISFIED |
| FOOD-06 — Monthly floor derivation | `computeFloor`: `dailyAvg × daysInMonth`; `daysInMonth` caller-supplied I-01 | SATISFIED |
| FOOD-07 — High-water / max fallback | `fallbackFloor(meta) = Math.max(last, highWater)`; stale path in `foodFloorAtom` | SATISFIED |
| FOOD-08 — Unpriced → fallback-high | `costPerUnit === 0` triggers `FALLBACK_CEILING_*`; gap emitted | SATISFIED |
| FOOD-09 — Gap flags individually named | `FloorGap` discriminated union; `gapCopy()` renders each type with ingredient/meal name | SATISFIED |
| FOOD-10 — Flavor/condiment line | `FlavorLine` singleton; `FlavorLineCard`; seed $50; `tag:'flavor-condiment'` excluded from per-meal sum | SATISFIED |
| FOOD-11 — Reactive recompute | `mealDefinitionsAtom` via `atomWithObservable`; refresh counters on write atoms | SATISFIED |
| FOOD-12 — Locked floor UI | Floor = `<span>` only; Lock icon always present; no `<input>` on floor | SATISFIED |
| FOOD-13 — Timestamp only, no floor edit | `handleMarkRefined()` writes only `lastRefinedFromReceipts = now`; floor untouched | SATISFIED |
| UI-02 — Food panel in budget view | `/food` route registered in `App.tsx`; "Food" nav link in `AppShell.tsx` | SATISFIED |
| EDGE-02 — Stale plan shows last-known | Stale path uses `max(last, highWater)` or `DEFAULT_FOOD_FLOOR_SEED`; `stale-plan` gap type shown | SATISFIED |
| EDGE-03 — Unpriced shown as warning | `isUnpriced` rows: amber highlight + "— Unpriced" text flag in `IngredientRow` | SATISFIED |

---

### Anti-Patterns Found

None detected. No TBD/FIXME/XXX markers. No stubs returning `null`/`[]` as final values without a fetch. The flavor-line default of $50, stale fallback seed of $550, and initial `mealDefinitions = []` are all correct initial states overwritten by real data on load.

---

### Human Verification Required

#### 1. C1 Visual Contract — Protected Floor Lock

**Test:** On a phone or small viewport, navigate to `/food`. Inspect the protected floor card.
**Expected:** The floor dollar value is plain non-interactive text (no tap-target highlight, no cursor change, no edit-on-tap). A Lock icon is visible adjacent to "Protected floor". The text "Computed from your meal plan — protected" is visible below the dollar value. No "cut", "reduce", "save", or "trim" wording appears anywhere on the page.
**Why human:** The absence of a downward-edit affordance is structurally enforced in JSX but the rendered DOM in a real browser (not jsdom) must confirm no touch-action or cursor change makes the floor feel editable.

#### 2. I-05 New Ingredient Tag Default

**Test:** Navigate to `/food/config`. Click "Add ingredient". Observe the Tag field before touching it.
**Expected:** Tag defaults to "Macro-bearing", not "Flavor / condiment".
**Why human:** Source code confirms the initial state is `tag: 'macro-bearing'` (line 678, line 711), but a live UI check closes the loop on the rendered form.

#### 3. FOOD-01 Live SMC Integration (local build only)

**Test:** With the `schedule-meal-coordinator` repo present as a sibling directory, run a local dev build and navigate to `/food`.
**Expected:** The StatusBadge shows "Plan current" or "Needs attention" based on today's plan file. The gap list names specific unpriced ingredients from today's scheduled meals. The SMC directory has no new/modified files after the app runs.
**Why human:** CI builds legitimately resolve 0 plan files (stale-path fallback). Live SMC integration can only be verified with the sibling repo present. The DEV-mode guard (`I-02`) will emit a `console.error` if the glob resolves 0 files in dev — that error's absence confirms the path is correct.

---

## Gaps Summary

No gaps. All 7 observable truths are VERIFIED, all 16 requirements are SATISFIED, all C1/C2/C3 constraints are structurally enforced, the full test suite (929/929) passes, and `tsc -b` is clean.

Status is `human_needed` because three items require a real rendered-UI check to close the clinical C1 contract — specifically: (1) the floor-line lock visual in a real browser, (2) the macro-bearing new-row default on the live form, and (3) live SMC integration confirmation. These are UI/integration behavioral checks that cannot be completed programmatically.

---

_Verified: 2026-05-30T16:35:00Z_
_Verifier: Claude (gsd-verifier)_
