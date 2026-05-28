# Phase 2: Income Model with Two Floors - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

**What this phase delivers:** Income capture (typed + paste-parse) and a phone-readable dashboard that shows month-to-date income against the passive floor (solvency) and the $3,000 defended line (backfill trigger), with a backfill alert when *payroll* projection drops below the defended line, and automatic classification of the 3rd payroll check in a calendar month as surplus. Income is categorized by stream (payroll / gift / other) and taxability, because the two floors consume different income subsets (see D-08).

**In scope (REQ-IDs):** INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08, UI-03, EDGE-01, EDGE-05

**Out of scope (explicit, not just "later"):**
- Expense model, sinking funds, survival floor — Phase 3
- Credit-card / itemized statement *adapter* — Phase 3 (the generic parser **seam** is built in Phase 2; the CC adapter is validated against a real CC sample in Phase 3)
- Checking→card-payoff reconciliation / double-counting handling — Phase 3
- Food floor — Phase 4
- Surplus *routing* (EF-first sweep, investing gift surplus), independence-goal dashboard indicator — Phase 5
- Estimated-tax-payment feature (`TAX-01`) — v2 backlog (Phase 2 lays the data foundation only: `taxable` flag + YTD taxable sum)
- Account-balance tracking / `Account` entity wiring — later (Phase 2 parses balance into `note` only)

</domain>

<decisions>
## Implementation Decisions

### Paste-Parse Pipeline (INC-08, UI-03)

