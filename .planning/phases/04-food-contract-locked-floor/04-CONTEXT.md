# Phase 4: Food Contract (Locked Floor) - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

> **Path convention:** all relative paths below are from the project root
> `projects/budget-app/` (where the researcher/planner/executor operate),
> NOT from this file's location.

<domain>
## Phase Boundary

**What this phase delivers:** Ian sees the protected food floor rendered as a locked, rent-like line in every budget view — computed live from his scheduled meals, ingredient-keyed, with explicit flags for unpriced ingredients, undefined meals, and stale/missing plans (fallback-high, never lower). The unit-cost map and portion model are editable in-UI for accuracy/convergence. The flavor/condiment line shows as a separate fixed ~$50/mo protected amount. The gateable discretionary food layer renders beside the locked floor.

**In scope (REQ-IDs):** FOOD-01..FOOD-13, UI-02, EDGE-02, EDGE-03

**⚠ Load-bearing scope re-map (read before planning):** Spec §5b / FOOD-02 instruct the app to parse an SMC `meal_pool.md` keyed by `###` header with an "exhaustive ingredients list explicitly intended for this app." **That artifact does not exist and will not exist.** Verified against the live SMC project (`../schedule-meal-coordinator/`, 2026-05-29):
- No `meal_pool.md` anywhere. The only pool definition is prose food-name lists in `MEAL_PLAN_AGENT_BRIEFING.md`, explicitly authored as *"food items only, no weights."*
- `plans/*.md` carry prose meal-name strings only ("Greek yogurt with granola and berries", "Qdoba bowl") — no ingredients, no quantities, no cost.
- SMC is **ingredient/money-blind by design** (§5a) — this asymmetry IS the BED-safety guarantee; SMC will not emit ingredient/pricing data.

**Therefore FOOD-02 is re-mapped (D-01):** the meal→ingredient decomposition lives in an **app-owned meal-definition table**, not parsed from SMC. The app reads SMC only for **scheduled meal names** (and the plan window). This satisfies the *intent* of FOOD-01/02/06/07/09 (ingredient-keyed, never meal-keyed, live-recompute) without depending on a non-existent file. Do not chase `meal_pool.md`.

**Out of scope (explicit, not just "later"):**
- **Live SMC wiring (SMC-01)** — v1 reads files via the relative workspace path only; no running-system integration.
- **Receipt OCR / itemized parser (OCR-02)** — refinement of the unit-cost map is MANUAL in v1 (§5f). No automated parser.
- **Discretionary-food gating UI / soft caps** — Phase 4 only *displays* the gateable food layer beside the locked floor (UI-02); the gating/cap interventions belong to Phase 5 surplus work.
- **Surplus router, EF targets, full dashboard split** — Phase 5.
- **Writing to or triggering SMC** — forbidden by §5a/C1; the integration is strictly one-way read-only.

</domain>

<decisions>
## Implementation Decisions

### Meal → Ingredient Source (FOOD-01, FOOD-02, FOOD-06, FOOD-09 — re-mapped)

- **D-01: App-owned meal-definition table is the source of meal→ingredient decomposition.** The app stores `{ mealName → ingredient[] }` in its own editable table, seeded from the ~14 known meal-name strings (see Specific Ideas). The plan parser's only job against SMC is to extract **scheduled meal NAMES** (and the plan window) and join them to this table. SMC stays a pure name scheduler; `meal_pool.md` is never required. This preserves the spec's "ingredient-keyed, never meal-keyed" intent (§5c) while surviving the missing/absent SMC pool. **FOOD-02 acceptance is satisfied by the app-local meal table, not by parsing an SMC pool file.**
- **D-02: Undefined meal name → stub + fallback-high (C1 never-undercount).** When the parser encounters a scheduled meal name with no row in the meal table (SMC added a new meal, or Ian hasn't entered it), the app auto-creates a stub row flagged "undefined meal — needs ingredients" and prices that meal at a conservative high-water value (e.g. the most expensive defined meal, or a configurable ceiling — planner's call) until Ian fills it in. The floor always computes; the gap is loud, never silent. Mirrors the unpriced-ingredient guard (FOOD-08).
- **D-03: Portion model is GLOBAL per ingredient** (`{ ingredient → typical portion }`), per spec §5c as written — one portion per ingredient reused across every meal. ~20 rows, smallest schema, lowest maintenance. Per-meal portion accuracy is deliberately traded away because the floor is a conservative monthly aggregate, not a per-meal invoice — day-to-day variation washes out over a month.

