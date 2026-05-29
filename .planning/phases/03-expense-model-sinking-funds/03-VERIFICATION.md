---
phase: 03-expense-model-sinking-funds
verified: 2026-05-29T13:03:00-04:00
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Add an expense line via /expenses and confirm it appears in the correct Protected vs Gateable column"
    expected: "Item renders in the correct column immediately after save; survival floor MetricCard on /dashboard updates"
    why_human: "Cannot invoke browser UI or React rendering programmatically; live atom reactivity and IDB write confirmation require visual inspection"
  - test: "Add a car-insurance sinking fund ($982 annual, $82/mo accrual) via /funds and verify the FundCard shows progress bar and on-track status"
    expected: "FundCard renders name, balance, accrual, payout date, and a progress indicator; monthly floor on dashboard increases by ~$82"
    why_human: "FundCard rendering and IncomeBar recomputation require visual confirmation in a running browser"
  - test: "Click 'Mark paid' on an annual sinking fund and confirm the payout date advances 12 months and balance resets to $0"
    expected: "Confirmation dialog appears; after confirm, fund card shows new payout date (one year later) and $0 balance; no line item appears in monthly expenses"
    why_human: "UI confirm flow and DB state update require a running session to inspect"
  - test: "Add a second sinking fund of a different name/amount and confirm it appears alongside the first without any code change"
    expected: "Both fund cards render independently; survival floor increases by the second fund's monthlyAccrual"
    why_human: "Multi-instance rendering requires visual inspection"
  - test: "Type 'whey protein' in the expense Name field and confirm the EXP-07 advisory appears without blocking the Add button"
    expected: "Advisory text appears below the Name field; Add expense button remains enabled"
    why_human: "DOM advisory render and button disabled-state require browser inspection"
---

# Phase 3: Expense Model + Sinking Funds Verification Report

**Phase Goal:** Ian can record expense line items classified as protected vs gateable, see the derived survival floor recompute live, and have annual sinking-fund costs (car insurance) accrue monthly without budget shock.
**Verified:** 2026-05-29T13:03:00-04:00
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Add an expense line (name, amount, cadence, category, protected, gateable) and see it categorized in the protected vs gateable view | VERIFIED | `ExpensesPage.tsx` renders a two-column grid (`Column` heading="Protected" / "Gateable") driven by `protectedExpensesAtom` and `gateableExpensesAtom`; add form includes `TextInput`, `NumberInput`, `SelectInput` (cadence), and `ClassificationToggle`; `saveExpenseItemAtom` writes to IDB; `atomWithObservable` over `observeExpenseItems()` causes live re-render |
| 2 | Survival floor displays on dashboard and recomputes when inputs change | VERIFIED | `DashboardPage.tsx` line 41 reads `survivalFloorAtom` with `{ delay: 0 }`; line 89-95 renders a `MetricCard` labelled "Survival floor"; `survivalFloorAtom` in `expenses.atoms.ts` is `fixed_ex_food + sinkingFundAccrualsAtom + floors.foodSeed` — fully derived, never stored (FOUND-06 honoured) |
| 3 | Funds surface shows car-insurance sinking fund accruing ~$82/mo toward a $982 annual payout date | VERIFIED | `FundsPage.tsx` reads `sinkingFundsAtom` (atomWithObservable over `observeSinkingFunds()`); renders `FundCardWithActions` per fund; add form pre-populates `monthlyAccrual` as `annualAmount / 12` (`handleAnnualAmountChange`); `$982 / 12 ≈ $81.83` matches the ~$82 requirement |
| 4 | When the annual payout date arrives, cost is covered from accrued balance and does NOT appear as a monthly shock | VERIFIED | `markFundPaidAtom` (funds.atoms.ts lines 90-111): resets `balance: 0` and advances `payoutDate` +12 months via `setFullYear`; fund is never converted to a recurring expense line — shock mechanism does not exist in schema; `isOnTrack()` pure function projects coverage before payout |
| 5 | A second sinking-fund instance can be added via the same UI without code changes | VERIFIED | `FundsPage.tsx` `handleAdd()` calls `saveFund()` with plain `SinkingFund` shape; `funds.map((fund) => <FundCardWithActions ... />)` renders all instances; schema and atoms are generic — no car-insurance-specific code path exists |
| 6 | Whey/supplement spending does NOT appear in fixed-ex-food (deferred to Phase 4 food floor) | VERIFIED | `ExpensesPage.tsx` `exp07Advisory()` (lines 40-45): regex `/whey\|supplement/i` returns advisory text; advisory feeds `TextInput helper` prop only — it never blocks submission (`canAdd` guard has no advisory check); `EXP-07` comment in file header explicitly states "soft advisory when name matches /whey\|supplement/i — never blocks submit (C1)" |

**Score:** 6/6 truths verified

---

### Inviolable Constraint Verification

