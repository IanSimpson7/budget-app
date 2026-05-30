---
phase: 04-food-contract-locked-floor
reviewed: 2026-05-30T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - src/storage/schema.ts
  - src/storage/db.ts
  - src/storage/migrations.ts
  - src/storage/storage.ts
  - src/domains/food/food.types.ts
  - src/domains/food/planParser.ts
  - src/domains/food/costEngine.ts
  - src/domains/food/food.atoms.ts
  - src/domains/expenses/expenses.atoms.ts
  - src/pages/FoodPage.tsx
  - src/pages/FoodConfigPage.tsx
  - src/components/AppShell.tsx
  - vite.config.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** deep (cross-file: import graph + call-chain trace)
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The C1-critical chain (planParser → costEngine → foodFloorAtom → survivalFloorAtom) is mostly well-constructed: every gap path in `computeFloor` falls back HIGH, the snack/meal ceilings are both > 0, `allTimeHighWater` ratchets via `Math.max`, the storage surface has no `setFoodFloor`, and the UI exposes no downward edit on the floor. The `solvencyFloor` decoupling (04-06) correctly lowers only the solvency consumer, not the displayed `floor`. Persistence is IndexedDB-only (no localStorage/sessionStorage), and `food.atoms` imports `storage` only (never `db`). C2 (no credentials) and C3 (no money movement) are upheld.

However, two BLOCKER-class defects undermine the C1 guarantee in the live-plan path, and several correctness/robustness issues in the reactive layer and parser warrant fixing.

The two blockers are:
1. **The displayed live floor is NOT clamped to `allTimeHighWater`** — a clean-live recompute can display a floor *lower* than a previously-recorded high-water, which is exactly the C1 understatement the high-water mechanism exists to prevent. The "Pitfall 7 isolation" comment rationalizes this, but it contradicts the C1 contract that the displayed floor must never be lowered.
2. **`windowDays` is taken from the plan's calendar span, not the number of days that actually carry scheduled meals** — a plan window wider than its meal list divides total meal cost across too many days, understating `dailyAverage` and therefore the monthly floor.

## Critical Issues

### CR-01: Clean-live floor can display BELOW the all-time high-water (C1 understatement)

**File:** `src/domains/food/food.atoms.ts:295-309` (and the design in `src/domains/food/costEngine.ts:280-292`)
**Issue:**
On the live path, the returned `floor` is `result.floor` from `computeFloor` directly. High-water (`allTimeHighWater`) is consulted ONLY on the stale path (`fallbackFloor`) and in `solvencyFloor`. The header comment ("Pitfall 7 isolation: high-water only governs the STALE path") makes this deliberate.

But consider the realistic sequence for a single user actively converging the cost map:
1. Month A: a clean plan computes `floor = $620`. Write-back sets `lastComputedFloor=620`, `allTimeHighWater=620`.
2. Month B: Ian edits a portion downward, or a leaner plan is scheduled, or `daysInMonth` drops (Feb = 28 vs Jan = 31). The clean recompute yields `floor = $540`.
3. The displayed protected floor now reads **$540 — lower than the $620 all-time high** the user previously saw locked on the dashboard.

This is precisely the "floor was lowered" event C1 forbids ("Never gate, reduce, or suggest cutting the protected food floor"). The displayed floor dropping month-over-month is a restriction signal in a BED-recovery context. The `daysInMonth` term alone guarantees this happens every shorter month even with identical meals (the test at `costEngine.test.ts:337` confirms `result31.floor > result30.floor`).

The high-water ratchet is computed and stored but never applied to the displayed live value — it is dead protection on the path that matters most.

**Fix:** Clamp the displayed live floor up to the high-water, while leaving `solvencyFloor` (the realistic solvency input) and the write-back math unclamped:
```ts
// after computeFloor(...)
const displayedFloor = Math.max(result.floor, meta.allTimeHighWater ?? 0)
// write-back high-water from the RAW computed value (not the clamped display):
if (result.isClean) {
  const newMeta: FoodFloorMeta = {
    ...meta,
    lastComputedFloor: result.floor,
    allTimeHighWater: Math.max(meta.allTimeHighWater, result.floor),
  }
  void storage.saveFoodFloorMeta(newMeta)
}
return {
  floor: displayedFloor,           // C1: never below the all-time high
  solvencyFloor,                   // unchanged — realistic, may be lower
  gaps: result.gaps,
  isClean: result.isClean,
  planIsCurrent: true,
}
```
If the intended product behavior really is "the displayed floor tracks the current month exactly and may fall," that decision must be ratified explicitly against C1 by the owner — it should not be buried in an implementation comment. Flagging as BLOCKER until that ratification exists, because the default reading of C1 is violated.

