---
phase: 02-income-model-with-two-floors
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/components/EntryTabBar.tsx
  - src/components/IncomeBar.tsx
  - src/components/MetricCard.tsx
  - src/domains/income/BackfillAlertCard.tsx
  - src/domains/income/CheckEntryForm.tsx
  - src/domains/income/ConfirmTable.tsx
  - src/domains/income/PasteParseFlow.tsx
  - src/domains/income/SourceAutocomplete.tsx
  - src/domains/income/classify.ts
  - src/domains/income/income.atoms.ts
  - src/domains/income/income.types.ts
  - src/domains/income/parser/adapter.types.ts
  - src/domains/income/parser/checkingAdapter.ts
  - src/domains/income/parser/parseStatement.ts
  - src/pages/DashboardPage.tsx
  - src/pages/EntryPage.tsx
  - src/pages/SettingsPage.tsx
  - src/storage/db.ts
  - src/storage/migrations.ts
  - src/storage/schema.ts
  - src/storage/storage.ts
findings:
  critical: 1
  warning: 8
  info: 4
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The income model is well-structured: pure classification functions are cleanly separated from I/O, the storage abstraction boundary is respected (no `db` imports in domain code), the parser uses anchored module-level regexes with a DoS cap, and JSX auto-escaping covers the paste-parse XSS surface. Most security-relevant decisions are sound for a local-first app.

The review surfaced one correctness BLOCKER: the IncomeBar defended-line marker is hardcoded to render the literal `$3k` label regardless of the user-configured defended line, so a user who changes the defended line in Settings sees a marker labeled with the wrong value. Eight WARNINGs cover correctness gaps in the projection/overflow math (mixing total income against a payroll-only threshold), an unwired migration that contradicts the documented contract, missing input validation on import and on the estimate field, and a known-source/auto-check consistency mismatch.

## Critical Issues

### CR-01: Defended-line marker label is hardcoded `$3k`, ignores configured defended line

**File:** `src/components/IncomeBar.tsx:100`
**Issue:** The defended-line tick is positioned dynamically from the `defendedLine` prop (`defendedPct`), but its visible label is the hardcoded string `$3k`. The defended line is user-configurable on the Settings page (`draft.defended`, default 3000 but editable). If the user sets the defended line to any other value (e.g. $4,500), the marker still reads `$3k` while sitting at the $4,500 position — a financial display that actively misrepresents the threshold it marks. This is a data-integrity defect on a money-tracking surface, not a cosmetic one. The header comment at line 8 even hardcodes the `$3k` expectation, baking the wrong assumption into the spec annotation.
**Fix:**
```tsx
// Props already include defendedLine; format it instead of a literal.
const defendedLabel = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(defendedLine)
// ...
<span
  className="absolute -translate-x-1/2 font-sans text-xs text-accent"
  style={{ left: `${Math.min(defendedPct, 99.5)}%` }}
>
  {defendedLabel}
</span>
```

## Warnings

### WR-01: Overflow note compares total income against a payroll-only threshold

**File:** `src/components/IncomeBar.tsx:33-34, 106-111`
**Issue:** `overflowAmount = projectedMonth - defendedLine` where `projectedMonth` is `projectedTotal` (payroll + gift + other, from `projectedTotalAtom`). The defended line is documented throughout the domain as a payroll-only concept (`backfillActiveAtom` uses payroll-only projection precisely so "gift income must NEVER suppress this alert" — Pitfall 4). The overflow note mixes the two: a large one-off gift inflates `projectedMonth` and can trigger an "above defended line" message even when payroll alone is below it. This is the inverse of the Pitfall-4 invariant the codebase otherwise enforces.
**Fix:** Decide the intended semantic. If the overflow note is about the payroll defense, pass and compare `projectedPayroll` (already available on DashboardPage as `projectedPayroll`) rather than `projectedTotal`. If it is genuinely about total income, rename the copy so it does not reference the defended line.

### WR-02: v2 Dexie version has no `.upgrade()` callback — documented migration contract unwired

