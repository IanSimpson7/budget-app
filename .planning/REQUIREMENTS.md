# Requirements: Budget App

**Defined:** 2026-05-27
**Core Value:** Show Ian where this month's income stands against the floor that matters, and where surplus should go first — without ever pressuring food or moving money.
**Spec source:** `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` (v1, 2026-05-27)

---

## Inviolable Constraints (apply to every requirement)

| ID | Constraint | Spec |
|---|---|---|
| **C1** | Food floor never gated, reduced, or suggested as a cut | §0, §5e |
| **C2** | No bank credentials, no bank/brokerage API, ever | §0, §7 |
| **C3** | App never moves money, never executes trades | §0, §6 |

Every requirement below is consistent with C1–C3. Any future requirement that conflicts is automatically out of scope.

---

## v1 Requirements

### Foundation

- [x] **FOUND-01**: App is a Vite + React + TypeScript web app with component structure and responsive layout (not a single-file artifact) — satisfied by 01-01
- [x] **FOUND-02**: All financial data persists locally via IndexedDB behind a storage abstraction (no `localStorage`-coupling in domain code) — satisfied by 01-02
- [x] **FOUND-03**: User can export all data as JSON via an "Export backup" action — satisfied by 01-02
- [x] **FOUND-04**: User can import a previously-exported JSON file to restore state — satisfied by 01-02
- [x] **FOUND-05**: All floors and targets (passive floor, defended line, food floor, EF targets) are stored as editable parameters, never hard-coded constants — satisfied by 01-02 (passive/defended/foodSeed only; remaining EF targets land in later phases)
- [x] **FOUND-06**: Derived values (survival floor, EF 3-mo target, EF 6-mo target, monthly surplus) recompute on input change — never stored as stale copies — pattern proven by 01-02 (derivedSurvivalFloorAtom); remaining derivations land in later phases

### Income Model

- [ ] **INC-01**: User can record a biweekly net income check (`{date, netAmount, source, note}`)
- [ ] **INC-02**: User can configure two distinct floors: passive floor (working value) and defended line (default $3,000)
- [ ] **INC-03**: App budgets solvency math against the passive floor, never the income average or the defended line
- [ ] **INC-04**: Monthly income is baselined on 2 checks/month; a 3rd check in a calendar month is classified as surplus, not new baseline
- [ ] **INC-05**: Dashboard displays month-to-date income against BOTH lines: solvency band at passive floor, backfill-trigger marker at defended line
- [ ] **INC-06**: When projected monthly income falls below the defended line, app surfaces a backfill alert ("projected $X, below $3,000 — add sessions to defend")
- [ ] **INC-07**: User can enter income via typed manual entry as an always-available fallback
- [ ] **INC-08**: User can paste a block of transaction text and have it parsed into categorized entries with a confirm/edit step before commit (paste-parse pipeline produces transactions, not unit costs)

### Expense Model

- [ ] **EXP-01**: User can record expense line items (`{name, amount, cadence, category, protected, gateable}`) where cadence ∈ {monthly, annual, oneoff}
- [ ] **EXP-02**: Expenses are classified as PROTECTED (fixed + protected food floor + flavor line) or GATEABLE (discretionary food layer + discretionary non-food)
- [ ] **EXP-03**: Survival floor is computed as `fixed_ex_food + protected_food_floor` and updates automatically when either input changes
- [ ] **EXP-04**: App provides ONE generic sinking-fund primitive (`{name, annualAmount, monthlyAccrual, balance, payoutDate}`); car insurance is the launch instance
- [ ] **EXP-05**: Adding a new sinking-fund instance (e.g. car-purchase fund) requires zero new code paths — only a new instance of the primitive
- [ ] **EXP-06**: When an annual cost is due (e.g. car insurance), the cost is covered from the sinking-fund balance and does NOT appear as a budget shock that month
- [ ] **EXP-07**: Whey/supplement spending is tracked inside the food floor (§5), never double-counted in fixed-ex-food

### FoodNeed Contract