### CR-02: `windowDays` uses the plan's calendar span, not days-with-meals — understates the floor

**File:** `src/domains/food/food.atoms.ts:268-278` (`windowDays = planDaySpan(selectedPlan)`); consumed at `src/domains/food/costEngine.ts:249-250`
**Issue:**
`computeFloor` computes `dailyAverage = totalScheduledCost / windowDays`, then `floor = dailyAverage × daysInMonth`. The atom sets `windowDays = planDaySpan(selectedPlan)` — the inclusive calendar span between `windowStart` and `windowEnd`.

`scheduledMeals` is `selectedPlan.meals`, which the parser builds from however many meal rows/prose lines exist in the file — there is no guarantee the meal count maps to `windowStart..windowEnd` days. A plan can legitimately have a 7-day window (`2026-05-25--2026-05-31`) but list only the meals actually planned (e.g., a few days). Concretely:

- Window span = 7 days → `windowDays = 7`.
- Meals listed cover only 3 days, totaling, say, $90.
- `dailyAverage = 90 / 7 = $12.86/day` instead of the true `$90 / 3 = $30/day`.
- Monthly floor = `12.86 × 30 = $386` instead of `$900`.

That is a **~57% undercount of the protected floor** — the highest-severity C1 failure class named in the brief. The cost engine's own contract comment (line 116) defines `windowDays` as "distinct days the current plan(s) cover," but the atom feeds it the raw window span, not distinct days covered by meals.

The parser does not retain per-day structure (it flattens all slots into a single `meals[]`), so the atom has no way to recover the true day count from the selected plan. The current code is only correct when the window span exactly equals the number of distinct meal-days — an assumption nothing enforces.

**Fix:** Either (a) divide by the number of distinct *meal-days* the plan actually carries (requires the parser to preserve per-day grouping), or (b) if per-slot counts are unavailable, divide total cost by a conservative *small* denominator so the floor is never understated. The clinically safe direction is to over-, not under-, estimate. Minimum viable fix preserving C1:
```ts
// Until the parser preserves day grouping, never divide by more days than
// can be justified — clamp windowDays to the meal count so per-day cost is
// not diluted below the real daily eating cost.
const windowDays = Math.max(1, Math.min(planDaySpan(selectedPlan), scheduledMeals.length))
```
Better: have `parsePlanFile` carry `mealsPerDay`/distinct-day count so `dailyAverage` reflects real daily intake. The current span-based divisor is an unguarded undercount and must not ship.

## Warnings

### WR-01: `mealDefinitionsAtom` is read without `await` in an async derivation

**File:** `src/domains/food/food.atoms.ts:193`
**Issue:** `const mealDefs = get(mealDefinitionsAtom)` — every other input on lines 192-196 is `await get(...)`, but this one is not. `mealDefinitionsAtom` is an `atomWithObservable` with `initialValue: []`; a bare `get` returns the current observable value (or initial `[]` before the first liveQuery emission). On first read after a cold IDB open, this can be `[]` while the seeded meal definitions have not yet emitted. On the live-plan path, an empty `mealDefs` makes every scheduled meal classify as `undefined-meal` → fallback-HIGH. That is C1-safe (high, not low) but produces a transient wrong "needs-attention" badge and an inflated floor flicker on first paint, and `solvencyFloor` drops to the seed. The inconsistency with the surrounding `await get` calls is also a latent bug if `mealDefinitionsAtom` is ever refactored to a plain async atom. Confirm the initial-`[]`-then-emit ordering is intended, and make the await-style consistent.
**Fix:** Document the deliberate non-await with a comment, or normalize to the observable's settled value. At minimum: `const mealDefs = get(mealDefinitionsAtom)` should carry a comment explaining why it is sync where neighbors await, to prevent a future "fix" that breaks it.

### WR-02: Fire-and-forget write-back has an unhandled rejection and a read-after-write staleness gap

