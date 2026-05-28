---
phase: 02-income-model-with-two-floors
verified: 2026-05-28T13:08:00Z
status: verified
score: 6/6 must-haves verified
overrides_applied: 0
mode: mvp
reverified: 2026-05-28T13:08:00Z
resolution: >-
  CR-01 closed by commit 4e8d897. IncomeBar defended-line label now derives from
  the defendedLine prop via compact Intl.NumberFormat (e.g. "$2.5k"); a non-3000
  regression test (IncomeBar.test.tsx) locks the fix. BackfillAlertCard copy now
  derives "below $X" from the defendedLine prop (DashboardPage passes floors.defended).
  Suite: 123 passing / 0 failing, tsc clean. WR-01 (overflow-note payroll-only
  semantic) was intentionally NOT changed — it is a non-blocking warning left for
  Ian to decide, tracked in 02-REVIEW.md.
gaps:
  - truth: "Dashboard renders MTD income with a marker tick that correctly identifies the user-configured defended line (SC#3 + SC#6 interaction)"
    status: resolved
    reason: >-
      The defended-line tick is POSITIONED correctly from the defendedLine prop, but its
      visible LABEL is the hardcoded literal "$3k" (IncomeBar.tsx:100). The defended line
      is user-editable on the Settings page (SC#6 is satisfied — Floors.defended is a
      live NumberInput). If Ian changes the defended line to any value other than $3,000,
      the marker still reads "$3k" while sitting at the new position — a money-display
      surface that actively misrepresents the threshold it marks. This is code-review
      CR-01 (CRITICAL), still unfixed (no fix commit after 98f07f1). The bug is locked
      into the test suite (IncomeBar.test.tsx:58-68 asserts the literal "$3k"), so the
      green 122/122 run does NOT validate correct behavior here. WR-01 compounds it:
      the overflow note compares projectedTotal (payroll+gift+other) against the
      defended line, which inverts the payroll-only Pitfall-4 invariant the rest of the
      domain enforces. BackfillAlertCard.tsx:26 similarly hardcodes "below $3,000" copy
      regardless of the configured defended line.
    artifacts:
      - path: "src/components/IncomeBar.tsx"
        issue: "Line 100 hardcodes label '$3k'; line 8 header comment bakes the wrong assumption; lines 33-34 overflow note compares projectedTotal (not payroll) against defendedLine (WR-01)"
      - path: "src/domains/income/BackfillAlertCard.tsx"
        issue: "Line 26 hardcodes 'below $3,000' copy; will misstate the trigger if defended line is edited away from 3000"
      - path: "src/components/IncomeBar.test.tsx"
        issue: "Lines 58-68 assert getByText('$3k'), locking the defect into the suite — must update to assert the formatted defendedLine prop"
    missing:
      - "Format the defended-line label from the defendedLine prop (Intl.NumberFormat) instead of the literal '$3k'"
      - "Update IncomeBar.test.tsx to render with a non-3000 defendedLine and assert the formatted value appears (regression lock for CR-01)"
      - "Decide overflow-note semantic (WR-01): pass projectedPayroll, or rename the copy so it no longer references the defended line"
      - "Parameterize BackfillAlertCard copy from the defended line (or confirm $3,000 is a fixed product constant and document it)"
deferred: []
human_verification:
  - test: "Live v1→v2 in-place Dexie upgrade on Ian's actual device"
    expected: "Prior floors still show after upgrade; no console upgrade error; a previously-exported v1 backup re-imports cleanly"
    why_human: "The automated path only proves a fresh-DB upgrade + the JSON-import ladder; an in-place upgrade of Ian's existing phone/laptop IndexedDB can only be observed on his devices. Compounded by WR-02 — db.ts version(2) has no .upgrade() callback, so the migrate_1_to_2 ladder is currently dead code on the Dexie path (harmless only because getKnownSources() defaults to [] at runtime)."
  - test: "Paste-parse correctness against Ian's REAL pasted checking statement"
    expected: "Exactly the 2 payroll rows default-check; the confirm table matches the statement; gift/asset-sale/cashback rows default unchecked"
    why_human: "The gold fixture was constructed from documented figures, not Ian's verbatim raw paste (A3). Real bank formatting must be reconciled at UAT."
  - test: "Phone readability of /dashboard"
    expected: "Income bar + 3 metric cards render without horizontal scroll on Ian's phone"
    why_human: "Responsive-layout judgment; not assertable programmatically (UI-06 lands formally in P5 but the dashboard is viewed here)."