**File:** `src/storage/db.ts:30-36`, `src/storage/migrations.ts:5-11`
**Issue:** The migrations contract (migrations.ts lines 5-11, step 3) requires every schema bump to add a `.version(N).stores({...}).upgrade(tx => …)` that runs the matching `migrate_*` function. `migrate_1_to_2` exists and seeds `settings.knownSources = []`, but `db.ts` `version(2)` has no `.upgrade()` call, so an existing v1 IndexedDB upgrading in place never runs the migration. It is currently harmless only because `getKnownSources()` defaults to `[]` at runtime — but that makes the migration ladder dead code on the Dexie path and means the documented invariant ("Dexie and the JSON import ladder stay aligned", db.ts line 28) is false. A future migration that is NOT covered by a runtime default will silently fail to apply.
**Fix:** Either wire the upgrade (`this.version(2).stores({...}).upgrade(async (tx) => { /* apply migrate_1_to_2 over settings */ })`) or, if field-only additions truly need no in-place transform, update the contract comment to state that runtime defaults cover v1→v2 and the upgrade callback is intentionally omitted.

### WR-03: `importAll` casts arbitrary income rows to `IncomeCheck` without validation

**File:** `src/storage/storage.ts:225-230`
**Issue:** Imported `data.incomeChecks` is blind-cast `as IncomeCheck[]` and each row added after only stripping `id`. There is no validation that `date`, `netAmount`, `category`, `taxable`, etc. exist or have the right types. A malformed or hand-edited backup injects rows with missing/garbage fields directly into the live store; downstream `reduce((s,c) => s + c.netAmount, 0)` then yields `NaN` for every dashboard total, and `new Date(\`${c.date}T00:00:00\`)` on a non-string date produces `Invalid Date`, silently dropping rows from month classification. Envelope-level fields are validated (lines 178-189) but row-level content is not.
**Fix:** Add a per-row validator before `db.incomeChecks.add`, rejecting the import (throw `ImportError('INVALID_ENVELOPE')`) or skipping rows that fail a shape check (`typeof date === 'string'`, `Number.isFinite(netAmount)`, `category ∈ {payroll,gift,other}`, `typeof taxable === 'boolean'`).

### WR-04: `estimatePerCheck` accepts negative / NaN values with no validation

**File:** `src/pages/SettingsPage.tsx:91-97, 44-49`; `src/domains/income/income.atoms.ts:71-79`
**Issue:** The "Estimate per check" `NumberInput` has no `error` prop and `handleSave` writes it unconditionally via `saveEstimatePerCheck(estimatePerCheck)`. `NumberInput.onChange` does `Number(e.target.value)`, which yields `0` for empty and can yield negative values. A negative estimate is then consumed by `estimatePerCheckAtom` where the guard is `if (setting > 0) return setting` — a negative passes the "is it set" intent but fails `> 0`, so it silently falls back to the most-recent-check heuristic, meaning the user's entered (negative) value is accepted by the form yet silently ignored. The UI gives no feedback that the value was rejected.
**Fix:** Validate the field (`estimatePerCheck >= 0`) and either block save with an error message or clamp to 0. Make the atom's intent explicit: treat `<= 0` as "unset" consistently and surface that in the UI.

### WR-05: `defaultChecked` known-source match is exact-equality but autocomplete uses fuzzy `includes`

**File:** `src/domains/income/classify.ts:90-92`; `src/domains/income/SourceAutocomplete.tsx:42`
**Issue:** `defaultChecked` matches a parsed row's source against known sources with strict `ks.source === row.source`, while the autocomplete remembers/displays sources via case-insensitive substring (`includes`). Bank statements frequently vary casing/whitespace across pulls (e.g. `GLI EAST LANSING` vs `Gli East Lansing  `). A remembered source that differs only by case/trailing space will not auto-check on the next paste, so a legitimate recurring credit silently defaults unchecked and can be missed on commit. The two code paths use inconsistent matching semantics for the same concept.
**Fix:** Normalize on both sides (trim + lowercase) before comparison, or extract a single `sourcesMatch(a, b)` helper used by both `defaultChecked` and the autocomplete filter so the matching rule cannot drift.

### WR-06: `commitCheckedRowsAtom` remembers ALL checked sources, causing future auto-check of one-off income