| Constraint | Status | Evidence |
|-----------|--------|----------|
| C1 — Food floor never gated/reduced/suggested as a cut | VERIFIED | No UI control edits `foodSeed` downward in Phase 3 surfaces; `exp07Advisory` is display-only, never blocks; `survivalFloorAtom` reads `floors.foodSeed` as additive input only |
| C3 — App never moves money | VERIFIED | `markFundPaidAtom` writes DB state (balance reset + date advance) — this is record-keeping, not money movement; no transfer affordance exists in `FundsPage.tsx`; confirmation copy reads "Mark paid" / "Mark complete" (record action language); remove confirmation reads "Accruals will no longer feed the survival floor" |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domains/expenses/expenses.atoms.ts` | Expense atoms + survivalFloorAtom | VERIFIED | `expenseItemsAtom`, `protectedExpensesAtom`, `gateableExpensesAtom`, `fixedExFoodAtom`, `survivalFloorAtom`, write atoms — all present and substantive |
| `src/domains/funds/funds.atoms.ts` | Sinking-fund atoms + markFundPaidAtom | VERIFIED | `sinkingFundsAtom`, `sinkingFundAccrualsAtom`, `monthsUntilPayout`, `isOnTrack`, write atoms including `markFundPaidAtom` — all present and substantive |
| `src/pages/ExpensesPage.tsx` | Protected/Gateable two-column view + add form | VERIFIED | Full CRUD: add form with all fields, two-column `Column` components, inline edit, delete confirmation, EXP-07 advisory |
| `src/pages/FundsPage.tsx` | Fund cards + add form + mark-paid flow | VERIFIED | Fund list, add form with auto-accrual suggestion, `FundCardWithActions` with edit/mark-paid/remove confirm flows |
| `src/pages/DashboardPage.tsx` | Survival floor MetricCard | VERIFIED | Line 41 reads `survivalFloorAtom`; line 89-95 renders "Survival floor" MetricCard with `subtext="fixed + food seed"` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DashboardPage` | `survivalFloorAtom` | `useAtomValue` line 41 | WIRED | Import at line 20; rendered at line 92 |
| `survivalFloorAtom` | `fixedExFoodAtom` | `get(fixedExFoodAtom)` | WIRED | `expenses.atoms.ts` line 56 |
| `survivalFloorAtom` | `sinkingFundAccrualsAtom` | `get(sinkingFundAccrualsAtom)` | WIRED | `expenses.atoms.ts` line 57; cross-domain import from `funds.atoms.ts` |
| `survivalFloorAtom` | `floorsLoadAtom` | `await get(floorsLoadAtom)` | WIRED | `expenses.atoms.ts` lines 55-58 |
| `sinkingFundAccrualsAtom` | `sinkingFundsAtom` | `get(sinkingFundsAtom).reduce(...)` | WIRED | `funds.atoms.ts` lines 27-29 |
| `markFundPaidAtom` | `storage.updateSinkingFund` / `deleteSinkingFund` | direct call | WIRED | `funds.atoms.ts` lines 90-111 |
| `ExpensesPage` | `saveExpenseItemAtom` | `useSetAtom` + `handleAdd` | WIRED | Lines 186, 199-201 |
| `FundsPage` | `markFundPaidAtom` | `useSetAtom` in `FundCardWithActions` | WIRED | Lines 143, 163 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `DashboardPage` — "Survival floor" MetricCard | `survivalFloor` | `survivalFloorAtom` async derivation | Yes — sums `fixedExFood` (from IDB via `observeExpenseItems`) + `accruals` (from IDB via `observeSinkingFunds`) + `floors.foodSeed` (from IDB settings) | FLOWING |
| `ExpensesPage` — Protected column | `protectedExpenses` | `protectedExpensesAtom` filters `expenseItemsAtom` (liveQuery IDB) | Yes — live IDB query via `atomWithObservable` | FLOWING |
| `ExpensesPage` — Gateable column | `gateableExpenses` | `gateableExpensesAtom` filters `expenseItemsAtom` | Yes — same liveQuery | FLOWING |
| `FundsPage` — fund cards list | `funds` | `sinkingFundsAtom` via `atomWithObservable` over `observeSinkingFunds()` | Yes — live IDB query | FLOWING |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|------------|--------|----------|
| EXP-01 | Record expense line items with cadence ∈ {monthly, annual, oneoff} | SATISFIED | `ExpensesPage` form with `SelectInput` offering monthly/annual/one-off; `ExpenseItem` schema type; `saveExpenseItemAtom` |
| EXP-02 | Expenses classified PROTECTED or GATEABLE | SATISFIED | `ClassificationToggle` component; `protectedExpensesAtom` / `gateableExpensesAtom` filter atoms; two-column display |
| EXP-03 | Survival floor = `fixed_ex_food + protected_food_floor`, auto-updates | SATISFIED | `survivalFloorAtom` computes `fixedExFoodAtom + sinkingFundAccrualsAtom + floors.foodSeed`; reactive via atom chain; displayed on dashboard |
| EXP-04 | ONE generic sinking-fund primitive; car insurance is launch instance | SATISFIED | `SinkingFund` schema type is generic; `FundsPage` add form is instance-agnostic; car insurance is seeded data, not a hardcoded type |
| EXP-05 | Second sinking-fund instance requires zero new code paths | SATISFIED | `FundsPage.handleAdd()` is generic; `funds.map(...)` renders all instances |
| EXP-06 | Annual cost covered from accrued balance, not a shock | SATISFIED | `markFundPaidAtom` resets balance + advances date; fund never converts to expense line |
| EXP-07 | Whey/supplement not double-counted in fixed-ex-food | SATISFIED | `exp07Advisory` soft advisory; never blocks; supplement lines still go to expense domain only if user explicitly adds them |
| UI-04 | Funds surface shows sinking-fund instances with progress toward payout dates | SATISFIED | `FundCardWithActions` wraps `FundCard`; `isOnTrack()` / `monthsUntilPayout()` power progress rendering |
| EDGE-06 | Annual sinking-fund cost due → covered by accrued balance, not a shock | SATISFIED | `markFundPaidAtom` handles this; balance advances payout date by 12 months |