---

# Phase 2: Income Model with Two Floors — Verification Report

**Phase Goal:** Ian can record his biweekly checks and see month-to-date income against both the passive floor (solvency) and defended line ($3,000 backfill trigger), with alerts when projection drops below the defended line.
**Verified:** 2026-05-28T13:08:00Z
**Status:** verified (CR-01 resolved by commit 4e8d897 — re-verified)
**Re-verification:** Yes — CR-01 blocker fixed and regression-locked after initial gaps_found

## Goal Achievement

The income model is built end-to-end and substantively wired: manual entry, paste-parse, the reactive atom chain, the two-floor dashboard, and the backfill alert all exist and run on real IndexedDB-backed data. Five of six ROADMAP success criteria are observably true in the codebase. The single gap is a CRITICAL correctness defect (code-review CR-01, unfixed) where the dashboard's defended-line marker label is hardcoded `$3k` even though the defended line is user-editable — a money-display surface that misrepresents a user-configured value, with the defect locked into the test suite.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ian can type a new check entry (date, netAmount, source, note) and see it persisted | ✓ VERIFIED | `CheckEntryForm.tsx` collects date/netAmount/source/category/taxable/note; `handleSave` → `saveIncomeCheckAtom` → `storage.addIncomeCheck`. Live re-render via `incomeChecksAtom` (atomWithObservable over `observeIncomeChecks()`). |
| 2 | Ian can paste a transaction block, review parsed entries in a confirm step, and commit them | ✓ VERIFIED | `PasteParseFlow.tsx` input→confirm→done state machine; `parseStatement(text, checkingAdapter)` → `ConfirmTable` (editable) → `commitCheckedRowsAtom` persists ONLY `rows.filter(r => r.checked)`. |
| 3 | Dashboard renders MTD income with two visual markers: solvency band at passive floor, backfill marker at defended line | ⚠️ PARTIAL | Marker POSITIONS correct (`floorPct`, `defendedPct` from props); passive-floor "floor" label correct. Defended-line LABEL hardcoded `$3k` (IncomeBar.tsx:100) — misrepresents an edited defended line. CR-01 unfixed. |
| 4 | When projected month total falls below $3,000, a backfill alert surfaces | ✓ VERIFIED | `backfillActiveAtom = projectedMonthPayroll < defendedLine` (payroll-only, Pitfall-4 correct). DashboardPage swaps surplus card → `BackfillAlertCard` (role="alert") showing projected payroll + "below $3,000 — add sessions to defend". |
| 5 | A 3rd check in the same calendar month is auto-classified as surplus | ✓ VERIFIED | `classifySurplus` groups payroll by LOCAL calendar month, sorts by date asc, flags index ≥ 2. `baselinePayrollAtom` excludes surplus ids; CheckEntryForm shows the "will be classified as surplus" badge. (Determinism nit WR-07: no same-date tiebreaker — warning, not blocker.) |
| 6 | Both floor values are editable in a settings/parameters surface | ✓ VERIFIED | `SettingsPage.tsx` renders editable NumberInputs for passive floor and defended line, persisted via `saveFloorsAtom`. (This is what makes CR-01 a real defect: editable input + hardcoded label.) |

