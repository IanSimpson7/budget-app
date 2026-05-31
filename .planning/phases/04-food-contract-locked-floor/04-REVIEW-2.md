---
phase: 04-food-contract-locked-floor
reviewed: 2026-05-30T20:20:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/domains/food/food.atoms.ts
  - src/domains/food/planParser.ts
  - src/domains/food/costEngine.ts
  - src/storage/storage.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 4: Code Review Report (RE-REVIEW — gap-closure plan 04-07)

**Reviewed:** 2026-05-30
**Depth:** standard (re-review of 4 fixed findings from 04-REVIEW.md)
**Files Reviewed:** 4
**Status:** issues_found (one partially-closed finding; no blockers)

## Summary

Re-review of the four findings closed by gap-closure plan 04-07 (CR-01, CR-02, WR-05, WR-02 from the prior deep review). All four prior findings are **genuinely resolved**, and the fixes are mutually reinforcing (the WR-05 import guard protects the CR-01 ratchet input from NaN-poisoning). The full food + storage test suite passes (167/167). No new blocker-class defect was introduced.

Verification of each prior finding:

- **CR-01 (C1) — CLOSED.** `food.atoms.ts:342` clamps the displayed live floor: `displayedFloor = Math.max(result.floor, meta.allTimeHighWater ?? 0)`. This line sits after the `planIsCurrent` branch and outside the `result.isClean` block, so the ratchet applies on **both** clean-live and gapped-live paths (verified by control-flow trace). The write-back at `:316` uses the RAW `result.floor` (`Math.max(meta.allTimeHighWater, result.floor)`), NOT `displayedFloor` — so the ratchet cannot feed itself and inflate. `solvencyFloor` (`:300-306`) is NOT ratcheted; it stays realistic. The stale path (`:223-247`) is untouched and still returns `max(last, highWater)`/seed.

- **CR-02 (C1) — CLOSED.** `ParsedPlan.mealDays` is computed for both batch formats via `DAY_SECTION_GLOBAL_RE = /^##\s+(?:\w+\s+)?(\d{4}-\d{2}-\d{2})/gm`, which matches `## Monday 2026-05-25` (table batch) and `## 2026-05-29 (Friday)` (prose batch). I traced the regex against both header shapes and confirmed the optional `(?:\w+\s+)?` group cannot consume part of the date (it requires trailing `\s+`, but a date is followed by `-`). `food.atoms.ts:284` uses `Math.max(selectedPlan.mealDays, 1)`. Single-date files yield `mealDays=1` (`:282`). Against the live SMC fixtures: `2026-05-25--2026-05-28.md` → mealDays=4 (matches 4-day span); `2026-05-29--2026-05-31.md` → mealDays=3 (matches 3-day span). The `## Prep this batch` preamble (no date, `- bullet` list) is correctly excluded from both day-counting and meal extraction. **C1 UNDERSTATE check:** `mealDays` is bounded above by the count of distinct dated section headers that contain a meal — it can never exceed the calendar span, and any format the regex misses falls back to `1` (overstates the floor, C1-safe). The gap-day case (`mealDays < span`) is tested at `planParser.test.ts:341`. No path understates.

- **WR-05 (C1) — CLOSED for the four required fields.** `validateFoodSettingsForImport` (`storage.ts:579-624`) rejects non-finite `foodFloorMeta.lastComputedFloor`/`allTimeHighWater`, `unitCostMap[].costPerUnit`, and `portionModel[].portionSize` via `isFiniteNumber` (which correctly rejects `null` — the JSON serialization of NaN/Infinity — and string types). It is invoked at `:633`, BEFORE `db.transaction` opens at `:635`, so a rejected import leaves the DB completely untouched (transaction integrity confirmed). This also closes the NaN-poison feedback into CR-01's ratchet: a tampered `allTimeHighWater: NaN` is now rejected at import, so `Math.max(result.floor, allTimeHighWater)` can never produce NaN.

- **WR-02 — CLOSED.** The fire-and-forget write-back (`:329`) now has `.catch` (DEV-logs, swallows in PROD) — no unhandled rejection. The documented one-cycle lag is genuinely absorbed by the CR-01 ratchet: during the lag the next read sees the OLD `meta.allTimeHighWater`, and `displayedFloor = Math.max(result.floor, oldHighWater)`. Because `result.floor` is deterministic for identical inputs and the written value was `Math.max(oldHighWater, result.floor)`, the displayed value during the lag equals the post-write value — no visual drop. The correctness argument in the code comment (`:323-328`) is sound.