**File:** `src/domains/food/food.atoms.ts:301-306`
**Issue:** `void storage.saveFoodFloorMeta(newMeta).then(() => { /* empty */ })`. The `.then` has no `.catch`; a failed IDB write (quota, blocked upgrade, closed connection from the `versionchange` handler in `db.ts:69`) becomes an unhandled promise rejection. Separately, because the write does not bump `metaRefreshAtom`, the next `foodFloorAtom` read still sees the old `meta` until something else invalidates the atom — so `allTimeHighWater` written here is not observed by the very next recompute (the empty `.then` body's own comment admits "store.set not available in atom body"). The ratchet therefore lags by one invalidation cycle, compounding CR-01.
**Fix:** Add a `.catch` that logs (DEV) and swallows in PROD; and if the high-water must be observed promptly, move the write-back into a proper write atom that bumps `metaRefreshAtom`, or read high-water from a source that reflects the just-written value.

### WR-03: `today` is a hand-rolled local string compared against frontmatter/UTC-derived window dates

**File:** `src/domains/food/food.atoms.ts:199-213` vs `planDaySpan` at `:251-255`
**Issue:** `today` is built from `now.getFullYear/getMonth/getDate` (LOCAL calendar), then compared lexically to `p.windowStart`/`p.windowEnd` from the plan files. `planDaySpan` parses the same window strings with `+ 'T12:00:00Z'` (UTC noon). Mixing a local-calendar `today` with UTC-anchored span math is internally inconsistent: for a user in a negative UTC offset, near midnight the "today" used for the `windowStart <= today <= windowEnd` membership test and the day used for span math can disagree by one day at month/window boundaries. This can flip `planIsCurrent` (stale ↔ live) and shift `windowDays` by 1 at boundaries. Low frequency, but it touches the floor selection.
**Fix:** Pick one reference frame. Since the rest of the app classifies by LOCAL month, compute `planDaySpan` from local-midnight dates too (`new Date(y, m-1, d)`), or compare windows in the same UTC frame as the span math. Document the chosen frame.

### WR-04: `db.ts` v1/v2 `.stores()` index references a `protected` field that the type model does not define

**File:** `src/storage/db.ts:20,34` (`expenseItems: '++id, name, category, protected, cadence'`)
**Issue:** The v1/v2 Dexie schema indexes `category` and `protected` on `expenseItems`, but `ExpenseItem` (schema.ts:25) has neither — it uses the single `classification` enum (D-02). Dexie keeps historical `.version()` declarations for upgrade replay, so these are not the live schema, but indexing fields that never existed on any persisted row is dead/misleading schema history and a trap: anyone reading the ladder may believe a `protected` boolean once existed and write a migration around it. (`migrate_2_to_3` is correctly a no-op, so no live data is affected.)
**Fix:** Add a comment on the v1/v2 `.stores()` lines noting these index columns were aspirational and never populated (tables were empty through Phase 2), so the v3 index change is index-only with no data transform. Leaving them undocumented invites a phantom-field migration bug later.

### WR-05: `replaceAll` import path validates expense/fund finiteness but not meal-definition / unit-cost / portion / floor-meta values

**File:** `src/storage/storage.ts:557-612`
**Issue:** Import (`replaceAll`) re-validates `expenseItems.amount` and `sinkingFunds.annualAmount/monthlyAccrual` against `Number.isFinite` (T-03-01 tampering mitigation). But settings rows are written verbatim (`db.settings.put({ key, value })`, line 573) with no validation, and `mealDefinitions` rows are added without validating `flatCost`/`ingredients`. A tampered or corrupted backup can inject a `foodFloorMeta` with `allTimeHighWater: NaN` or a `unitCostMap` entry with `costPerUnit: NaN` straight into IndexedDB, bypassing the `saveUnitCostMap`/`saveFoodFloorMeta` guards that exist on the normal write path. Downstream, `Math.max(meta.allTimeHighWater, ...)` with `NaN` poisons the high-water permanently (NaN propagates), and an `NaN` cost silently corrupts the floor. This is the same class of defect the expense/fund guards were added to prevent, but the C1-critical food settings were left unguarded on the import path.
**Fix:** Validate food-domain financial fields during `replaceAll` (or route settings through the typed `save*` functions, which already guard). At minimum reject non-finite `costPerUnit`, `portionSize`, `flatCost`, `lastComputedFloor`, `allTimeHighWater`, and `flavorLine.amount` with `INVALID_ENVELOPE`.

### WR-06: `extractFrontmatter` strips inline `#` and can truncate quoted values containing `#`

**File:** `src/domains/food/planParser.ts:98`
**Issue:** The per-line frontmatter regex `^(\w[\w_]*):\s*"?([^"#\r\n]*?)"?\s*$` excludes `#` from the value class to drop trailing comments. But dates are the only consumers and they pass through `DATE_RE` validation, so a `#` in a value yields a value that fails `DATE_RE` and falls through to filename fallback — acceptable. The real risk is the regex's `"?...?"` optional-quote handling combined with `[^"#...]`: a value like `"2026-05-25" # note` parses to `2026-05-25` correctly, but the loop also writes non-date keys (e.g., `plan_version`) that are never used. Mostly harmless but the parser silently ignores malformed frontmatter and falls to filename, which can pick up a stale window from a misnamed file without surfacing the discrepancy.
**Fix:** No correctness fix required for the date path, but add a test asserting frontmatter-vs-filename disagreement resolves to frontmatter (the `?? extractWindowFromFilename` order already prefers frontmatter — keep it and test it). Lower priority.

## Info

### IN-01: Duplicated comment block in `db.ts`

**File:** `src/storage/db.ts:26-31`
**Issue:** The v2 explanatory comment ("field-only addition ... A2") is pasted twice (lines 26-28 and 29-31). Harmless but sloppy.
**Fix:** Delete the duplicate three lines.

### IN-02: `FALLBACK_CEILING_PER_MEAL` deprecated alias retained

**File:** `src/domains/food/costEngine.ts:52`
**Issue:** The back-compat alias is still exported and still referenced by the test suite (`costEngine.test.ts:164,186,208`). Tests asserting fallback behavior should migrate to `FALLBACK_CEILING_MEAL` so the alias can be removed; keeping deprecated symbols alive via tests defeats the deprecation.
**Fix:** Update tests to `FALLBACK_CEILING_MEAL`, then remove the alias in a later phase.

### IN-03: `FoodPage`/`FoodConfigPage` defensive `typeof === 'object'` shims around resolved atom values

**File:** `src/pages/FoodPage.tsx:237-248`, `src/pages/FoodConfigPage.tsx:681-686`
**Issue:** `useAtomValue` on an async atom returns the resolved value after Suspense, never a Promise — these `typeof foodFloor === 'object' && 'floor' in foodFloor` guards with literal `550`/`{}` fallbacks are defensive cruft that can mask a real type regression (e.g., if the atom shape changes, the page silently renders `550` instead of failing a test). The fallback `550` also duplicates `DEFAULT_FOOD_FLOOR_SEED` as a magic number in the UI layer.
**Fix:** Trust the typed atom value (the page is already inside a Suspense boundary per the atom design), or, if defensiveness is desired, import `DEFAULT_FOOD_FLOOR_SEED` rather than re-literal `550`.

### IN-04: Magic number `550` appears in three places without a shared constant

**File:** `src/storage/schema.ts:14` (`foodSeed: 550`), `src/domains/food/food.atoms.ts:65` (`DEFAULT_FOOD_FLOOR_SEED = 550`), `src/pages/FoodPage.tsx:240` / `FoodConfigPage.tsx:686` (literal `550`/`0`), `FoodConfigPage.tsx:386` copy "$550/mo"
**Issue:** The provisional food seed is duplicated as a literal across schema, atom, and UI. Drift risk if §12 changes.
**Fix:** Export one `DEFAULT_FOOD_FLOOR_SEED` and reference it everywhere (including the displayed copy string, interpolated).

### IN-05: `vite.config.ts` `server.fs.allow: ['..']` widens dev-server file access

**File:** `vite.config.ts:17-19`
**Issue:** Allowing the dev server to serve the parent workspace directory is required for the `import.meta.glob` SMC plan loader, and is dev-only (build bundles at compile time). Not a C2 violation (no credentials are served), but it does expose the entire sibling workspace over the local dev server while running. Worth a one-line note that this must stay scoped to `..` (already is) and never broaden to absolute roots.
**Fix:** Keep as-is; add a comment confirming the scope is intentional and minimal (the existing comment covers the rationale; add the security note).

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