**Score:** 5/6 truths verified (SC#3 partial → counts as failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/storage/schema.ts` | IncomeCheck/KnownSource types, CURRENT_SCHEMA_VERSION=2 | ✓ VERIFIED | Referenced by atoms + storage; tsc clean |
| `src/storage/migrations.ts` | migrate_1_to_2 | ⚠️ ORPHANED on Dexie path | Exists, but db.ts version(2) has no `.upgrade()` to invoke it (WR-02). Harmless via runtime default today; ladder is dead code. |
| `src/storage/db.ts` | v2 schema bump | ✓ VERIFIED (with WR-02 caveat + IN-01 duplicated comment lines 24-29) | |
| `src/domains/income/parser/parseStatement.ts` | pure (text, adapter) → CandidateRow[] | ✓ VERIFIED | Block-based, anchored regexes, 1M-char DoS cap |
| `src/domains/income/classify.ts` | surplus + auto-check + taxability | ✓ VERIFIED | Pure, no I/O |
| `src/domains/income/income.atoms.ts` | reactive derived chain | ✓ VERIFIED | Imports `storage` not `db`; surplus vs passive (INC-03), backfill payroll-only (D-09) |
| `src/domains/income/CheckEntryForm.tsx` | manual entry form | ✓ VERIFIED | Validation + autocomplete + surplus badge |
| `src/domains/income/PasteParseFlow.tsx` | paste→confirm→commit | ✓ VERIFIED | Commits checked rows only |
| `src/domains/income/ConfirmTable.tsx` | editable parsed-row table | ✓ VERIFIED | Wired into PasteParseFlow |
| `src/components/IncomeBar.tsx` | role=meter two-floor bar | ⚠️ STUB-LABEL | role=meter + markers correct; defended label hardcoded `$3k` (CR-01) |
| `src/domains/income/BackfillAlertCard.tsx` | role=alert backfill card | ⚠️ HARDCODED COPY | role=alert + projected payroll correct; "below $3,000" copy hardcoded |
| `src/pages/DashboardPage.tsx` | two-floor dashboard | ✓ VERIFIED | Reads real derived atoms; passes both floors to IncomeBar |
| `src/pages/EntryPage.tsx` | two-tab entry shell | ✓ VERIFIED | Manual + Paste tabs both wired |
| `src/pages/SettingsPage.tsx` | editable floors + estimate | ✓ VERIFIED | Both floors editable |
| `src/App.tsx` | /dashboard, /entry, /settings routes | ✓ VERIFIED | /dashboard index + wildcard redirect |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| CheckEntryForm | storage.addIncomeCheck | saveIncomeCheckAtom | ✓ WIRED | |
| PasteParseFlow | parseStatement | direct call | ✓ WIRED | |
| PasteParseFlow | storage.addIncomeChecks | commitCheckedRowsAtom (checked-only) | ✓ WIRED | |
| DashboardPage | derived atoms | useAtomValue({delay:0}) | ✓ WIRED | |
| IncomeBar | defendedLine prop | DashboardPage → floors.defended | ⚠️ PARTIAL | Position wired; label NOT driven by prop (CR-01) |
| DashboardPage | backfillActiveAtom | surplus↔alert swap | ✓ WIRED | |
| SettingsPage | saveFloorsAtom | both floors | ✓ WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| DashboardPage | mtd/projected/surplus/backfill | `incomeChecksAtom` = atomWithObservable(`storage.observeIncomeChecks()`) liveQuery over IndexedDB | Yes | ✓ FLOWING |
| IncomeBar | floors.passive/defended | `floorsLoadAtom` ← storage | Yes | ✓ FLOWING (label rendering aside) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npx vitest run` | 13 files, 122 passed, 0 todo, 0 failed | ✓ PASS |
| Type check | `npx tsc -b --noEmit` | exit 0 | ✓ PASS |
| Note | suite green does NOT validate SC#3 — IncomeBar.test.tsx:58-68 asserts the buggy literal `$3k` | — | ✗ (locks defect) |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| INC-01 | 02-01, 02-03 | ✓ SATISFIED | CheckEntryForm + storage CRUD |
| INC-02 | 02-01 | ✓ SATISFIED | Two editable floors in Settings |
| INC-03 | 02-02 | ✓ SATISFIED | surplusAtom vs passiveFloor, never defended/avg |
| INC-04 | 02-02 | ✓ SATISFIED | classifySurplus 3rd-payroll rule |
| INC-05 | 02-04 | ⚠️ PARTIAL | Two markers render; defended label wrong when edited (CR-01) |
| INC-06 | 02-02, 02-04 | ✓ SATISFIED | backfillActiveAtom + BackfillAlertCard (copy hardcoded — see gap) |
| INC-07 | 02-03 | ✓ SATISFIED | Manual entry always available |
| INC-08 | 02-02, 02-05 | ✓ SATISFIED | parseStatement + PasteParseFlow |
| UI-03 | 02-03, 02-05 | ✓ SATISFIED | Typed + paste-parse with confirm step |
| EDGE-01 | 02-02, 02-04 | ✓ SATISFIED | Below-defended surfaces backfill alert; payroll-only so gift can't suppress |
| EDGE-05 | 02-02, 02-03, 02-05 | ✓ SATISFIED | 3rd check → surplus |

All 11 phase requirement IDs are claimed by at least one plan's frontmatter. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| IncomeBar.tsx | 100, 8 | Hardcoded `$3k` label / comment | 🛑 Blocker | Misrepresents edited defended line (CR-01) |
| IncomeBar.tsx | 33-34 | Overflow note: projectedTotal vs defendedLine | ⚠️ Warning | Inverts payroll-only invariant (WR-01) |
| BackfillAlertCard.tsx | 26 | Hardcoded "below $3,000" copy | ⚠️ Warning | Wrong trigger text if defended line edited |
| db.ts | 30-36 / 24-29 | version(2) no .upgrade(); duplicated comment | ⚠️ Warning | Migration ladder dead code (WR-02), dead text (IN-01) |
| storage.ts | 225-230 | importAll blind-casts income rows | ⚠️ Warning | Malformed backup → NaN totals (WR-03) |
| SettingsPage.tsx | 91-97 | estimatePerCheck no validation | ⚠️ Warning | Negative accepted by form, silently ignored (WR-04) |
| classify.ts | 90-92 vs SourceAutocomplete.tsx:42 | exact-equality vs fuzzy includes | ⚠️ Warning | Recurring credit may not auto-check (WR-05) |
| income.atoms.ts | 175-194 | remembers ALL checked sources | ⚠️ Warning | One-off gift auto-checks on future paste (WR-06) |
| classify.ts / income.atoms.ts | 63-71 / 55 | no same-date tiebreaker; c.id! assertion | ⚠️ Warning | Non-deterministic same-day surplus (WR-07/08) |

No `TBD`/`FIXME`/`XXX` debt markers found in phase files. No PLACEHOLDER/coming-soon stubs (02-04 summary "Known Stubs: None" confirmed against code).

### Human Verification Required

1. **Live v1→v2 in-place Dexie upgrade** on Ian's existing device — confirm prior floors persist, no console error, v1 backup re-imports. (Heightened by WR-02 unwired upgrade callback.)
2. **Paste-parse vs. real statement** — Ian pastes his actual checking statement; confirm exactly the 2 payroll rows default-check (gold fixture is reconstructed, not verbatim — A3).
3. **Phone readability of /dashboard** — bar + 3 cards without horizontal scroll.

### Gaps Summary

One BLOCKER, surfaced by the code review and confirmed unfixed in the codebase: **CR-01 — the defended-line marker label is hardcoded `$3k`**. The phase goal is to let Ian *accurately* see income against the defended line, and SC#6 makes that line user-editable; the hardcoded label means editing it produces a financial display that misrepresents the threshold. The test suite asserts the buggy literal, so the green 122/122 run gives false confidence. WR-01 (overflow note mixes total vs. payroll) and the BackfillAlertCard hardcoded "$3,000" copy belong to the same root cause: defended-line UI copy not parameterized from the configured value. The fix is small (format the prop, update the test, parameterize copy) but it is a correctness defect on a money surface and must close before the phase is accepted.

The remaining WARNINGs (WR-02..WR-08, IN-01..04) are real but non-blocking robustness/consistency issues; they should be triaged but do not by themselves prevent goal achievement. Three legitimate human-verification items (device upgrade, real-paste reconciliation, phone layout) remain regardless of CR-01.

**Recommendation:** Close CR-01 (and fold in WR-01 + BackfillAlertCard copy as the same concern) via `/gsd-plan-phase --gaps`, then re-verify. Consider batching the WARNING cluster into the same fix pass.

---

_Verified: 2026-05-28T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
