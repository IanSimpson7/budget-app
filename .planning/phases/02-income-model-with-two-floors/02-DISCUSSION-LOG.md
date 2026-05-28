# Phase 2: Income Model with Two Floors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 2-Income-Model-with-Two-Floors
**Areas discussed:** Paste-parse scope & format, Month projection method, 3rd-check surplus rule, Dashboard income visualization (+ emergent: income categorization / two-floor split, credit-card architecture, tax foundation)

---

## Paste-parse scope & format (INC-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Income-only parser | Build a parser hardwired to income/checking | |
| Generic statement parser with `statementType` seam | Pipeline generalizes to credit-card/itemized in Phase 3; checking adapter built + proven now | ✓ |

**User's choice:** Generic parser; must work for both checking (income, now) and credit-card/itemized (Phase 3). Income source = checking only.
**Notes:** Ian provided two real statement samples. Format is **block-based** (date-delimited multi-line blocks), tab-delimited, header row present, **signed comma amounts**, trailing pair = (amount, balance). Credit/debit is deterministic from the amount sign (balance-delta as fallback). Key insight from the full sample: only 2 of 6 deposits were income (PAYROLL); a `VANGUARD SELL` $3,000 asset-sale deposit and card cashback would corrupt the floor math if auto-counted — hence conservative auto-check (PAYROLL/known-source only) + always-visible confirm step. Remember-known-sources feature folded in.

## Month projection method (INC-04, INC-06)

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Conservative `passive/2` | Estimate unlanded checks at half the passive floor; alert fires aggressively | |
| (b) Most recent actual payroll check | Realistic basis; tracks the season | ✓ |
| (c) Manual expected-next-check | Ian types the expectation each month | |

**User's choice:** (b), refined to most recent actual **payroll** check. `projectedMonth = sum(payroll landed) + max(0, 2 − landedPayrollCount) × lastPayrollCheck`.
**Notes:** Sharpened to payroll-only after the income-categorization decision (defended line is payroll-specific). Real test: May = $1,127.51 + $1,296.59 = $2,424.10 → below $3,000 → backfill alert must fire.

## 3rd-check surplus rule (INC-04, EDGE-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic + per-check override | 3rd payroll check/month auto-flagged surplus, manual override available | ✓ |
| Fully manual | User tags each check's surplus status | |

**User's choice:** Automatic + override. Applies to **payroll checks only** (gift income isn't on a biweekly cadence). Keyed on the check's `date` calendar month.

## Dashboard income visualization (INC-05, UI-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal bar + ghost projection + two floor markers | Solvency band at passive floor, marker tick at defended line, ghost segment to projected | ✓ |
| Number-cards-primary | Numbers first, no bar | |

**User's choice:** Horizontal bar. Backfill alert **replaces** the surplus card when payroll-projection < defended line (pre-mirrors Phase 5 SURP-07).

## Income categorization & two-floor split (emergent — INC-02/03/05/06)

**User's choice:** `IncomeCheck` gets `category (payroll|gift|other)` + `taxable` flag. Venmo deposits = gift from parents, non-taxable, counted as a separate set.
**Notes:** Determinative correctness catch — the two floors consume different income subsets: **defended/backfill = payroll only**, **passive/solvency/surplus = total income**. Per spec §3b ("$3,000/mo net from the primary job"). Gift money must not suppress the backfill signal.

---

## Claude's Discretion

- Reactive dashboard wiring (`atomWithObservable + liveQuery`, ban lifted in Phase 2 per CLAUDE.md).
- `/dashboard` + `/entry` routes on existing HashRouter.
- Confirm-table UX details, date-parser tolerance, source-matching strategy (exact vs. normalized).

## Deferred Ideas

- **Phase 3:** credit-card/itemized parser adapter; checking↔card reconciliation (card payoff = transfer, not expense — double-counting trap); `Account` enum `credit` type; account-balance wiring (balance parsed to `note` for now).
- **Phase 5:** independence indicator (payroll alone covers floor → non-dependent on parental gift); route gift-derived surplus to investing via the surplus router.
- **v2 backlog:** estimated-tax-payment feature `TAX-01` (Phase 2 provides only the `taxable` flag + YTD taxable sum foundation).