### Non-Decomposable Meals & Flavor Split (FOOD-06, FOOD-08, FOOD-10, EDGE-03)

- **D-04: Each meal row is EITHER ingredient-decomposed OR carries a flat editable meal-cost field.** Restaurant/whole-meal items ("Qdoba bowl") that don't split into priceable ingredients get a flat editable cost (e.g. $11). The cost engine sums ingredient-cost for decomposed meals and flat-cost for the rest. An **unset flat cost falls back high** (consistent with D-02's undefined-meal rule) and is flagged "needs cost" until set — never $0, never undercount.
- **D-05: Flavor/condiment exclusion via a tag in the unit-cost map.** Each ingredient in the unit-cost map carries a `macro-bearing` vs `flavor/condiment` tag. **Meal cost = Σ over macro-bearing ingredients only** (§5c language); flavor-tagged ingredients (syrups, sauces — e.g. syrup inside "Protein slop") are skipped in per-meal pricing because they're covered by the separate flavor line. Single source of truth per ingredient, decided once. The flavor line itself (FOOD-10) is a separate fixed ~$50/mo PROTECTED amount, editable, excluded from per-meal pricing.

### Monthly Floor Derivation & Fallback (FOOD-07, FOOD-11, EDGE-02)

- **D-06: Monthly floor = daily-average cost × days-in-current-month.** Compute the mean daily food cost across the days the current plan(s) cover (5 meals/day structure is stable), then multiply by the number of days in the current month (~30.4). Handles partial windows (1-day or 7-day plans alike), smooths day-to-day variation, always yields a full-month figure. NOT a literal sum of only the scheduled days (that would undercount a monthly line — violates C1).
- **D-07: Fallback value = `max(last-computed floor, all-time high-water mark)`.** Persist BOTH the last successfully-computed floor AND an all-time high-water mark. When a current plan exists → display the live computed value (may legitimately move DOWN if real data says so). When stale/missing → display `max(last-computed, high-water)`, flagged stale. Matches §5e "never a lower number" on a gap without ratcheting the live floor permanently upward.
- **D-08: Staleness trigger = no plan window covers today.** A plan is "current" iff some plan file's date or `[window_start, window_end]` window includes today's date; otherwise stale/missing → fallback (D-07) + staleness flag. Uses the SMC frontmatter window directly — no arbitrary age threshold to tune.

### Locked-Line & Discretionary UI (FOOD-12, UI-02, FOOD-04, FOOD-05, FOOD-08, FOOD-11)

- **D-09: Floor renders as a read-only DERIVED value; inputs live on a separate config surface.** The protected floor has NO input control on it — it's a computed read-only number with a lock icon + "computed from your meal plan — protected" explainer. The editable inputs (unit-cost map, portion model, meal-definition table) live on a separate config surface, editable **for accuracy/convergence only**, never framed as a budget lever. No control anywhere edits the floor number directly or suggests trimming it. **The derived-value architecture IS the C1 enforcement** — there is structurally no downward-edit affordance to remove.
- **D-10: Discretionary food layer reuses Phase 3 gateable food expense lines.** UI-02's side-by-side gateable layer is a **pure presentation join**: the food panel pulls existing expense lines categorized as food + `gateable` (already modeled in Phase 3) and totals them beside the locked floor. No new data model — avoids double-counting against the expense model.
- **D-11: Three uncertainty conditions surface via one status badge + expandable detail list.** A single status badge on the floor line (green = clean / amber = needs attention) expands to an itemized list naming each unpriced ingredient (FOOD-08), undefined meal (D-02), and the staleness reason (FOOD-11). One glance for trust, one tap for specifics traceable to its fix. Hard rule: every uncertainty condition is visibly flagged and individually identifiable — never silent.

### Claude's Discretion

- Exact schema/field names for the meal-definition table, unit-cost map (with macro/flavor tag), and portion model — planner/executor finalize against existing `src/storage/schema.ts` conventions. Likely new schema version v3→v4 with pure-function migration shared by Dexie upgrade + JSON import (Phase 1 pattern).
- The concrete fallback-high ceiling value/strategy in D-02/D-04 (most-expensive-defined-meal vs configurable constant) — planner's call, must never undercount.
- Plan-file parser mechanics: handling single-date `YYYY-MM-DD.md` AND date-range `YYYY-MM-DD--YYYY-MM-DD.md` filenames, frontmatter window extraction, and pulling the `**Food:**` meal-name string per slot (see STATE.md "SMC plan format — confirmed").
- Routing/placement of the food panel and the config surface within the existing HashRouter (`/dashboard`, `/entry`, `/expenses`, `/funds`) — executor's call within UI-design-principles + existing primitives.
- Exact lock-treatment visuals (icon, copy, badge colors) within UI-design-principles — D-09/D-11 fix the behavior, not the pixels.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**
*(Paths are relative to project root `projects/budget-app/`.)*

