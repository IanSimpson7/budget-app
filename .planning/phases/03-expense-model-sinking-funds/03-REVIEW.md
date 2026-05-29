---
phase: 03-expense-model-sinking-funds
reviewed: 2026-05-29T16:58:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/components/ClassificationToggle.tsx
  - src/components/FundCard.tsx
  - src/components/SelectInput.tsx
  - src/components/TextInput.tsx
  - src/domains/expenses/expenses.atoms.ts
  - src/domains/funds/funds.atoms.ts
  - src/main.tsx
  - src/pages/DashboardPage.tsx
  - src/pages/ExpensesPage.tsx
  - src/pages/FundsPage.tsx
  - src/storage/db.ts
  - src/storage/migrations.ts
  - src/storage/schema.ts
  - src/storage/storage.ts
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-29T16:58:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase 3 expense-model + sinking-fund implementation against the standard checklist and the project's inviolable constraints (C1 food-floor protection, C3 no money movement, derived-value freshness, double-counting, date math).

**Constraint verdicts:**
- **C1 (food floor):** PASS. No code path reduces, gates, or suggests cutting the food floor. `survivalFloorAtom` adds `floors.foodSeed` unconditionally; there is no floor-lowering write surface. The EXP-07 supplement advisory is soft text that never blocks submit. Schema `Floors` is `Readonly` and there is no editor for `foodSeed` in the reviewed files.
- **C3 (no money movement):** PASS. `markFundPaidAtom` is a pure DB state update (reset balance / advance date / delete). No transfer, trade, or auto-routing affordance exists. FundCard actions are record-only.
- **Derived-value freshness:** PASS. `survivalFloorAtom`, `fixedExFoodAtom`, `sinkingFundAccrualsAtom` are all derived atoms, never persisted. `balance` is manual per C3.
- **Date math (mark-paid):** PASS. Verified `2027-12 → 2028-12`, `2027-02 → 2028-02`, `2027-03 → 2028-03`. No YYYY-13 overflow (uses `setFullYear` on a day-1 local Date); no leap-year drift because day is pinned to 1.
- **Double-counting:** PASS. `SEED_EXPENSES` deliberately omits car insurance; it seeds only as a sinking fund. There is, however, no runtime guard preventing a user from manually entering car insurance as both an expense line and a fund (see WR-05).

No blockers found. Six warnings concern correctness edge cases and one genuine duplicate test file; six info items concern quality/consistency.

## Warnings

### WR-01: `monthsUntilPayout` returns 0 for overdue funds, silently flipping "Behind" to "On track"

**File:** `src/domains/funds/funds.atoms.ts:45` (and consumed at `isOnTrack` line 53-57)
**Issue:** `monthsUntilPayout` clamps to `Math.max(0, ...)`. Once a fund's `payoutDate` is in the past (e.g. Ian forgets to mark an annual fund paid), `months` becomes 0, so `projected = balance + accrual*0 = balance`. A fund that was "Behind" the day before its due date can read "On track" the day after, purely because the projection horizon collapsed to zero. For an overdue annual fund with a low balance this is the opposite of the truth — the bill is due/overdue and underfunded, but the card shows green "On track" if `balance >= annualAmount` happens to hold, or shows "Behind" only by coincidence. There is no "overdue" state at all.
**Fix:** Distinguish overdue from on-track. Return a signed month delta (or a separate `isOverdue` predicate) and render a third badge state:
```ts
export function monthsUntilPayout(payoutDate: string): number {
  const [py = 0, pm = 1] = payoutDate.split('-').map(Number)
  const now = new Date()
  return (py - now.getFullYear()) * 12 + (pm - (now.getMonth() + 1)) // may be negative
}
// in FundCard: if months < 0 → render "Overdue" badge regardless of projection
```

### WR-02: Duplicate DashboardPage test file in two locations

