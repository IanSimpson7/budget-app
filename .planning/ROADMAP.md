# Roadmap: Budget App

**Created:** 2026-05-27
**Granularity:** standard (5 phases)
**Mode:** MVP — each phase delivers an end-to-end user capability
**Coverage:** 58/58 v1 requirements mapped
**Spec:** `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md`

## Inviolable Constraints (apply to every phase)

- **C1** — Food floor never gated, reduced, or suggested as a cut (BED clinical safety)
- **C2** — No bank credentials, no bank/brokerage API, ever
- **C3** — App never moves money / executes trades

Every phase's plans must structurally enforce these — not merely document them.

---

## Phases

- [x] **Phase 1: Foundation, Storage, Deploy** — Vite+React+TS app deployed to GitHub Pages with IndexedDB persistence and JSON export/import on day one
- [ ] **Phase 2: Income Model with Two Floors** — Ian can enter checks (typed + paste-parse) and see income-to-date against both passive floor and defended line
- [x] **Phase 3: Expense Model + Sinking Funds** — Protected vs gateable line items, derived survival floor, generic sinking-fund primitive (car insurance instance) (completed 2026-05-29)
- [ ] **Phase 4: Food Contract (Locked Floor)** — Read-only SMC integration: ingredient-keyed food floor pricing with locked UI, fallback-high, unpriced-ingredient guard
- [ ] **Phase 5: Surplus Router + Unified Dashboard** — EF-first recommendation engine, gradual sweep, backfill-vs-sweep gate, phone-readable dashboard

---

## Phase Details

### Phase 1: Foundation, Storage, Deploy
**Goal:** Ian can open a deployed URL on his phone, enter a placeholder value, export/import it as JSON, and have it persist across reloads.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, UI-05, DEP-01, DEP-02, DEP-03
**Success Criteria** (what must be TRUE):
  1. Ian can navigate to the GitHub Pages URL on his phone and see the app load
  2. Ian can enter a value into a settings/parameter field; it persists across page reloads via IndexedDB
  3. Ian can click "Export backup" and receive a JSON file containing all stored state
  4. Ian can import a previously-exported JSON file and see his prior state restored
  5. Every push to `main` auto-deploys to GitHub Pages via GitHub Actions
