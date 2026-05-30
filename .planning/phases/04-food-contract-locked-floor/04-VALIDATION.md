---
phase: 04
phase_slug: food-contract-locked-floor
created: 2026-05-29
source: RESEARCH.md Validation Architecture
---

# Phase 04 Validation Strategy

**Purpose:** Define HOW to prove the phase's critical mechanisms before they're built. Derived from RESEARCH.md's Validation Architecture section. Consumed by gsd-planner (validation tasks) and gsd-verifier (Dimension 8 checks).

Each validation point targets a mechanism whose failure would **silently corrupt the protected food floor** — the C1-critical surface. A floor that is silently too low is a C1 breach (restriction is the BED clinical trigger). Every gap must fall back high and be flagged, never silent.

---

## Validation Requirements

### V1: SMC plan parser

**Risk:** Floor computed from wrong/missing meals → silent undercount (C1 breach).
**Mechanism:** Extract scheduled meal names + plan window from SMC frontmatter and per-slot `**Food:**` lines, across single-date `YYYY-MM-DD.md` and date-range `YYYY-MM-DD--YYYY-MM-DD.md` filenames.
**Method:** test (unit) — parse 5 live SMC fixtures copied into `src/domains/food/__fixtures__/`.
**Success signal:** All 14 known meal strings extracted; window dates correct; 0 dropped slots.
**When:** wave-0

### V2: Ingredient tokenizer

**Risk:** Mis-tokenized ingredient → unpriced or mispriced → wrong floor.
**Mechanism:** Split prose meal strings on mixed separators (`,` / "and" / "with"); flag non-decomposable whole-meal items.
**Method:** test (unit) — tokenize the 14-meal corpus, assert expected ingredient sets.
**Success signal:** "Chicken, rice, and broccoli" → [chicken, rice, broccoli]; "Qdoba bowl" → non-decomposable flag.
**When:** wave-0

### V3: Cost engine fallback-high

**Risk:** Silent $0 or undercount → floor too low → C1 breach.
**Mechanism:** Unpriced ingredient, undefined meal, and unset flat meal-cost ALL fall back to a conservative high value, never $0, each carrying a flag.
**Method:** test (unit, table-driven) — feed each of the three gap triggers.
**Success signal:** Each gap yields the fallback-high ceiling value AND a flag; never 0, never undercount.
**When:** wave-0

### V4: Monthly floor derivation

**Risk:** Wrong monthly extrapolation → floor too low.
**Mechanism:** Monthly floor = daily-average cost × days-in-current-month; partial windows (1-day, 7-day) handled, not a literal sum of scheduled days.
**Method:** test (unit) — 1-day plan and 7-day plan both yield a full-month figure.
**Success signal:** 1-day plan × ~30.4 ≈ monthly; 7-day avg × ~30.4 ≈ monthly; no undercount.
**When:** wave-0

### V5: Fallback `max(last, high-water)` on stale/missing plan

**Risk:** Floor drops on a gap → C1 breach.
**Mechanism:** When no current plan covers today, displayed floor = `max(last-computed, all-time high-water)` + staleness flag; live value may still legitimately move down when real data exists.
**Method:** test (unit + property-style) — stale plan → assert displayed = max(last-computed, high-water); for any (last, high-water, stale) combo, displayed ≥ max(last, high-water).
**Success signal:** Stale state shows max value, never lower; stale flag present.
**When:** wave-0

### V6: C1 structural lock — no downward-edit path

**Risk:** Any writable floor field = C1 breach.
**Mechanism:** No `setFoodFloor`/equivalent method exists on the storage surface; `foodFloorMeta` has no writable floor field; the rendered floor is a read-only `<span>`, never an `<input>`.
**Method:** test (absence-proof, extending the existing storage.test.ts forbidden-method pattern) + type assertion.
**Success signal:** grep/type assertion: 0 downward-write paths exist anywhere.
**When:** wave-0

### V7: survivalFloorAtom integration

**Risk:** Survival floor uses stale seed → wrong solvency math.
**Mechanism:** The computed `foodFloorAtom` replaces the `floors.foodSeed` term in `survivalFloorAtom`; a change to meal cost propagates through.
**Method:** test (unit) — change a meal cost → assert `survivalFloorAtom` recomputes.
**Success signal:** foodFloor change propagates to `survivalFloorAtom` output.
**When:** during-implementation

### V8: import.meta.glob build-time load

**Risk:** 0 files bundled → app silently shows fallback always (and Ian never realizes the live floor isn't live).
**Mechanism:** SMC plan files are bundled as raw strings at Vite build time via `import.meta.glob`; CI (no SMC checkout) legitimately resolves 0 files → fallback state.
**Method:** smoke test — assert glob resolves >0 plan files in a local build; document CI=fallback in README/Wave-0 task.
**Success signal:** Local build logs N>0 plan files loaded; CI-fallback behavior documented so the deployed-stale state is understood, not a surprise.
**When:** wave-0

---

## Sampling / Coverage Notes

- **Parser fixtures:** copy 5 live SMC plan files into `src/domains/food/__fixtures__/` as read-only snapshots (do NOT symlink to the live SMC dir — tests must be hermetic).
- **Cost engine:** table-driven tests covering all three fallback-high triggers (unpriced ingredient, undefined meal, unset flat meal cost).
- **C1 absence-proof:** extend the existing `storage.test.ts` absence-proof pattern (the test that asserts forbidden methods don't exist).
- **Floor never-lower invariant:** property-style test — for any (last, high-water, stale) combo, displayed ≥ max(last, high-water).

---

*Validation tasks are derived from this strategy during planning. Each becomes a checkable acceptance criterion (Nyquist Dimension 8).*
