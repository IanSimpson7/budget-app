# Budget App

## What This Is

A single-user React budgeting web app for Ian: a **floor-vs-actual dashboard** with a **pay-yourself-first surplus router**. Tracks variable commission income against a conservative passive floor and a defended-line backfill trigger, categorizes expenses as protected vs. discretionary, and recommends (but never executes) surplus sweeps to the emergency fund. The protected food floor is structurally locked — sourced read-only from a separate meal-planner system, never editable downward — because the user is in BED recovery and food restriction is the clinical trigger.

## Core Value

**Show Ian where this month's income stands against the floor that matters, and where surplus should go first — without ever pressuring food or moving money.**

## Requirements

### Validated

(None yet — ship to validate)

### Active

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full v1 list with REQ-IDs. Categories:

- [ ] **Data foundation** — IndexedDB persistence behind a storage abstraction, JSON export/import
- [ ] **Income model** — biweekly net checks, two floors (passive ~$2,400→$2,900, defended $3,000), manual + paste-parse entry
- [ ] **Expense model** — protected (fixed + food floor + flavor line) vs gateable (discretionary food + non-food), generic sinking-fund primitive
- [ ] **FoodNeed contract** — read `meal_pool.md` + `plans/<date>.md` from SMC, ingredient-keyed pricing, manually-edited unit-cost map, locked protected floor with fallback-high
- [ ] **Surplus router** — EF-first sequence (3-mo → 6-mo target), gradual sweep, recommendation-only
- [ ] **Dashboard + UI** — five surfaces (Dashboard, Food panel, Entry, Funds, Backup)
- [ ] **Deploy** — GitHub Pages static build, phone-readable (entry from laptop, view-only from phone via JSON sync)

### Out of Scope

- **Bank/brokerage API integration** — violates inviolable constraint #2 (no credentials, ever). Manual entry only.
- **Money movement / trade execution** — violates inviolable constraint #3 (app recommends, Ian executes).
- **Suggesting food floor cuts** — violates inviolable constraint #1 (food floor never gateable).
- **Live meal-planner wiring** — v1 reads SMC output files only (one-way), live integration is v2.
- **Screenshot OCR ingestion** — v1 uses paste-parse for transactions; OCR is v2 fast-follow.
- **Itemized receipt parser** — unit-cost map is manually edited in v1; receipt OCR is v2.
- **Forecasting / scenario modeling** — v2.
- **Relocation modeling** — v2 (loss of ~$1,000/mo non-taxable stream on relocation).
- **Multi-user / auth** — single-user app, no accounts.
- **Backend server** — local-only; if added later, no credential storage.
- **Cross-device sync** — IndexedDB is per-device by design; JSON export/import is the sync mechanism (no backend = no sync server).

## Context

### Who & why
Ian is a personal trainer with variable commission-based biweekly net income, currently in a deliberate trough while reallocating hours to other projects. No debt, pays credit card monthly, invests in index funds/ETFs only. No formal budget exists. The two real risks the app must structurally address:
1. **Building plans on optimistic income** → solvency against the conservative passive floor, never the average.
2. **Any system pressuring food** → BED recovery; restriction is the clinical trigger. Food floor is locked.

### Spec source of truth
Build spec: [`../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md`](../../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md) (v1, 2026-05-27, ready to build). Build-session boot: `budget_app_build_CLAUDE.md`. All numbers in the spec are working values; floors and food floor are editable parameters that converge from receipts and check data.

### Meal-planner integration
The food floor is computed from the SMC (Schedule-Meal-Coordinator) system at [`../../schedule-meal-coordinator/`](../schedule-meal-coordinator/). Read-only, one-way: budget app reads `meal_pool.md` (closed meal set with `ingredients` lists) and `plans/<date>.md` (scheduled meals). SMC has zero awareness of money — this asymmetry IS the BED-safety guarantee (cost-minimized food selection drifts toward binge foods).

### Repo posture
Standalone nested repo at `projects/budget-app/.git`, pushed to its own GitHub remote (separate from the workspace repo). Workspace `.gitignore` excludes this folder so it isn't double-tracked.

## Constraints

### Inviolable (NEVER break, any version, any reason)

- **C1 — Food floor protection**: Never gate, reduce, or suggest cutting the protected food floor. The app may compress *discretionary food volume above the floor*; the floor itself is structurally non-editable downward in the UI. Restriction is the BED clinical trigger.
- **C2 — No credentials**: No bank/brokerage API, no stored passwords, no live account linking. All data enters manually (typed, paste-parsed, OCR later). If a backend is ever added, it must not store credentials.
- **C3 — No money movement**: App computes and recommends allocations. Ian executes every transfer himself. App is advisor, never actor. No trade execution, no transfers, no auto-routing.

### Design

- **Tech**: Vite + React (web app, not single-file artifact). Component structure, state management, responsive. TypeScript strongly preferred for the contracts (FoodNeed, Floors, SurplusPlan).
- **Persistence**: IndexedDB behind a storage abstraction; JSON export/import for backup. Local-only.
- **Deploy**: GitHub Pages static build. Phone is view-mostly; laptop is data source-of-truth.
- **Derived values recompute**: survival floor, EF targets, surplus, food floor — never stored as stale copies.
- **One generic sinking-fund primitive**: future instances (car fund, etc.) are zero-rework.
- **Solvency math uses the passive floor, never the average or the $3,000 defended line.**
- **Two floors, two jobs**: passive floor for solvency math, $3,000 for backfill-trigger alerts.
- **Budget on 2 checks/month**: extra (3rd) check in a month is surplus, never new baseline.

### Calibration

User operates at systems-architect level. Make independent architectural decisions, debug via refinement cycles, explain mechanisms over outcomes. Depth over speed. Leverage-pause on the single most determinative decision (state/data-model architecture) before proceeding.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Nested git repo under `projects/budget-app/`, separate GitHub remote | Brief calls it a "build repo"; standalone repo simplifies push & GH Pages deploy | — Pending |
| GitHub Pages static deploy | Phone view-access without backend; consistent with no-credentials constraint | — Pending |
| Manual unit-cost map UI (no receipt parser in v1) | ~20 slow-changing items; parser is high OCR fragility for low payoff; v2 candidate | — Pending |
| Skip project-level GSD research (4-agent ecosystem dive) | Spec v1 already supplies stack, features, architecture, pitfalls in locked form; per-phase research stays enabled | — Pending |
| Vite + React + TypeScript | Spec recommendation; TS strengthens the FoodNeed/Floors/Surplus contracts | — Pending |
| IndexedDB for working state | Spec §7b; per-device by design; sync via JSON export/import | — Pending |
| Read SMC files via relative workspace path (`../schedule-meal-coordinator/plans/`) | One-way read-only; no copying/symlinking; budget app is non-portable by design (it lives inside Ian's workspace) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-27 after initialization*