**File:** `src/pages/DashboardPage.test.tsx:1` and `src/test/DashboardPage.test.tsx:1`
**Issue:** Two distinct DashboardPage test files exist. `src/pages/DashboardPage.test.tsx` (11 lines per diff, the version read here is the 02-04 acceptance suite) and `src/test/DashboardPage.test.tsx` (106 lines per diff). They are not identical, so this is not a copy-paste — but having two suites for one component in two directories will cause confusion about which is authoritative, risks divergent assertions, and doubles maintenance. The colocated `src/pages/DashboardPage.test.tsx` also mocks `survivalFloorAtom` with a hardcoded `2335` that encodes Phase-3 assumptions, while the other file may not.
**Fix:** Consolidate into one location. The project's other Phase-3 tests all live under `src/test/`, so move/merge the colocated suite into `src/test/DashboardPage.test.tsx` and delete `src/pages/DashboardPage.test.tsx`. Reconcile any divergent assertions during the merge.

### WR-03: `handleAnnualAmountChange` clobbers a user-entered monthly accrual

**File:** `src/pages/FundsPage.tsx:217-224`
**Issue:** The comment says "Only auto-fill if user hasn't manually set accrual (or it was auto-derived)" but the code unconditionally overwrites `monthlyAccrual` with `annualAmount/12` on every annual-amount change. If a user enters a custom monthly accrual (e.g. front-loading $150/mo toward a $982 target) and then tweaks the annual target, their custom accrual is silently destroyed. The guard described in the comment is not implemented.
**Fix:** Track whether the accrual was user-edited and respect it:
```ts
const [accrualDirty, setAccrualDirty] = useState(false)
function handleAnnualAmountChange(next: number) {
  setAnnualAmount(next)
  if (!accrualDirty && Number.isFinite(next) && next > 0) {
    setMonthlyAccrual(parseFloat((next / 12).toFixed(2)))
  }
}
// monthly-accrual NumberInput onChange: (v) => { setAccrualDirty(true); setMonthlyAccrual(v) }
```

### WR-04: `setMonthlyAccrual(0)` is rejected by the seed fallback, masking a deliberate zero

