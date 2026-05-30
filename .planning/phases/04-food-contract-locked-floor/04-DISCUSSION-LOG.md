# Phase 4: Food Contract (Locked Floor) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 4-food-contract-locked-floor
**Areas discussed:** Meal→ingredient source, Non-decomposable meals, Monthly floor from short plans, Locked-line + discretionary UI

**Premise challenge raised before discussion:** Spec §5b / FOOD-02 assume an SMC `meal_pool.md` with per-meal ingredient lists. Codebase scout of `../schedule-meal-coordinator/` confirmed no such file exists and SMC is ingredient/money-blind by design — so the meal→ingredient decomposition has no upstream source. This reframed the leverage decision below.

---

## Meal → Ingredient Source (LEVERAGE)

| Option | Description | Selected |
|--------|-------------|----------|
| App-owned meal table | App stores `{mealName → ingredient[]}`, seeded from ~14 known meals; parser extracts meal NAMES and joins. SMC decoupled; `meal_pool.md` never required. Re-maps FOOD-02. | ✓ |
| Tokenize meal names | Split prose meal strings on separators at read time; no manual table. Fragile (breaks on "Qdoba bowl"). | |
| Block on SMC pool | Treat phase as blocked until SMC emits a real pool. Contradicts SMC design; stalls indefinitely. | |

**User's choice:** App-owned meal table.
**Notes:** Preserves the spec's "ingredient-keyed, never meal-keyed" intent while surviving the absent pool; ~14 rows is trivial to maintain.

**Follow-up — Undefined meal name handling:**

| Option | Description | Selected |
|--------|-------------|----------|
| Stub + fallback-high | Auto-create stub flagged "needs ingredients", price high until filled. | ✓ |
| Flag only, exclude | Flag but exclude from sum — understates floor (violates C1). | |
| Hard error | Refuse to compute until every meal defined — brittle. | |

**User's choice:** Stub + fallback-high. Honors C1, makes the gap loud, floor always computes.

**Follow-up — Portion granularity:**

| Option | Description | Selected |
|--------|-------------|----------|
| Global per ingredient | One portion per ingredient (spec §5c as written). ~20 rows. | ✓ |
| Per meal-ingredient | Portion per (meal, ingredient) pair — more accurate, N× cells. | |
| Global + per-meal override | Hybrid — best accuracy/effort but most complex. | |

**User's choice:** Global per ingredient. Floor is a conservative monthly aggregate, not a per-meal invoice — variation washes out.

---

## Non-Decomposable Meals

| Option | Description | Selected |
|--------|-------------|----------|
| Flat meal-cost field | Meal row is EITHER ingredient-decomposed OR a flat editable cost (Qdoba bowl). | ✓ |
| Flat cost, fallback-high default | Same field but new non-decomposable meals default high + flagged until set. | |
| Fallback-high only | No flat field; permanently priced at ceiling — permanently inaccurate. | |

**User's choice:** Flat meal-cost field.
**Notes:** Reconciled with the undefined-meal rule — an unset flat cost falls back high until set (captured as D-04).

**Follow-up — Flavor/condiment split (§5d):**

| Option | Description | Selected |
|--------|-------------|----------|
| Tag in unit-cost map | Each ingredient tagged macro-bearing vs flavor; meal cost = Σ macro-bearing only. | ✓ |
| Omit from meal table | Just don't list flavor ingredients — implicit, easy to forget. | |
| Separate exclusion list | Standalone excluded-ingredients list — third list to keep in sync. | |

**User's choice:** Tag in unit-cost map. Single source of truth per ingredient, matches §5c "macro-bearing" language.

---

## Monthly Floor From Short Plans

| Option | Description | Selected |
|--------|-------------|----------|
| Daily-avg × days-in-month | Mean daily cost across plan-covered days × ~30.4. Robust to any window size. | ✓ |
| Representative week × 4.33 | Requires a full week; breaks on 1–4 day windows. | |
| Sum scheduled days only | Literal sum — undercounts a monthly line (violates C1). | |

**User's choice:** Daily-avg × days-in-month.

**Follow-up — Fallback value (§5e "never lower"):**

| Option | Description | Selected |
|--------|-------------|----------|
| max(last-computed, high-water) | Persist both; live plan may drop, stale/missing uses the max. | ✓ |
| Last-known only | One field; inherits an anomalously cheap last day. | |
| High-water only | Always all-time max; ratchets permanently upward. | |

**User's choice:** max(last-computed, high-water). Matches §5e exactly; live floor can still move down on real data.

**Follow-up — Staleness trigger:**

| Option | Description | Selected |
|--------|-------------|----------|
| No window covers today | Current iff a plan's date/window includes today; else stale. No tunable knob. | ✓ |
| Window + max-age guard | Window-covers-today plus a configurable generated_at age guard. | |
| generated_at age only | Pure age threshold; ignores whether a plan covers now. | |

**User's choice:** No window covers today. Uses SMC frontmatter window directly.

---

## Locked-Line + Discretionary UI

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only derived + inputs elsewhere | Floor is computed read-only (lock icon + explainer); inputs on a separate config surface, never a budget lever. | ✓ |
| Inline-locked with disclosure | Floor with lock badge; tapping reveals editable inputs in-place. | |
| You decide | Capture only the hard rule, leave treatment to planning. | |

**User's choice:** Read-only derived + inputs elsewhere. The derived-value architecture IS the C1 enforcement.

**Follow-up — Discretionary food layer source (UI-02):**

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 3 gateable food lines | Pull existing food + gateable expense lines; pure presentation join. | ✓ |
| New discretionary-food input | Dedicated field — duplicates Phase 3 classification, double-count risk. | |
| Placeholder, defer to Phase 5 | Stub the layer until Phase 5. | |

**User's choice:** Reuse Phase 3 gateable food lines. No new data model.

**Follow-up — Flag presentation (FOOD-08/FOOD-11 + undefined meal):**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline badge + detail list | Single green/amber badge expanding to an itemized list of each gap. | ✓ |
| Separate flags per condition | Three always-visible callouts — noisier. | |
| You decide | Capture only the hard rule, leave layout to planning. | |

**User's choice:** Inline badge + detail list. Readable at a glance, every gap individually addressable, never silent.

---

## Claude's Discretion

- Exact schema/field names for the meal-definition table, unit-cost map (with macro/flavor tag), and portion model.
- The concrete fallback-high ceiling strategy (most-expensive-defined-meal vs configurable constant).
- Plan-file parser mechanics (single-date vs date-range filenames, frontmatter window extraction, `**Food:**` extraction).
- Food-panel and config-surface routing/placement within the existing HashRouter.
- Exact lock-treatment visuals (icon, copy, badge colors) within UI-design-principles.

## Deferred Ideas

- Live SMC wiring (SMC-01 → v2).
- Itemized receipt parser / OCR for unit-cost convergence (OCR-02 → v2).
- Discretionary-food gating UI + soft caps (→ Phase 4/5 surplus work).
- Per-(meal,ingredient) portion overrides (considered, deferred — D-03 chose global for v1).