**Plans:** 3 plans
- [x] 01-01-PLAN.md — Scaffold Vite+React+TS, pin Tailwind v3, Wave 0 test stubs (commits: db362a5, d4f19f9; SUMMARY: 01-01-SUMMARY.md)
- [x] 01-02-PLAN.md — Walking skeleton vertical slice: Dexie + storage abstraction + settings atoms + Settings/Backup pages with HashRouter (commits: b91d051, 6f6ff23, a0a75a7, 426cfc6, fd5ca96, 9efd70a; SUMMARY: 01-02-SUMMARY.md)
- [x] 01-03-PLAN.md — GitHub Actions deploy + phone verification + CLAUDE.md/README.md update (commits: 292c0cc, 9c115ff; SUMMARY: 01-03-SUMMARY.md; live: https://iansimpson7.github.io/budget-app/)
**Leverage-pause:** state/data-model architecture decision — surface for Ian's sign-off before deep implementation (per spec §calibration)
**UI hint:** yes

### Phase 2: Income Model with Two Floors
**Goal:** Ian can record his biweekly checks and see month-to-date income against both the passive floor (solvency) and defended line ($3,000 backfill trigger), with alerts when projection drops below the defended line.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08, UI-03, EDGE-01, EDGE-05
**Success Criteria** (what must be TRUE):
  1. Ian can type a new check entry (`date, netAmount, source, note`) and see it persisted
  2. Ian can paste a block of transaction text, review parsed entries in a confirm step, and commit them
  3. Dashboard renders month-to-date income with two visual markers: solvency band at passive floor, backfill marker at defended line
  4. When projected month total falls below $3,000, a backfill alert surfaces ("projected $X, below $3,000 — add sessions to defend")
  5. A 3rd check in the same calendar month is automatically classified as surplus, not absorbed into the monthly baseline
  6. Both floor values are editable in a settings/parameters surface
**Plans:** 5 plans
- [x] 02-01-PLAN.md — Schema v1→v2 migration + income CRUD/known-source storage + db-free reactive observable + Wave 0 scaffolds
- [x] 02-02-PLAN.md — Pure statement parser + checking adapter + classification + reactive income atom chain (gold fixture gate)
- [x] 02-03-PLAN.md — Manual entry vertical slice: CheckEntryForm + EntryTabBar + /entry route
- [x] 02-04-PLAN.md — Dashboard vertical slice: IncomeBar + metric cards + backfill alert + /dashboard index route
- [x] 02-05-PLAN.md — Paste-parse vertical slice: PasteParseFlow + ConfirmTable + remember-sources + Settings estimate field
**UI hint:** yes

### Phase 3: Expense Model + Sinking Funds
**Goal:** Ian can record expense line items classified as protected vs gateable, see the derived survival floor recompute live, and have annual sinking-fund costs (car insurance) accrue monthly without budget shock.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07, UI-04, EDGE-06
**Success Criteria** (what must be TRUE):
  1. Ian can add an expense line (`name, amount, cadence, category, protected, gateable`) and see it categorized correctly in the protected vs gateable view
  2. Survival floor (fixed_ex_food + protected_food_floor placeholder) displays on the dashboard and recomputes when either input changes
  3. Funds surface shows the car-insurance sinking fund accruing ~$82/mo toward a $982 annual payout date
  4. When the annual sinking-fund payout date arrives, the cost is covered from the accrued balance and does NOT appear as a monthly shock
  5. A second sinking-fund instance (e.g. car-purchase fund) can be added by Ian via the same UI without code changes
  6. Whey/supplement spending does NOT appear in fixed-ex-food (deferred to the protected food floor in Phase 4)
**Plans:** 3/3 plans complete
- [x] 03-01-PLAN.md — Schema v2→v3 + expense/fund storage CRUD + seeds + export wiring + reactive atom chain (survivalFloorAtom, mark-paid) + Wave 0 tests
- [x] 03-02-PLAN.md — /expenses vertical slice: form primitives + categorized protected/gateable view + dashboard survival-floor card + routes/nav
- [x] 03-03-PLAN.md — /funds vertical slice: FundCard + FundsPage (add/edit/mark-paid/delete) + /funds route
**UI hint:** yes

### Phase 4: Food Contract (Locked Floor)
**Goal:** Ian sees the protected food floor rendered as a locked, rent-like line in every budget view — computed live from the SMC meal pool and current plan, ingredient-keyed, with explicit flags for unpriced ingredients and stale/missing plans (fallback-high, never lower).
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** FOOD-01, FOOD-02, FOOD-03, FOOD-04, FOOD-05, FOOD-06, FOOD-07, FOOD-08, FOOD-09, FOOD-10, FOOD-11, FOOD-12, FOOD-13, UI-02, EDGE-02, EDGE-03
**Success Criteria** (what must be TRUE):
  1. App reads `meal_pool.md` and the current `plans/<date>.md` from `../schedule-meal-coordinator/` and shows which meals are scheduled for the active period (read-only — SMC files are never modified)
  2. Ian can edit the unit-cost map and portion model via simple in-UI tables; meal costs recompute immediately
  3. Food panel renders the protected floor as a locked line with NO downward-edit affordance and NO "cut spending" suggestion that touches it
  4. When the meal pool gains an ingredient with no unit cost, a visible "unpriced ingredient — needs unit cost" flag appears (no silent undercount)
  5. When no current plan file exists or the plan is stale, the floor falls back to the last-known value or high-water mark (never lower) and shows a staleness flag
  6. Flavor/condiment line displays as a separate fixed monthly amount (~$50/mo seed, editable), excluded from per-meal pricing, treated as PROTECTED
  7. Food panel shows the discretionary food layer (gateable) side-by-side with the protected floor (locked)
**Plans:** 5 plans
- [ ] 04-01-PLAN.md — Storage foundation: schema v3→v4 + mealDefinitions table + 4 food settings singletons + CRUD/seed/export round-trip + C1 absence-proofs + Wave-0 test scaffolds (V1–V8)
- [ ] 04-02-PLAN.md — SMC plan parser vertical slice: parsePlanFile (both filename + both body formats) + Vite glob fs.allow + build-and-push/CI-fallback docs (V1, V8)
- [ ] 04-03-PLAN.md — Cost engine + foodFloorAtom chain: Σ macro-bearing cost, fallback-high gaps, monthly derivation, stale max(last,high-water), survivalFloorAtom swap (V3–V7)
- [ ] 04-04-PLAN.md — /food/config surface: three editable tables (meal/unit-cost/portion) + FOOD-13 timestamp + routes/nav (FOOD-04/05/08/13, EDGE-03)
- [ ] 04-05-PLAN.md — /food locked-floor panel: read-only floor + Lock + flavor line + side-by-side gateable layer + status badge/gap list (FOOD-10/12, UI-02, EDGE-02)
**Build note:** Confirm real `plans/<date>.md` format against a live sample BEFORE writing the parser (per spec §5g) — done in STATE.md "SMC plan format — confirmed"; Plan 04-02 re-confirms the single-day `**Food:**` branch against fixtures.
**Scope re-map (D-01):** FOOD-02 satisfied by the app-owned meal-definition table, NOT a `meal_pool.md` (which does not exist). Parser reads SMC for scheduled meal NAMES + window only.
**UI hint:** yes

### Phase 5: Surplus Router + Unified Dashboard
**Goal:** Ian opens the dashboard and sees — at a glance — month-to-date income vs both floors, protected vs discretionary spend split, current surplus, and the recommended next sweep (EF-first, gradual, recommendation-only). When projection is below the defended line, the sweep recommendation is replaced by the backfill alert.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** SURP-01, SURP-02, SURP-03, SURP-04, SURP-05, SURP-06, SURP-07, SURP-08, SURP-09, UI-01, UI-06, EDGE-04
**Success Criteria** (what must be TRUE):
  1. On any income entry, surplus is computed as `projected_month − passive_floor − protected_obligations` and displayed on the dashboard
  2. EF 3-mo and 6-mo targets (3× and 6× survival_floor) display on the funds surface and recompute when survival_floor inputs change
  3. Dashboard shows a recommended sweep ("Transfer $X to VMFXX to advance the 3-month EF target") with NO "execute" affordance — recommendation only
  4. When projected month income is below $3,000, the dashboard shows the backfill alert INSTEAD of a sweep recommendation
  5. Ian can record a pending EF sweep (`amount, expectedDate, status=pending`) and later mark it `done`; targets recompute accordingly
  6. On EF withdrawal entry, targets recompute and the next sweep re-prioritizes; the app does NOT recommend selling invested assets to refill
  7. Dashboard is readable on Ian's phone (responsive layout); all critical numbers visible without horizontal scroll
**Plans:** TBD
**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Storage, Deploy | 3/3 | Complete | 2026-05-28 |
| 2. Income Model with Two Floors | 0/5 | Planned | - |
| 3. Expense Model + Sinking Funds | 3/3 | Complete   | 2026-05-29 |
| 4. Food Contract (Locked Floor) | 0/5 | Planned | - |
| 5. Surplus Router + Unified Dashboard | 0/? | Not started | - |

---

## Coverage Summary

| Category | Count | Phase(s) |
|----------|-------|----------|
| FOUND-01..06 | 6 | Phase 1 |
| INC-01..08 | 8 | Phase 2 |
| EXP-01..07 | 7 | Phase 3 |
| FOOD-01..13 | 13 | Phase 4 |
| SURP-01..09 | 9 | Phase 5 |
| UI-01..06 | 6 | UI-05→P1, UI-03→P2, UI-04→P3, UI-02→P4, UI-01+UI-06→P5 |
| EDGE-01..06 | 6 | EDGE-01+EDGE-05→P2, EDGE-06→P3, EDGE-02+EDGE-03→P4, EDGE-04→P5 |
| DEP-01..03 | 3 | Phase 1 |
| **Total** | **58** | **5 phases** |

Per-phase totals: P1=10, P2=11, P3=9, P4=16, P5=12 → 58 ✓

---

*Last updated: 2026-05-30 (Phase 4 PLANNED — 5 plans, locked food floor C1)*