### Project specs (load-bearing — read in full)
- `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` — Full v1 spec. **Core section for this phase: §5 The FoodNeed Contract** (§5a direction & BED-safety guarantee → FOOD-01/C1; §5b what the app reads → re-mapped by D-01; §5c ingredient-keyed pricing model → FOOD-06, D-03/D-05; §5d flavor/condiment line → FOOD-10, D-05; §5e protected treatment + fallback-high → FOOD-11/12, D-07/D-09; §5f seed ~$550 + MANUAL refinement → FOOD-13, no OCR; §5g build note → confirm plan format, already done in STATE.md). Also §8 data model (`FoodNeed`, unit-cost map, portion model shapes — refine in build), §11 edge cases.
- `../../roles/FinancialAdviser/specs/budget_app_build_CLAUDE.md` — Build boot doc: inviolable constraints C1/C2/C3. **C1 (food floor never gated/reduced/cut) is the direct driver of D-02/D-04/D-07/D-09** — the floor must err high and have no downward affordance.

### Project-level planning artifacts
- `.planning/PROJECT.md` — Core value, C1/C2/C3, key decisions log, §12 provisional values (food floor ~$550, flavor line ~$50 — both editable params).
- `.planning/REQUIREMENTS.md` — Phase 4 covers FOOD-01..13, UI-02, EDGE-02, EDGE-03. Note the FOOD-02 re-map above.
- `.planning/ROADMAP.md` — Phase 4 goal + 7 success criteria (the verification target).
- `.planning/STATE.md` — **"SMC plan format — confirmed (2026-05-29)" block is REQUIRED reading** — documents the live plan-file format (single-date + date-range filenames, frontmatter fields, `**Food:**` prose strings, no pricing, non-decomposable "Qdoba bowl", the 14-meal corpus). Also the dated follow-up: bump GitHub Actions major tags before 2026-06-02 (an armed scheduled agent handles it on 2026-06-01 — do not duplicate).
- `.planning/phases/03-expense-model-sinking-funds/03-CONTEXT.md` — Phase 3 decisions. **D-09 (food-floor placeholder = `floors.foodSeed`) is the clean-handoff slot the computed floor swaps into.** Survival floor = `fixed_ex_food + protected_food_floor`; Phase 4 replaces the seed term with the computed floor. EXP-07 whey/supplement belongs to the food floor, not fixed-ex-food.
- `.planning/phases/01-foundation-storage-deploy/SKELETON.md` — Architectural source of truth for Phases 2–5 (per project CLAUDE.md).
- `.planning/phases/01-foundation-storage-deploy/01-CONTEXT.md` — Phase 1 decisions: storage abstraction, Dexie schema versioning single-source-of-truth migrations, Jotai atoms, T-01-08 boundary (`floors.foodSeed` editable both ways; the C1 lock applies to the `settings['foodFloor']` singleton specifically).

