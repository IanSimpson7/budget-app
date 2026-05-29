# Phase 3: Expense Model + Sinking Funds - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

> **Path convention:** all relative paths below are from the project root
> `projects/budget-app/` (where the researcher/planner/executor operate),
> NOT from this file's location.

<domain>
## Phase Boundary

**What this phase delivers:** Ian can record expense line items classified protected vs gateable on a new `/expenses` surface, see a derived survival floor (`fixed_ex_food + foodSeed`) recompute live as a new dashboard metric card, and manage annual sinking funds (car-insurance launch instance) on a new `/funds` surface so a yearly cost accrues monthly and never lands as a budget shock. The sinking-fund mechanism is ONE generic primitive — a second instance (car-purchase fund) is added through the same UI with zero new code.

**In scope (REQ-IDs):** EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07, UI-04, EDGE-06

**Out of scope (explicit, not just "later"):**
- **Credit-card / itemized statement paste-parse adapter** — deferred to **Phase 5** (re-scoped this phase; see Deferred). Phase 2's parser seam stays unused until then. Phase 3 expense entry is **typed-only**.
- **Checking↔card-payoff reconciliation** (transfer-not-expense double-counting trap) — moves with the CC adapter to Phase 5.
- **`Account` entity `credit` type + account-balance wiring** — not needed for typed expense lines; revisit with the CC adapter (Phase 5).
- **Computed food floor** (ingredient-keyed, SMC-sourced) — Phase 4. Phase 3 uses the existing `floors.foodSeed` (~$550) as the protected-food placeholder term in the survival floor.
- **Emergency fund (EF) progress + targets** (`survival_floor × 3/6`) — Phase 5. The `/funds` surface ships sinking-funds-only this phase; the EF section is appended to the same surface in Phase 5. No EF stub/placeholder now.
- **Full dashboard protected-vs-discretionary split + surplus router** — UI-01 / Phase 5. Phase 3's dashboard addition is only the survival-floor number; the categorized protected/gateable VIEW lives on `/expenses`.
- **Discretionary food layer (~$1,100/mo, gateable)** — its gating belongs to the Phase 4/5 food + surplus work; Phase 3 only models the line classification, not the gating UI.

</domain>

<decisions>
## Implementation Decisions

### Expense Entry & Classification (EXP-01, EXP-02, EXP-07)

- **D-01: Typed-only entry in Phase 3.** Recurring/fixed expense lines (rent, electric, fuel, Claude sub) are typed once and rarely change — typed entry covers every Phase-3 success criterion. The CC paste-parse adapter + reconciliation that Phase 2 deferred "to Phase 3" is re-scoped to **Phase 5**, where variable discretionary-spend tracking actually feeds the surplus math. The Phase-2 parser seam remains built but unused — no rework incurred.
- **D-02: Single `classification: 'protected' | 'gateable'` enum, NOT the spec's two separate bools.** The spec §8 data model lists `protected: bool` + `gateable: bool`; collapse to one mutually-exclusive field. Rationale: prevents contradictory/ambiguous state (protected+gateable, or neither), and makes the protected-vs-gateable view (SC#1) and the survival-floor sum trivial filters. The schema migration maps the spec's two bools onto the one enum.
- **D-03: Seed §4a known fixed costs as editable starter line items on first run.** Survival floor shows a real number on day one; every value is editable in place (FOUND-05). Seed set (PROTECTED, ex-food): Housing all-in $1,300, Electric ~$65, Fuel ~$238, Claude ~$100. **Car insurance is NOT a fixed line — it seeds as the sinking-fund instance (D-05) to avoid double-count.** **Whey/supplement is NOT seeded here (EXP-07)** — it lives in the Phase-4 protected food floor; counting it in fixed-ex-food would double-count.

### Sinking-Fund Mechanics (EXP-04, EXP-05, EXP-06, EDGE-06)