- **D-01:** **Generic statement parser with a `statementType` seam.** Pipeline shape: `raw text → candidate rows → editable confirm table → commit`. Phase 2 builds the **core + checking adapter** (proven against Ian's real statement sample); Phase 3 adds the credit-card/itemized adapter against a real CC sample. Pipeline shell is account/format-agnostic so Phase 3 reuses it without reshaping the model.
- **D-02:** **Block-based parsing, not line-based.** A transaction block begins at a line matching `^\d{2}/\d{2}/\d{4}` (MM/DD/YYYY) and accumulates following lines until the next date-line or EOF. Multi-line descriptions (TYPE:/ID:/CO:/DATA:/NAME:/Card # metadata) belong to the block. Skip a leading header row (`Date  Description  Amount  Balance`).
- **D-03:** **Field extraction.** Within a block, the trailing two comma-formatted decimals = `(netAmount, balanceAfter)`. `date` ← MM/DD/YYYY→ISO. `netAmount` ← first trailing number, commas stripped, signed. `source` ← `CO:` value if present, else first description line (after "ACH Deposit"). `note` ← raw block text (preserves TYPE/ID for audit).
- **D-04:** **Credit vs. debit is deterministic, not guessed.** Primary signal = sign of the `Amount` column. Cross-check / fallback (when sign absent) = sign of `balanceAfter − previousBalanceAfter`. First block in a paste (no prior balance) falls back to "Deposit/Debit" wording.
- **D-05:** **Conservative auto-check in the confirm step — never silently drop.** All rows render in an editable confirm table. Default-checked = credits where `TYPE: PAYROLL` is present OR `source` ∈ known income sources. Default-unchecked = all other credits (cashback, asset sales, Venmo, refunds) AND all debits. Ian ticks/unticks; nothing is committed without his confirmation. **Rationale:** the real statement contained a `VANGUARD SELL` $3,000 asset-sale deposit and card cashback — naively counting all deposits would shatter the floor math and (for the asset sale) violate the spirit of SURP-06.
- **D-06:** **Remember known income sources.** Once Ian confirms a source string (e.g. "GLI EAST LANSING"→payroll/taxable, "VENMO"-from-parents→gift/non-taxable), persist it so future pastes auto-check and auto-categorize matching rows. One-click subsequent pastes.
- **D-07:** **Balance captured to `note`, account wiring deferred.** The trailing balance number is preserved in `note` but NOT wired to an `Account` balance in Phase 2.

### Income Categorization & The Two-Floor Split (INC-02, INC-03, INC-05, INC-06)

- **D-08:** **`IncomeCheck` gains `category: 'payroll' | 'gift' | 'other'` and `taxable: boolean`.** Default taxability derives from category (payroll→taxable, gift→non-taxable, other→taxable) and is editable. Known-source memory (D-06) auto-tags both fields.
- **D-09:** **The two floors consume different income subsets** (correct reading of spec §3b — defended line is "$3,000/mo net *from the primary job*"):
  - **Defended line / backfill alert** → **payroll income only.** Gift money must NOT suppress the backfill signal (a parental gift doesn't reduce the need to backfill training clients).
  - **Passive floor / solvency / surplus** → **total income** (payroll + gift + other). Gift money is real and covers the month.
- **D-10:** **YTD taxable-income figure** is available in the model (sum of `taxable` income year-to-date). Data foundation for the deferred `TAX-01` estimated-tax feature; no tax computation in Phase 2.

### Projection & 3rd-Check Surplus (INC-04, EDGE-05)

- **D-11:** **Projected month total** (drives backfill alert + downstream surplus): `projectedMonth = sum(payroll checks landed this calendar month) + max(0, 2 − landedPayrollCount) × estimatePerCheck`, where **`estimatePerCheck` = the most recent actual payroll check amount** (realistic basis — tracks the season; not the conservative `passive/2` and not manual entry). Expected payroll count fixed at **2/month**.
- **D-12:** **3rd payroll check rule = automatic + per-check override.** The 3rd+ payroll check whose `date` falls in a calendar month is auto-flagged surplus: excluded from the 2-check payroll baseline and from `projectedMonth`, added to the surplus total. A per-check manual override exists for off-pattern months. Classification keyed strictly on the check's `date` (local calendar month) — a check dated June 1 is June even if entered in May. Gift/other income is never part of the 2-check baseline (it isn't on a biweekly cadence).

### Dashboard (INC-05)

- **D-13:** **Horizontal income bar.** One phone-width bar: solid fill = month-to-date actual (total income), a lighter "ghost" segment extending to `projectedMonth`, a shaded **solvency band** up to the passive floor, and a **marker tick** at the $3,000 defended line. The defended-line comparison visually reflects payroll-only projection per D-09.
- **D-14:** **Three `font-mono` number cards** below the bar: month-to-date, projected month, surplus — where the **surplus card is replaced by the backfill alert** when payroll-projection < defended line ("projected $X, below $3,000 — add sessions to defend"). Pre-mirrors the Phase 5 SURP-07 in-place-replacement pattern for consistency.

### Claude's Discretion

- Reactive dashboard wiring: per project CLAUDE.md, Phase 2 lifts the Phase-1 `atomWithObservable` ban → use `atomWithObservable + liveQuery` for the live dashboard. Validate the React 19 path during planning/execution.
- Routes: add `/dashboard` and `/entry` to the existing HashRouter (routes pre-scaffolded in Phase 1).
- Exact confirm-table UX (inline edit vs. row toggles), date-parser tolerance, and source-matching strategy (exact vs. normalized) — planner/executor decide within D-01..D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs (load-bearing — read in full)
- `../../../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` — Full v1 spec. **§3 The Income Model (Two Floors)** is the core reference for this phase: §3a passive floor (solvency baseline, ~$2,400, mean check ≈ $1,710 — do NOT budget on mean), §3b defended line ($3,000 net *from primary job* — the payroll-only basis behind D-09), §3c backfill alert. Also §7a input methods (paste-parse is transaction-level, not itemized; does not feed the unit-cost map), §8 data model (`IncomeCheck`, `Floors`, `SurplusPlan`).
- `../../../../roles/FinancialAdviser/specs/budget_app_build_CLAUDE.md` — Build boot doc: three inviolable constraints, build order, tech posture.

### Project-level planning artifacts
- `.planning/PROJECT.md` — Core value, inviolable constraints C1/C2/C3, key decisions log.
- `.planning/REQUIREMENTS.md` — Phase 2 covers INC-01..08, UI-03, EDGE-01, EDGE-05. Note the §"Provisional values to re-confirm": passive floor ~$2,400/$2,900, EF sweep ~$1,000 (parental gift = the ~$1,000/mo non-taxable stream referenced in FORECAST-02).
- `.planning/ROADMAP.md` — Phase 2 goal + 6 success criteria.
- `.planning/STATE.md` — Open loops.
- `.planning/phases/01-foundation-storage-deploy/01-CONTEXT.md` — Phase 1 decisions D-01..D-21 (Jotai, Dexie, storage abstraction, data model, schema versioning).
- `.planning/phases/01-foundation-storage-deploy/SKELETON.md` — Architectural source of truth for Phases 2–5 (per CLAUDE.md).

### Live data sample (format reference for the parser — D-02..D-05)
- Ian's real checking-statement paste (captured in `02-DISCUSSION-LOG.md`) — tab-delimited, header row `Date Description Amount Balance`, signed comma amounts, multi-line ACH blocks with `TYPE:/ID:/CO:` metadata. The PAYROLL rows (GLI EAST LANSING) are the income gold-signal; VANGUARD SELL / cashback / Venmo are the non-payroll-credit cases the conservative auto-check (D-05) must exclude by default.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/storage/storage.ts` — the ONLY persistence surface domain code imports. Phase 2 **adds income CRUD methods here** (`addIncomeCheck`, `listIncomeChecks(range)`, `updateIncomeCheck`, etc.). Currently exposes only `getFloors/saveFloors/exportAll/importAll`. C1/C2/C3 are structurally enforced by the *absence* of forbidden methods — keep that property.
- `src/storage/schema.ts` — `Floors` type (passive/defended/foodSeed already editable). Add the `IncomeCheck` type + `category`/`taxable`/known-source-list here. Bumping `CURRENT_SCHEMA_VERSION` requires a paired Dexie `.version(N).upgrade()` (db.ts) + `MIGRATIONS[N-1]` entry (migrations.ts) — single source of truth (D-09 of Phase 1).
- `src/domains/settings/settings.atoms.ts` — pattern to copy for a new `src/domains/income/income.atoms.ts` (colocated atoms, no central store).
- Dexie `incomeChecks` table already declared (`++id, date, source`) in Phase 1 — Phase 2 populates it.
- UI primitives: `NumberInput`, `PrimaryButton`, `SecondaryButton`, `DestructiveButton`, `Toast`, `AppShell` — reuse for the entry form and confirm table.
- **Settings already edits passive + defended floors** → SC#6 ("both floor values editable") is largely satisfied; verify/extend rather than rebuild.

### Established Patterns
- Jotai derived atoms = the recompute mechanism (FOUND-06). Month-to-date, projected, surplus, backfill-state are all derived atoms over the income atom.
- All UI tokens from `tailwind.config.ts` (no inline hex); all financial values `font-mono`; all interactive elements `min-h-[44px]`; no `localStorage`/`sessionStorage`.
- Migrations are pure functions used by BOTH the Dexie upgrade path AND JSON import.

### Integration Points
- New routes `/dashboard`, `/entry` on the existing HashRouter.
- `atomWithObservable + liveQuery` (ban lifted in Phase 2 per CLAUDE.md) for the live dashboard.
- Schema migration v1→v2 needed for the new `IncomeCheck` fields (`category`, `taxable`) and the known-source-list settings key.

</code_context>

<specifics>
## Specific Ideas

- **Real test case (use in planning/UAT):** May 2026 = two PAYROLL checks, $1,127.51 (05/01) + $1,296.59 (05/15) = **$2,424.10** → above passive (~$2,400), **below defended ($3,000)** → backfill alert MUST fire. Both are 1st/2nd checks → neither is surplus.
- **Non-income credits the parser must NOT auto-count** (from the real sample): `ACH Deposit VANGUARD SELL` $3,000 (asset sale), `Cashback Redeemed from L30` $223.97, `ACH Deposit VENMO CASHOUT` $600 + $350 (parental gift — categorize `gift`/non-taxable, counts toward total income but NOT the defended line).
- **Income source = checking account only.** Spending flows through a credit card (Phase 3). Confirmed by Ian.
- Inviolable constraints propagate structurally, not by comment (carried from Phase 1): no credential/money-move methods on the storage surface.

</specifics>

<deferred>
## Deferred Ideas

- **Credit-card / itemized statement ingestion (Phase 3).** The generic parser seam (D-01) is built in Phase 2; the CC adapter is built + validated against a real CC statement sample in Phase 3 (confirm format before writing the parser).
- **Checking↔credit-card reconciliation (Phase 3).** Card payoff appears in checking as one lump withdrawal; the card statement shows itemized spend. Phase 3 must treat the checking→card payoff as a **transfer, not an expense** (double-counting trap) and reconcile checking's card-payment total against the card statement balance ("leverage the two against each other").
- **`Account` type enum needs a `credit` type** (currently `checking | brokerage | moneymarket`) — add in Phase 3. Account-balance wiring (the parsed balance number) also deferred.
- **Estimated-tax-payment feature `TAX-01` (v2 backlog).** Compute quarterly estimates / reminders from YTD taxable income. Phase 2 provides only the data foundation (`taxable` flag + YTD taxable sum, D-10).
- **Independence indicator + gift-surplus investing (Phase 5).** Goal: payroll income alone should cover the passive/survival floor → non-dependent on parental gift money. The payroll-only defended-line tracking (D-09) is the data foundation; surface as a Phase 5 dashboard indicator, and route gift-derived surplus to investing via the Phase 5 surplus router.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 2-Income-Model-with-Two-Floors*
*Context gathered: 2026-05-28*