Regression checks all pass: no `localStorage`/`sessionStorage` in any reviewed file; `food.atoms.ts` imports `storage` only (no `db`/`liveQuery`); no downward-floor-edit affordance (`setFoodFloor`/`decreaseFoodFloor` structurally absent, proven by `storage.test.ts:39-52`); `solvencyFloor` 04-06 semantics intact (clean→`result.floor`; gapped→`max(last,highWater,seed)`; stale→`floor`).

## Warnings

### WR-01: WR-05 import validation omits `flatCost` and `flavorLine.amount` — NaN can still poison the floor via import

**File:** `src/storage/storage.ts:579-624` (validation), `src/storage/storage.ts:648-686` (`replaceAll` settings/meal writes), consumed at `src/domains/food/costEngine.ts:206`
**Issue:**
The closed scope of WR-05 covers `costPerUnit`, `portionSize`, `lastComputedFloor`, and `allTimeHighWater` — the four fields the re-review brief required. But the ORIGINAL WR-05 fix recommendation in 04-REVIEW.md explicitly also named `flatCost` and `flavorLine.amount`, and those two remain unguarded on the import path:

1. **`mealDefinitions[].flatCost`** — `replaceAll` writes meal-definition rows verbatim (`:681-686`) with no finiteness check. A tampered/corrupted backup with `flatCost: <NaN-equivalent>` flows into `computeFloor` at `costEngine.ts:200-206`: `def.flatCost === undefined || === null` is false for a numeric-typed NaN, so it takes the `else` branch `totalScheduledCost += def.flatCost` → `totalScheduledCost` becomes NaN → `floor` becomes NaN. A NaN floor then propagates into the CR-01 ratchet and the clean-path write-back (`allTimeHighWater = Math.max(prev, NaN)` = NaN), permanently poisoning the high-water. Note: JSON cannot serialize a literal `NaN`, but a backup hand-edited or produced by a buggy exporter could contain it after parse via other vectors; the existing expense/fund/unitCost guards exist precisely because verbatim trust of a backup is the threat model (T-03-01).

2. **`settings.flavorLine.amount`** — written verbatim at `:648-649` (the generic settings loop) with no validation. The normal write path `saveFlavorLine` (`:278-282`) guards it with `Number.isFinite`; the import path bypasses that guard. A NaN `flavorLine.amount` corrupts the protected flavor line (a C1-adjacent protected value).

This is the same defect class WR-05 was opened to fix — the import path bypassing a `save*` guard. The fix closed the floor-meta/cost/portion fields but left two protected-value fields on the same unguarded path.
**Fix:** Extend `validateFoodSettingsForImport` to also reject non-finite `flavorLine.amount`, and add a `flatCost` finiteness check in the `mealDefinitions` import loop (mirroring the expense/fund guards at `:660-678`):
```ts
// in validateFoodSettingsForImport, after the portionModel block:
const rawFlavor = settings['flavorLine']
if (rawFlavor !== undefined && isPlainObject(rawFlavor)) {
  const f = rawFlavor as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(f, 'amount') && !isFiniteNumber(f['amount'])) {
    throw new ImportError('INVALID_ENVELOPE')
  }
}
```
```ts
// in replaceAll, inside the mealDefinitions loop (:682):
for (const raw of data.mealDefinitions as MealDefinition[]) {
  if (raw.flatCost !== undefined && raw.flatCost !== null && !Number.isFinite(raw.flatCost)) {
    throw new ImportError('INVALID_ENVELOPE')
  }
  const { id: _id, ...rest } = raw
  await db.mealDefinitions.add(rest as MealDefinition)
}
```
(The `flatCost` check must run inside the transaction's loop like the other meal-row handling, OR add a `data.mealDefinitions` scan to `validateFoodSettingsForImport` for the pre-transaction no-partial-write guarantee. The expense/fund guards already throw inside the transaction and rely on abort-on-throw, so an in-loop check is consistent with the existing pattern.)

## Info

### IN-01: `meta.allTimeHighWater ?? 0` nullish guard is dead on a non-optional field

**File:** `src/domains/food/food.atoms.ts:342` (and `:304`)
**Issue:** `FoodFloorMeta.allTimeHighWater` is typed `number` (non-optional, `food.types.ts:71`), and `getFoodFloorMeta` always returns a fully-populated default (`storage.ts:221-225, 262-265`). The `?? 0` on `:342` and `:304` can therefore never fire under the type contract — it is defensive cruft. Harmless and arguably prudent against a malformed import, but now that WR-05 guards the import path for these exact fields, the nullish branch is provably unreachable. Not worth changing on its own; flagging only so a future reader does not infer the field is optional and relax the type.
**Fix:** Optional. Leave as defensive, or drop the `?? 0` to let the type contract speak. No action required.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (re-review)_