**File:** `src/pages/FundsPage.tsx:237`
**Issue:** `monthlyAccrual: Number.isFinite(monthlyAccrual) && monthlyAccrual > 0 ? monthlyAccrual : annualAmount / 12`. If a user intentionally wants a $0/mo accrual (e.g. a fund they will lump-sum later and don't want inflating the survival floor), the `> 0` test overrides it with `annualAmount/12`. Combined with the fact that `monthlyAccrual` feeds `sinkingFundAccrualsAtom → survivalFloorAtom`, this silently raises the survival floor against the user's explicit intent. The add-form `canAdd` gate does not require accrual > 0, so a 0 is reachable but not honored.
**Fix:** Only substitute when the value is non-finite, not when it is a legitimate zero:
```ts
monthlyAccrual: Number.isFinite(monthlyAccrual) ? monthlyAccrual : annualAmount / 12,
```
If a positive accrual is genuinely required, enforce it in `canAdd` instead of silently rewriting at save.

### WR-05: No guard against the same liability existing as both an expense and a sinking fund (double-count risk)

**File:** `src/storage/storage.ts:101-106` (seed) and `src/pages/ExpensesPage.tsx:198`, `src/pages/FundsPage.tsx:232`
**Issue:** The seed sets avoid double-counting car insurance by construction, but nothing at runtime prevents the user from typing "Car insurance" as an annual expense line *and* keeping the car-insurance sinking fund. Both would then feed the survival floor: the expense via `fixedExFoodAtom` (annual/12) and the fund via `sinkingFundAccrualsAtom`. The result is the headline survival-floor number is inflated by roughly the annual liability twice. The CLAUDE.md constraint ("car insurance should appear only as a sinking fund, never also as an expense line") is honored for the seed but not enforced against user input.
**Fix:** This is partly a product decision, but at minimum add a soft advisory (mirroring the EXP-07 pattern) when an expense name fuzzy-matches an existing fund name:
```ts
function fundCollisionAdvisory(name: string, fundNames: string[]): string | undefined {
  if (fundNames.some((f) => f.toLowerCase() === name.trim().toLowerCase()))
    return 'A sinking fund with this name already exists — adding it here too would double-count it in the survival floor.'
  return undefined
}
```

### WR-06: Inline-edit form omits the EXP-07 supplement advisory, defeating its clinical-safety purpose

**File:** `src/pages/ExpensesPage.tsx:64-105` (EditRow) vs `195`/`221` (add form)
**Issue:** The add form surfaces `exp07Advisory(name)` as the Name field's helper text — the soft nudge that supplement/whey costs belong in the food floor. The inline `EditRow` does not wire `exp07Advisory` at all. A user can rename any expense to "whey protein" via edit and never see the advisory, so the safety nudge is bypassable through the edit path. Functionally minor, but it is an inconsistency in a constraint-adjacent feature (C1 posture).
**Fix:** Pass `helper={exp07Advisory(name)}` to the `TextInput` in `EditRow` exactly as the add form does (line 81).

## Info

### IN-01: Dead `survivalFloor === 0` disabled-color branch

**File:** `src/pages/DashboardPage.tsx:94`
**Issue:** `valueColor={survivalFloor === 0 ? 'text-text-disabled' : undefined}`. `survivalFloorAtom` is `fixedExFood + accruals + floors.foodSeed`, and `foodSeed` defaults to 550 (and is structurally non-zero by C1). The floor can therefore never be 0 in practice, so this branch is unreachable dead code.
**Fix:** Remove the conditional, or if a true "no data" state is intended, drive it off `isEmpty`/expense-count rather than a sum that can't reach 0.

### IN-02: Duplicated 5-line comment block in db.ts

**File:** `src/storage/db.ts:24-29`
**Issue:** The v2 explanatory comment ("field-only addition (category, taxable, surplusOverride)... Version MUST advance...") is pasted twice, lines 24-26 and 27-29.
**Fix:** Delete the duplicate lines 27-29.

### IN-03: `formatPayoutDate` / `nextYearPayoutLabel` / `monthsUntilPayout` duplicate YYYY-MM parsing

**File:** `src/components/FundCard.tsx:17-23`, `src/pages/FundsPage.tsx:35-42`, `src/domains/funds/funds.atoms.ts:38-46` and `90-104`
**Issue:** The "split YYYY-MM, default year/month, build local Date" idiom is copy-pasted in four places. Divergence risk if the Pitfall-2 parsing rule ever changes.
**Fix:** Extract a single `parseYearMonth(s): { year: number; month: number }` (and optionally `toLocalDate`) into a shared util in the funds domain and import it everywhere.

### IN-04: `CADENCE_OPTIONS` typed as `string` loses enum safety, forcing `as Cadence` casts

**File:** `src/pages/ExpensesPage.tsx:27-31` / `235`, `src/pages/FundsPage.tsx:29-32` / `123`,`333`
**Issue:** `SelectInput` is `value: string` / `onChange: (next: string)`, so every consumer casts back with `v as Cadence` / `v as SinkingFundCadence`. The cast is unchecked — a typo in an option `value` would compile and write an invalid cadence to IndexedDB, where `toMonthlyEquivalent`'s `else` branch would silently treat it as oneoff (excluded from floor).
**Fix:** Make `SelectInput` generic over its option value type, or validate `e.target.value` against the known union before calling `onChange`.

### IN-05: `seedExpensesIfEmpty` / `seedFundsIfEmpty` use sequential awaited adds where parallel is safe

**File:** `src/storage/storage.ts:117-119`
**Issue:** Per project operating principles (parallelize by default), the seed loop awaits each `db.expenseItems.add` serially. These four inserts are independent. (Note: `addIncomeChecks` documents a deliberate fake-indexeddb constraint reason for sequential adds; the seed loop carries no such justification.)
**Fix:** Low priority. If the fake-indexeddb constraint also applies here, add a comment citing it; otherwise `await Promise.all(SEED_EXPENSES.map((i) => db.expenseItems.add({ ...i })))`.

### IN-06: Fire-and-forget seeds in main.tsx swallow rejections

**File:** `src/main.tsx:11-12`
**Issue:** `void seedExpensesIfEmpty()` / `void seedFundsIfEmpty()` discard the promises. If a seed write rejects (IDB quota, blocked upgrade, private-mode restrictions), the failure is silent — no log, no UI signal — and the app renders with no seeded data and no explanation.
**Fix:** Attach a `.catch` that at least logs:
```ts
seedExpensesIfEmpty().catch((e) => console.error('seedExpensesIfEmpty failed', e))
seedFundsIfEmpty().catch((e) => console.error('seedFundsIfEmpty failed', e))
```

---

_Reviewed: 2026-05-29T16:58:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