- [ ] **FOOD-01**: App reads `meal_pool.md` from the SMC project (`../schedule-meal-coordinator/`) read-only; never writes to or triggers SMC
- [ ] **FOOD-02**: App parses meal entries from `meal_pool.md` keyed by `###` header (stable meal name), extracting `categories`, `is_substantial`, and `ingredients` list per meal
- [ ] **FOOD-03**: App reads `plans/<date>.md` (and `plans/<start>--<end>.md`) from the SMC project to determine which meals are scheduled for which dates
- [ ] **FOOD-04**: User can edit a unit-cost map in-UI (`{ingredient → cost per unit}`) — a simple editable table; this is configuration, not parsed data
- [ ] **FOOD-05**: User can edit a portion model in-UI (`{ingredient → typical portion per meal}`) — a simple editable table
- [ ] **FOOD-06**: Meal cost is computed as Σ over macro-bearing ingredients (portion × unit_cost); meal costs are NEVER hard-coded
- [ ] **FOOD-07**: Period food floor is computed as Σ over meals scheduled in the period; recomputes when pool, plan, unit-cost map, or portion model changes
- [ ] **FOOD-08**: When the meal pool gains an ingredient with no unit cost, app flags it visibly ("unpriced ingredient — needs unit cost"); does not silently undercount
- [ ] **FOOD-09**: New meals built from already-priced ingredients price automatically without user action
- [ ] **FOOD-10**: Flavor/condiment line is a separate fixed monthly amount (seed ~$50/mo, editable), excluded from per-meal pricing, treated as PROTECTED
- [ ] **FOOD-11**: When no current meal plan exists (SMC hasn't run, or there's a gap), food floor falls back to the last-known value or a high-water mark — NEVER a lower number. Staleness is flagged in UI.
- [ ] **FOOD-12**: Protected food floor renders as a locked, rent-like line in every budget view; UI offers no path to edit it downward, no "cut spending" suggestion that touches it
- [ ] **FOOD-13**: Food floor seed value is ~$550/mo, editable upward, with a `lastRefinedFromReceipts` timestamp visible to the user

### Surplus Router

- [ ] **SURP-01**: On income entry, app computes month-to-date income, projected month total (2-check basis), and current monthly surplus = projected − passive_floor − protected_obligations
- [ ] **SURP-02**: EF target is computed as `EF_3mo = 3 × survival_floor` and `EF_6mo = 6 × survival_floor`; targets recompute when survival floor changes
- [ ] **SURP-03**: Surplus routes to emergency-fund rebuild FIRST until 3-mo target, then to 6-mo target, then to new equity contributions — sequence is fixed
- [ ] **SURP-04**: App displays a recommended sweep action (e.g. "Transfer $X to VMFXX to advance the 3-month EF target") on the dashboard
- [ ] **SURP-05**: App NEVER executes the transfer; the recommended action is read-only text/UI with no "execute" affordance
- [ ] **SURP-06**: App NEVER recommends selling invested assets to fill the EF in a single move; EF rebuilds via gradual sweep only
- [ ] **SURP-07**: When projected monthly income < defended line, app surfaces the backfill alert (INC-06) INSTEAD of a sweep recommendation
- [ ] **SURP-08**: User can record a pending EF sweep (`{amount, expectedDate, status}`); status is `pending` until user marks it `done`
- [ ] **SURP-09**: On EF withdrawal (real hardship), app recomputes targets and re-prioritizes the next sweep; does NOT recommend asset sale to refill

### UI Surfaces

- [ ] **UI-01**: Dashboard renders income-to-date vs both floors, protected-vs-discretionary spend split, surplus amount, and recommended sweep
- [ ] **UI-02**: Food panel renders the protected floor (locked, visibly non-editable downward) and the gateable discretionary food layer side by side
- [ ] **UI-03**: Entry surface supports typed entry and paste-parse with a confirm step before commit
- [ ] **UI-04**: Funds surface shows EF progress (current → 3-mo → 6-mo) and all sinking-fund instances with progress toward payout dates
- [x] **UI-05**: Backup surface exposes JSON export and import actions — satisfied by 01-02
- [ ] **UI-06**: UI is responsive — phone view of dashboard is readable (entry is laptop-primary, but viewing state on phone works)

### Edge Cases (cross-cutting)

- [ ] **EDGE-01**: Income below passive floor or below defended line surfaces solvency warning / backfill alert; never silently absorbed
- [ ] **EDGE-02**: No current meal plan → food floor fallback-high with staleness flag (FOOD-11)
- [ ] **EDGE-03**: Pool gains a new ingredient with no unit cost → unpriced-ingredient flag (FOOD-08)
- [ ] **EDGE-04**: EF withdrawal → recompute targets, re-prioritize (SURP-09)
- [ ] **EDGE-05**: 3rd check in a month → classified as surplus (INC-04)
- [ ] **EDGE-06**: Annual sinking-fund cost due → covered by accrued balance, not a shock (EXP-06)

### Deploy

- [ ] **DEP-01**: App builds to a static bundle deployable to GitHub Pages
- [ ] **DEP-02**: GitHub Actions workflow builds and deploys on push to `main`
- [ ] **DEP-03**: Build references no external services that require credentials at runtime (constraint C2)

---

## v2 Requirements (deferred)

### Future automation