### SMC integration source (read-only inputs)
- `../schedule-meal-coordinator/plans/*.md` — live plan files (e.g. `2026-05-21.md`). The app reads scheduled meal NAMES + plan window from frontmatter. **Read-only — never written or triggered.**
- `../schedule-meal-coordinator/docs/schemas/plan-v1.2.md` — plan file schema (frontmatter + slot structure) for the parser.
- **There is NO `meal_pool.md`** — do not look for it (see Phase Boundary re-map).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/storage/storage.ts` — the ONLY persistence surface domain code imports. Phase 4 **adds CRUD for the meal-definition table, unit-cost map (with macro/flavor tag), and portion model here.** C1/C2/C3 enforced by the *absence* of forbidden methods — keep that property; the food-floor value is derived, never a stored editable field.
- `src/storage/schema.ts` + `src/storage/db.ts` — add `FoodNeed`-related types and bump `CURRENT_SCHEMA_VERSION` (v3→v4) with a paired `MIGRATIONS` entry; pure-function migration shared by Dexie upgrade + JSON import. Extend `collectSchemaV1Data`/`replaceAll` so the new tables round-trip in backups.
- `src/domains/expenses/expenses.atoms.ts` + `src/domains/settings/settings.atoms.ts` — `floors.foodSeed` and the `survivalFloorAtom` chain (Phase 3 D-08) are the integration target. The computed food floor replaces `floors.foodSeed` as the protected-food term. Discretionary layer (D-10) reads existing gateable food expense lines.
- `src/domains/income/income.atoms.ts` — the derived-atom recompute pattern + `atomWithObservable + liveQuery` to copy for the new `src/domains/food/` domain (colocated atoms, no central store).
- UI primitives: `NumberInput`, `PrimaryButton`, `SecondaryButton`, `DestructiveButton`, `Toast`, `AppShell` — reuse for the config-surface tables and the food panel.

### Established Patterns
- Jotai derived atoms = the FOOD-06/FOOD-07 recompute mechanism: a `foodFloorAtom` derives over (meal table + scheduled plan + unit-cost map + portion model), recomputing live (FOUND-06) when any input changes; the floor is NEVER stored as a stale copy (last-computed + high-water ARE persisted, per D-07, but the live value is always derived).
- Migrations are pure functions shared by Dexie upgrade + JSON import — single source of truth (Phase 1 D-09).
- All UI tokens from `tailwind.config.ts` (no inline hex); financial values `font-mono`; interactive elements `min-h-[44px]`; no `localStorage`/`sessionStorage`.

### Integration Points
- New `src/domains/food/` domain (atoms + plan parser + cost engine).
- New food panel + config surface routes on the existing HashRouter.
- Replace the `floors.foodSeed` term in `survivalFloorAtom` with the computed `foodFloorAtom`.
- Schema migration v3→v4 for the meal table / unit-cost map / portion model + persisted last-computed/high-water values.
- Read-only file access to `../schedule-meal-coordinator/plans/` for scheduled meal names.

</code_context>

<specifics>
## Specific Ideas

- **Seed meal corpus (~14 known meal-name strings, as of 2026-05-29)** for the meal-definition table: Cereal and milk · Chicken, rice, and broccoli · Eggs and PB toast · French Toast and Eggs · Greek yogurt with granola and berries · Oatmeal and protein slop · Oatmeal cream pie and banana · Pasta, beef, cheese, green beans · Protein Slop and Granola · Protein shake and banana · Qdoba bowl · Rice cakes with peanut butter and banana · Sweet potato, beef, cheese, green beans · Turkey sandwich with cheese and green beans. ("Qdoba bowl" is the non-decomposable flat-cost test case, D-04.)
- **Unit-cost map seed values (§5c, warehouse-club):** 90/10 ground beef ~$5.80/lb, chicken breast ~$2/lb, bulk whey; the rest estimated and refined manually.
- **Portion model basis (§5c):** Ian's targets — 170 g protein/day, ~3,000 kcal/day, 5 meals/day.
- **Food floor seed ~$550/mo** (bottom-up est. ~$365–500; seeded above per never-under-budget rule). Editable upward, with a `lastRefinedFromReceipts` timestamp visible to the user (FOOD-13).
- **Flavor line seed ~$50/mo**, editable, PROTECTED, excluded from per-meal pricing (FOOD-10, D-05).
- Inviolable constraints propagate structurally, not by comment: the food floor is derived & read-only (no downward affordance exists to remove); SMC access is read-only (no write/trigger methods).

</specifics>

<deferred>
## Deferred Ideas

- **Live SMC wiring (SMC-01 → v2).** v1 reads SMC files via relative workspace path only.
- **Itemized receipt parser / OCR for unit-cost convergence (OCR-02 → v2).** v1 refinement is manual in-UI editing of the ~20-item cost map (§5f).
- **Discretionary-food gating UI + soft caps (→ Phase 4/5 surplus work).** §4d names the discretionary food layer (~$1,100/mo) as the primary lever; Phase 4 only *displays* it beside the locked floor (D-10), not the gating/cap interventions (caffeine-pill substitution, bulk-buy, trip consolidation).
- **Per-(meal,ingredient) portion overrides (considered, deferred).** D-03 chose global-per-ingredient portions for v1; per-meal accuracy can be revisited if the monthly aggregate proves too coarse against receipts.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 4-Food-Contract-Locked-Floor*
*Context gathered: 2026-05-29*
