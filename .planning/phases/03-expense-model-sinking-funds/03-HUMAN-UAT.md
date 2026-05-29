---
status: passed
phase: 03-expense-model-sinking-funds
source: [03-VERIFICATION.md]
started: 2026-05-29T13:05:00-04:00
updated: 2026-05-29T14:30:00-04:00
---

## Current Test

[all tests passed — Ian confirmed full walkthrough 2026-05-29]

## Tests

### 1. Expense categorization renders correctly
expected: Navigate to /expenses, add "Rent" $1,200 monthly Protected and "Gym" $50 monthly Gateable. Rent appears under Protected column, Gym under Gateable, both render immediately without reload.
result: pass

### 2. Survival floor recomputes on dashboard after adding an expense
expected: After adding Rent $1,200/mo Protected, /dashboard "Survival floor" MetricCard shows a value including $1,200 plus foodSeed floor (≥ ~$1,750 at default $550 seed).
result: pass

### 3. Sinking fund card shows progress and on-track status
expected: On /funds add "Car Insurance" $982 annual, $82/mo accrual, $0 balance, payout 12 months out. FundCard renders name, $982 target, $82/mo accrual, $0 balance, on-track indicator; dashboard survival floor increases by ~$82.
result: pass

### 4. Mark-paid advances payout date and resets balance
expected: Click "Mark paid" on the car insurance fund and confirm. Balance resets to $0, payout date advances 12 months, NO new expense line appears in /expenses.
result: pass

### 5. Second sinking fund adds without code change
expected: Add a second fund "Car Purchase" $5,000 annual, $417/mo. Both fund cards render independently; total survival floor includes both accruals (~$82 + ~$417 = ~$499).
result: pass

### 6. EXP-07 advisory is soft (non-blocking)
expected: Type "whey protein" in the expense Name field on /expenses. Advisory text appears below the field; "Add expense" button stays ENABLED; submitting works.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