- **OCR-01**: Screenshot OCR ingestion of statement screenshots → entry pipeline (architected for in v1 via the storage abstraction)
- **OCR-02**: Itemized receipt parser to auto-refine the unit-cost map
- **IMPORT-01**: Bank/CC transaction file import (CSV/QFX export — never credentials)

### Future modeling

- **FORECAST-01**: Forecasting / scenario modeling
- **FORECAST-02**: Relocation modeling (loss of ~$1,000/mo non-taxable income stream on relocation)

### Future integration

- **SMC-01**: Live wiring to running SMC system (v1 reads files only)

---

## Out of Scope

| Feature | Reason |
|---|---|
| Bank API integration / credential storage | Violates C2 |
| Automatic money movement / trade execution | Violates C3 |
| Food floor reduction suggestions or downward editing | Violates C1 |
| Live SMC integration | v2 — v1 reads files only |
| Screenshot OCR ingestion in v1 | v2 — paste-parse covers v1 |
| Itemized receipt parser in v1 | v2 — manual unit-cost UI is sufficient for ~20 items |
| Forecasting / scenario modeling | v2 |
| Relocation modeling | v2 |
| Multi-user, auth, accounts | Single-user app by design |
| Backend server with credentials | Violates C2; local-only by design |
| Cross-device cloud sync | Local-only by design; JSON export/import is the sync mechanism |
| Reallocation of existing brokerage holdings | App gives allocation guidance, not trade instructions (C3) |

---

## Traceability

Populated by `gsd-roadmapper` 2026-05-27.

| Requirement | Phase | Status |
|---|---|---|
| FOUND-01 | Phase 1 | Complete (01-01) |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| DEP-01 | Phase 1 | Pending |
| DEP-02 | Phase 1 | Pending |
| DEP-03 | Phase 1 | Pending |
| INC-01 | Phase 2 | Pending |
| INC-02 | Phase 2 | Pending |
| INC-03 | Phase 2 | Pending |
| INC-04 | Phase 2 | Pending |
| INC-05 | Phase 2 | Pending |
| INC-06 | Phase 2 | Pending |
| INC-07 | Phase 2 | Pending |
| INC-08 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| EDGE-01 | Phase 2 | Pending |
| EDGE-05 | Phase 2 | Pending |
| EXP-01 | Phase 3 | Pending |
| EXP-02 | Phase 3 | Pending |
| EXP-03 | Phase 3 | Pending |
| EXP-04 | Phase 3 | Pending |
| EXP-05 | Phase 3 | Pending |
| EXP-06 | Phase 3 | Pending |
| EXP-07 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| EDGE-06 | Phase 3 | Pending |
| FOOD-01 | Phase 4 | Pending |
| FOOD-02 | Phase 4 | Pending |
| FOOD-03 | Phase 4 | Pending |
| FOOD-04 | Phase 4 | Pending |
| FOOD-05 | Phase 4 | Pending |
| FOOD-06 | Phase 4 | Pending |
| FOOD-07 | Phase 4 | Pending |
| FOOD-08 | Phase 4 | Pending |
| FOOD-09 | Phase 4 | Pending |
| FOOD-10 | Phase 4 | Pending |
| FOOD-11 | Phase 4 | Pending |
| FOOD-12 | Phase 4 | Pending |
| FOOD-13 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| EDGE-02 | Phase 4 | Pending |
| EDGE-03 | Phase 4 | Pending |
| SURP-01 | Phase 5 | Pending |
| SURP-02 | Phase 5 | Pending |
| SURP-03 | Phase 5 | Pending |
| SURP-04 | Phase 5 | Pending |
| SURP-05 | Phase 5 | Pending |
| SURP-06 | Phase 5 | Pending |
| SURP-07 | Phase 5 | Pending |
| SURP-08 | Phase 5 | Pending |
| SURP-09 | Phase 5 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-06 | Phase 5 | Pending |
| EDGE-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: **58 total** (FOUND=6 · INC=8 · EXP=7 · FOOD=13 · SURP=9 · UI=6 · EDGE=6 · DEP=3)
- Mapped to phases: **58** ✓
- Unmapped: **0**

**Per-phase totals:** P1=10 · P2=11 · P3=9 · P4=16 · P5=12 = 58 ✓

---

## Provisional values to re-confirm during build (per spec §12)

- Passive floor (~$2,400 / ~$2,900) — validate at August 2026 review
- Food floor (~$550) — converge from receipts
- Flavor line (~$50) — refine from receipts
- EF sweep (~$1,000) — confirm landed after ~May 29 payday

These are app inputs, not requirements per se — but the app must treat them as editable parameters (FOUND-05) so they can refine in place.

---
*Requirements defined: 2026-05-27*
*Traceability populated: 2026-05-27 by gsd-roadmapper*