- **D-04: Manual balance + recommended accrual (C3-consistent).** Ian records the actual set-aside `balance`; the app shows the recommended `monthlyAccrual` and an on-track/behind status vs the payout date. The app never assumes money moved (C3 advisor posture, mirrors the Phase-5 EF `currentBalance` pattern). Honest if Ian skips a month.
- **D-05: One generic primitive; car-insurance launch instance with an editable, PROVISIONAL target.** Fields (refine the spec §8 `SinkingFund` shape during planning): `{ id, name, annualAmount (editable target), monthlyAccrual (editable), balance (manual), payoutDate, cadence: 'annual' | 'oneoff' }`. Car-insurance seed: `payoutDate = 2027-03`, `annualAmount` ≈ $982 **flagged provisional** (Ian will likely have a different car by renewal — premium is unknowable now), `monthlyAccrual` seeded at `annualAmount / 12` (~$82) and editable. Adding a new fund (e.g. car-purchase) is a new instance via the same `/funds` Add-fund form — **zero new code paths (EXP-05 / SC#5).**
- **D-06: On-track status = projected balance at payout vs current target.** The app compares `balance + monthlyAccrual × months_until_payout` against `annualAmount` and shows on-track/behind; **it does NOT auto-recompute the accrual** — Ian adjusts the accrual (or the target) himself. Confirmed: Ian repopulates the target value at renewal rather than the app guessing.
- **D-07: Payout = mark-paid + recurring auto-roll (NOT app auto-cover).** When the payout date arrives (EDGE-06), Ian marks the payout covered (C3 — no money action the app can't verify). For a `cadence: 'annual'` fund the app resets `balance` and advances `payoutDate` +1yr, resuming accrual; Ian sets the new `annualAmount` at that point. For `cadence: 'oneoff'` (car-purchase) the fund completes. **SC#4 (no monthly shock) is satisfied structurally:** the annual cost is pre-accrued in the fund and never appears as a monthly expense line — only the amortized accrual does (D-08).

### Survival Floor (EXP-03)

- **D-08: `survival_floor = fixed_ex_food + floors.foodSeed`, where `fixed_ex_food` includes sinking-fund monthly accruals.** The amortized ~$82/mo car-insurance accrual feeds the survival floor as a protected monthly obligation — NOT the $982 annual lump (this is the entire point of amortizing). Concretely: `fixed_ex_food = Σ(protected non-food expense lines, normalized to monthly by cadence) + Σ(sinking-fund monthlyAccrual)`. Derived Jotai atom; recomputes live (FOUND-06) when any input changes.
- **D-09: Food-floor placeholder = the existing `floors.foodSeed` (~$550).** No new parameter. Phase 4 swaps the computed ingredient-keyed food floor into the same slot — clean handoff, nothing to retire.
- **D-10: Cadence normalization for the floor.** Expense lines carry `cadence ∈ {monthly, annual, oneoff}` (EXP-01). The survival floor counts monthly-equivalent protected cost: `monthly` as-is, `annual / 12`, `oneoff` excluded from the recurring floor. Only PROTECTED lines feed the floor; GATEABLE lines and the discretionary food layer never do.

### UI Surfaces (UI-04)

- **D-11: New `/expenses` route** — add/edit expense lines AND the protected-vs-gateable categorized view (SC#1) live here. Consistent with the existing `/dashboard`, `/entry` HashRouter pattern. The dashboard gets only the survival-floor metric card this phase.
- **D-12: Survival floor renders as a new `font-mono` metric card** on the dashboard, alongside the existing month-to-date / projected / surplus cards. NOT a band/marker on the income bar (survival ~$2,340 and passive ~$2,400 are too close — bands would visually collide).
- **D-13: New `/funds` route — sinking-funds-only this phase.** Each fund renders as a **card**: name, current balance, target, payout date, recommended monthly accrual, on-track status, and a **progress bar** (balance → target by payout). An **"Add sinking fund" form** creates new instances through the UI — directly proving SC#5/EXP-05. EF-progress section is appended here in Phase 5.

### Claude's Discretion

- Exact field names/shape of the `ExpenseItem` and `SinkingFund` types within D-02/D-05 — planner/executor finalize against the existing `schema.ts` conventions.
- Schema migration v2→v3 mechanics (Dexie `.version(3)` upgrade + `MIGRATIONS[2]` entry) — follow the Phase-1 single-source-of-truth pattern (D-09 of Phase 1). Migration must map any prior expense bools→enum (none exist yet; tables are empty) and is a pure function shared by Dexie upgrade + JSON import.
- Whether the seed (D-03) runs as a first-run settings flag or an idempotent "seed if empty" check — executor's call, must not clobber Ian's edits on reload.
- `/expenses` and `/funds` form UX details (inline edit vs modal), progress-bar visuals — within UI-design-principles + existing primitives.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**
*(Paths are relative to project root `projects/budget-app/`.)*

### Project specs (load-bearing — read in full)
- `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` — Full v1 spec. **Core sections for this phase:** §4 Expense Model (§4a fixed-ex-food PROTECTED table + whey reclassification note → EXP-07, §4c discretionary non-food GATEABLE, §4d discretionary food layer GATEABLE, §4e survival_floor derivation → EXP-03), §6d Sinking funds — one generic primitive (→ EXP-04/05), §8 Data Model (`ExpenseItem`, `SinkingFund` initial schemas — refine in build), §11 edge cases (annual cost due → EDGE-06), §12 provisional values (food floor ~$550, all editable).
- `../../roles/FinancialAdviser/specs/budget_app_build_CLAUDE.md` — Build boot doc: the three inviolable constraints (C1/C2/C3), build order, tech posture. C3 (no money movement) is the direct driver of D-04/D-06/D-07.

### Project-level planning artifacts
- `.planning/PROJECT.md` — Core value, inviolable constraints C1/C2/C3, key decisions log, §12 provisional values.
- `.planning/REQUIREMENTS.md` — Phase 3 covers EXP-01..07, UI-04, EDGE-06. Note §"Provisional values to re-confirm": food floor ~$550, flavor line ~$50.
- `.planning/ROADMAP.md` — Phase 3 goal + 6 success criteria (the verification target).
- `.planning/STATE.md` — Open loops; the **dated follow-up: bump GitHub Actions major tags before 2026-06-02** (an armed scheduled remote agent handles this on 2026-06-01 — do not duplicate).
- `.planning/phases/01-foundation-storage-deploy/01-CONTEXT.md` — Phase 1 decisions D-01..D-21 (Jotai atoms, Dexie, storage abstraction, schema versioning single-source-of-truth, data-model seam).
- `.planning/phases/01-foundation-storage-deploy/SKELETON.md` — Architectural source of truth for Phases 2–5 (per project CLAUDE.md).
- `.planning/phases/02-income-model-with-two-floors/02-CONTEXT.md` — Phase 2 decisions + the Deferred Ideas block that originally pointed the CC adapter / reconciliation / `Account.credit` here (now re-scoped to Phase 5 per D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/storage/storage.ts` — the ONLY persistence surface domain code imports. Phase 3 **adds expense + sinking-fund CRUD here** (`addExpenseItem`, `listExpenseItems`, `updateExpenseItem`, `deleteExpenseItem`, `observeExpenseItems`; same set for sinking funds). C1/C2/C3 are enforced by the *absence* of forbidden methods — keep that property (no money-movement, no balance-mutation-by-the-app beyond Ian's manual writes).
- `src/storage/schema.ts` — add `ExpenseItem` (with `classification` enum + `cadence`) and `SinkingFund` types here; bump `CURRENT_SCHEMA_VERSION` 2→3. The `SchemaV1Data` envelope already lists `expenseItems` + `sinkingFunds` arrays (currently always `[]` in `collectSchemaV1Data`/`replaceAll`) — wire them to persist + round-trip.
- `src/storage/db.ts` — Dexie `expenseItems` + `sinkingFunds` tables are **already declared but empty**; Phase 3 populates them. Needs a `.version(3)` upgrade paired with `MIGRATIONS[2]`.
- `src/domains/income/income.atoms.ts` — pattern to copy for new `src/domains/expenses/` and `src/domains/funds/` colocated atoms (no central store). The derived-atom recompute pattern (month-to-date/projected/surplus over the income atom) is the template for the derived `survivalFloorAtom`.
- `src/domains/settings/` — `floors.foodSeed` already stored + editable; D-09 reuses it directly.
- UI primitives: `NumberInput`, `PrimaryButton`, `SecondaryButton`, `DestructiveButton`, `Toast`, `AppShell` — reuse for the `/expenses` + `/funds` forms and cards.

### Established Patterns
- Jotai derived atoms = the FOUND-06 recompute mechanism. `survivalFloorAtom` derives over (expense lines + sinking-fund accruals + `floors.foodSeed`).
- `atomWithObservable + liveQuery` (proven in Phase 2) for live `/expenses` and `/funds` lists.
- Migrations are pure functions used by BOTH the Dexie upgrade path AND JSON import — single source of truth (Phase 1 D-09).
- All UI tokens from `tailwind.config.ts` (no inline hex); financial values `font-mono`; interactive elements `min-h-[44px]`; no `localStorage`/`sessionStorage`.

### Integration Points
- New routes `/expenses`, `/funds` on the existing HashRouter (alongside `/dashboard`, `/entry`).
- New survival-floor metric card on the existing dashboard, fed by `survivalFloorAtom`.
- Schema migration v2→v3 for `ExpenseItem` + `SinkingFund` rows.
- Export/import: extend `collectSchemaV1Data` + `replaceAll` to populate `expenseItems` + `sinkingFunds` (currently stubbed `[]`) so v3 backups round-trip.

</code_context>

<specifics>
## Specific Ideas

- **Car-insurance instance (launch test case):** target ≈ $982 (PROVISIONAL), `payoutDate = 2027-03`, `monthlyAccrual` ≈ $82, `cadence: annual`. Ian will likely have a different car by the March-2027 renewal, so the target is a soft guess he repopulates at renewal — the app must treat it as fully editable and never lock it.
- **Seed fixed costs (§4a, PROTECTED, ex-food):** Housing all-in $1,300, Electric ~$65, Fuel ~$238, Claude ~$100. (Phone = $0, on family plan — omit or seed as $0.)
- **Survival-floor sanity number:** ~$1,790 fixed-ex-food + ~$550 foodSeed ≈ **$2,340/mo** (spec §4e) — useful for UAT.
- **EXP-07 guard:** whey/supplement must NOT appear in fixed-ex-food (it's deferred to the Phase-4 protected food floor) — a real double-count trap the spec calls out explicitly.
- Inviolable constraints propagate structurally, not by comment (carried from Phase 1/2): no credential/money-move methods on the storage surface; the app recommends accrual, Ian records reality.

</specifics>

<deferred>
## Deferred Ideas

- **CC / itemized statement paste-parse adapter (→ Phase 5).** Re-scoped out of Phase 3 (D-01). Build + validate against a real CC statement sample where discretionary-spend capture feeds the surplus router. Confirm the real statement format before writing the adapter.
- **Checking↔credit-card reconciliation (→ Phase 5).** Card payoff appears in checking as one lump withdrawal; the card statement itemizes spend. Treat the checking→card payoff as a **transfer, not an expense** (double-counting trap) and reconcile checking's card-payment total against the card balance. Moves with the CC adapter.
- **`Account` type `credit` enum + account-balance wiring (→ Phase 5).** Currently `checking | brokerage | moneymarket`; the parsed balance number is still unwired. Revisit with the CC adapter.
- **Discretionary-food gating UI + soft caps (→ Phase 4/5).** §4d names the discretionary food layer (~$1,100/mo) as the primary lever; Phase 3 only models the GATEABLE classification, not the gating/cap interventions (caffeine-pill substitution, bulk-buy, trip consolidation).
- **Emergency-fund progress section on `/funds` (→ Phase 5).** Same surface; EF math (`survival_floor × 3/6`) and pending-sweep tracking land in Phase 5 (SURP-02/08).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 3-Expense-Model-Sinking-Funds*
*Context gathered: 2026-05-29*