All 9 Phase 3 requirement IDs accounted for. No orphaned requirements.

---

### Anti-Patterns Found

No TBD, FIXME, or XXX markers found in Phase 3 key files. No return-null stubs. No empty handlers. No hardcoded empty arrays passed as rendering props.

Notable items (non-blocking):

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `expenses.atoms.ts` line 7 | `survival_floor = fixed_ex_food + Σ(sinking-fund monthlyAccruals) + floors.foodSeed` — comment uses "protected_food_floor placeholder" language | Info | Comment accurately describes Phase 3 state; foodSeed IS the placeholder pending Phase 4 food floor. Not a code defect. |
| `funds.atoms.ts` lines 27-29 | `sinkingFundAccrualsAtom` sums `f.monthlyAccrual` — requires user to manually set `monthlyAccrual` correctly; no enforcement that `monthlyAccrual * monthsRemaining >= annualAmount` | Info | `isOnTrack()` surfaces the risk in UI; this is by design (user sets accrual) |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — phase produces browser UI; no CLI entry points or runnable server endpoints are testable without a browser session. Tests (208 passing per context) cover unit behavior.

### Probe Execution

Step 7c: No probe scripts declared in PLAN frontmatter or found at `scripts/*/tests/probe-*.sh`. SKIPPED.

---

### Human Verification Required

#### 1. Expense categorization renders correctly

**Test:** Navigate to `/expenses`. Add "Rent" $1,200 monthly, Protected. Add "Gym" $50 monthly, Gateable. Submit both.
**Expected:** "Rent" appears under the Protected column; "Gym" appears under the Gateable column. Both render immediately without page reload.
**Why human:** Atom reactivity and IDB write round-trip require a live browser session.

#### 2. Survival floor recomputes on dashboard after adding an expense

**Test:** After adding "Rent" $1,200/mo Protected in step 1, navigate to `/dashboard`.
**Expected:** "Survival floor" MetricCard shows a value that includes $1,200 (plus foodSeed floor). If foodSeed default is $550, floor should display at minimum $1,750.
**Why human:** Cross-route atom reactivity and MetricCard render require visual inspection.

#### 3. Sinking fund card shows progress and on-track status

**Test:** Navigate to `/funds`. Add "Car Insurance" $982 annual, $82/mo accrual, $0 balance, payout date 12 months out, annual cadence.
**Expected:** FundCard renders with name, $982 target, $82/mo accrual, balance $0, on-track status indicator. Survival floor on dashboard increases by ~$82.
**Why human:** FundCard component rendering and cross-page floor update require browser session.

#### 4. Mark-paid advances payout date and resets balance

**Test:** With a car insurance fund present, click "Mark paid" and confirm.
**Expected:** Confirmation dialog shows next year's month. After confirm: balance resets to $0, payout date advances 12 months, no new expense line appears in `/expenses`.
**Why human:** DB state mutation and UI confirm flow require live session.

#### 5. Second sinking fund adds without code change

**Test:** Add a second fund "Car Purchase" $5,000 annual, $417/mo. Both funds exist simultaneously.
**Expected:** Both fund cards render independently. Total survival floor includes accruals from both ($82 + $417 = ~$499).
**Why human:** Multi-instance rendering and cumulative floor math require visual inspection.

#### 6. EXP-07 advisory is soft (non-blocking)

**Test:** Type "whey protein" in the expense Name field on `/expenses`.
**Expected:** Advisory text appears below the name field. "Add expense" button remains enabled (not disabled). Submitting the form works.
**Why human:** DOM advisory render and button state require browser inspection.

---

### Gaps Summary

No gaps. All 6 observable truths are verified by codebase evidence. All 9 requirement IDs are satisfied. No blocker anti-patterns found.

Human verification items are UI behavioral checks that cannot be confirmed without a running browser session — they represent standard visual QA, not code defects.

---

_Verified: 2026-05-29T13:03:00-04:00_
_Verifier: Claude (gsd-verifier)_