**File:** `src/domains/income/income.atoms.ts:175-194`; `src/domains/income/classify.ts:83-95`
**Issue:** Every checked row's `(source, category, taxable)` is written into `knownSources`, including one-time gifts or "other" credits the user manually ticked. On the next paste, `defaultChecked` auto-checks any credit whose source is in `knownSources`. The result: a one-off gift source becomes a permanent auto-checked source, re-importing it by default if it ever reappears in a statement. This conflicts with the conservative-default intent stated in `classify.ts` ("conservative auto-check", "Everything else … defaults unchecked").
**Fix:** Restrict known-source memory to payroll (or to sources the user explicitly opts to remember), or scope `defaultChecked`'s known-source rule to `category === 'payroll'` so non-payroll remembered sources do not auto-check.

### WR-07: Same-date payroll ordering is non-deterministic in surplus classification

**File:** `src/domains/income/classify.ts:63-71`; `src/domains/income/income.atoms.ts:51-57`
**Issue:** `classifySurplus` sorts a month's payroll checks by `a.date.localeCompare(b.date)` and flags index ≥ 2 as surplus. When two payroll checks share the same ISO date (common: two deposits the same day), `localeCompare` returns 0 and the relative order falls back to the IndexedDB `toArray()` order, which is id/insertion order and not guaranteed stable across imports or re-seeds. Which of two same-day checks is treated as "baseline" vs "surplus" is therefore arbitrary, and `baselinePayrollAtom` will surface a different amount depending on insertion order — a determinism gap on a financial computation.
**Fix:** Add a stable tiebreaker to the sort (e.g. `a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0)`), matching the hash/id-tiebreaker pattern already used elsewhere in this workspace for closed-set selection.

### WR-08: Non-null assertion `c.id!` can mis-filter checks that lack an id

**File:** `src/domains/income/income.atoms.ts:55`
**Issue:** `baselinePayrollAtom` filters with `!surplusIds.has(c.id!)`. `classifySurplus` only ever adds *defined* ids to the set, so a check with `id === undefined` produces `surplusIds.has(undefined)` → always `false`, meaning an id-less payroll check is always treated as baseline and never surplus, regardless of its date position. While liveQuery-sourced rows always carry ids today, the `!` assertion hides this assumption; if a non-persisted check ever flows through (e.g. optimistic UI later), the surplus rule silently misclassifies it.
**Fix:** Filter explicitly: `.filter((c) => c.category === 'payroll' && c.id !== undefined && !surplusIds.has(c.id))`, or key the surplus set on a guaranteed-present field.

## Info

### IN-01: Duplicated comment block in db.ts schema definition

**File:** `src/storage/db.ts:24-29`
**Issue:** The three-line comment "v2: field-only addition … stay aligned (A2)." is pasted twice (lines 24-26 and 27-29). Dead duplicate text.
**Fix:** Delete the second copy.

### IN-02: Parse error message conflates "too large" with "no rows found"

**File:** `src/domains/income/PasteParseFlow.tsx:54-57`
**Issue:** The `catch` maps every thrown error — including the `RangeError` from the 1,000,000-char DoS cap — to "No transaction rows found. Check the format and try again." A user who pastes an over-cap blob gets a misleading message that suggests a format problem rather than a size problem.
**Fix:** Distinguish `RangeError` and show a size-specific message (e.g. "Input too large — paste a smaller statement block.").

### IN-03: Stale annotation — AppShell header comment lists wrong nav links

**File:** `src/components/AppShell.tsx:4-6`
**Issue:** The comment says the header has "two nav links (Settings, Backup)", but the component renders four (Dashboard, Entry, Settings, Backup). The annotation is stale and misleads future readers about the shell's surface.
**Fix:** Update the comment to reflect the four current nav links.

### IN-04: `MetricCard` alert styling relies on a deprecated Tailwind utility with no test coverage

**File:** `src/components/MetricCard.tsx:21-23`; `src/domains/income/BackfillAlertCard.tsx:19`
**Issue:** Both the alert MetricCard and BackfillAlertCard use `bg-warning bg-opacity-10`. `bg-opacity-*` is a deprecated Tailwind v3 utility (superseded by the `/10` opacity modifier) and is removed in v4. The inline comment asserts it "works with plain hex tokens unlike /10 modifier" — that assumption is version-fragile and will break the alert background on a Tailwind upgrade with no failing test to catch it.
**Fix:** Confirm the project's Tailwind version, and prefer the modifier form (`bg-warning/10`) if supported; otherwise add a visual/regression note so the upgrade path is flagged.

---

_Reviewed: 2026-05-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
