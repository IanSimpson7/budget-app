---
phase: 2
slug: income-model-with-two-floors
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
audited: 2026-05-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.6 + @testing-library/react 16 + @testing-library/user-event 14 + fake-indexeddb 6 (jsdom) |
| **Config file** | vite.config.ts (test block: jsdom, globals, src/test/setup.ts) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc -b --noEmit` |
| **Estimated runtime** | ~8 seconds (Phase-1 suite ran in single-digit seconds; Phase 2 adds pure-function + component tests with no slow I/O — fake-indexeddb is in-memory) |

Targeted single-file runs (e.g. `npx vitest run src/domains/income/classify.test.ts`) keep per-task latency under ~3s.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (or the task's targeted file for tighter latency)
- **After every plan wave:** Run `npx vitest run && npx tsc -b --noEmit`
- **Before `/gsd-verify-work`:** Full suite green AND the May-2026 gold fixture passes end-to-end (parser → classify → atoms → dashboard backfill)
- **Max feedback latency:** ~8 seconds (full suite); ~3 seconds (targeted file)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INC-02 | T-02-01 | v1 backup imports; version-too-new refused; migration widens nothing | integration | `npx vitest run src/test/migrations.test.ts` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | INC-01 | T-02-02 / T-02-03 | income round-trips export/import; storage surface has no credential/money-move method | integration | `npx vitest run src/test/storage.income.test.ts src/test/storage.test.ts` | ✅ | ✅ green |
| 02-01-03 | 01 | 1 | INC-01 | T-02-02 | gold fixture + absence proof present | unit | `npx vitest run src/test/storage.test.ts` | ✅ | ✅ green |
| 02-02-01 | 02 | 2 | INC-08 | T-02-D / T-02-V | parser splits gold fixture; bounded input; no eval/dynamic regex | unit | `npx vitest run src/domains/income/parser/parseStatement.test.ts` | ✅ | ✅ green |
| 02-02-02 | 02 | 2 | INC-04, EDGE-05 | T-02-05 | surplus = 3rd payroll by LOCAL month; conservative auto-check (D-05) | unit | `npx vitest run src/domains/income/classify.test.ts` | ✅ | ✅ green |
| 02-02-03 | 02 | 2 | INC-03, INC-06, EDGE-01 | T-02-04 / T-02-05 | projection D-11; backfill payroll-only; gift doesn't suppress; nothing persisted | unit | `npx vitest run src/domains/income/income.atoms.test.ts` | ✅ | ✅ green |
| 02-03-01 | 03 | 3 | INC-01, INC-07 | T-02-V / T-02-X | manual entry persists; validation gates save; no innerHTML | component | `npx vitest run src/domains/income/CheckEntryForm.test.tsx` | ✅ | ✅ green |
| 02-03-02 | 03 | 3 | UI-03 | T-02-06 | /entry route + tab shell; save via storage only | integration | `npx vitest run && npx tsc -b --noEmit` | ✅ (App smoke) | ✅ green |
| 02-04-01 | 04 | 4 | INC-05 | T-02-04 | meter ARIA; token-only color; read-only; defended label from prop (CR-01 regression locked) | component | `npx vitest run src/components/IncomeBar.test.tsx` | ✅ | ✅ green |
| 02-04-02 | 04 | 4 | INC-06, EDGE-01 | T-02-05 | backfill alert replaces surplus card on payroll < defended | component | `npx vitest run src/pages/DashboardPage.test.tsx` | ✅ | ✅ green |
| 02-05-01 | 05 | 4 | INC-08, EDGE-05 | T-02-03 / T-02-X | commit only checked rows; gift/asset-sale excluded; remember sources; no innerHTML | integration | `npx vitest run src/domains/income/PasteParseFlow.test.tsx` | ✅ | ✅ green |
| 02-05-02 | 05 | 4 | UI-03 | T-02-06 | paste tab wired; estimate field persists via storage | integration | `npx vitest run src/test/settings.atoms.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

No 3 consecutive tasks lack an automated verify — every task above has an `<automated>` command.

---

## Wave 0 Requirements

Created in Plan 02-01 (Task 3) so plans 02-05 have concrete targets. **All Wave 0 files landed and are green (audit 2026-05-28).**

- [x] `src/domains/income/parser/__fixtures__/checking-may-2026.txt` — the gold statement sample (constructed from documented figures; **A3: reconcile against Ian's real paste at UAT**). Contains `GLI EAST LANSING`, `1,127.51`, `1,296.59`, `VANGUARD SELL`, `VENMO`, `TYPE: PAYROLL`.
- [x] `src/test/migrations.test.ts` — v1→v2 path + v1 backup import + version-too-new refusal (INC-02)
- [x] `src/test/storage.income.test.ts` — income CRUD + known-source/estimate persistence + export/import round-trip (INC-01)
- [x] extend `src/test/storage.test.ts` — absence proof adds `executeSweep`/`decreaseFoodFloor` (C2/C3)
- [x] `src/domains/income/parser/parseStatement.test.ts` — block split, field extraction, credit/debit (INC-08)
- [x] `src/domains/income/classify.test.ts` — surplus + LOCAL-month boundary + default taxable + conservative auto-check (INC-04, EDGE-05)
- [x] `src/domains/income/income.atoms.test.ts` — projection, backfill payroll-only, gift-doesn't-suppress (INC-06, D-09, D-11)
- [x] `src/domains/income/CheckEntryForm.test.tsx` — manual entry persists + validation + surplus badge (INC-01/INC-07)
- [x] `src/components/IncomeBar.test.tsx` — meter ARIA (INC-05) + CR-01 regression (defended label derived from prop, not literal `$3k`)
- [x] `src/domains/income/PasteParseFlow.test.tsx` — paste→confirm→commit, only-checked-rows, gift excluded (INC-08, UI-03)

Framework install: none required — full toolchain present (package.json verified). Placeholder test files in 02-01 may use `it.todo` for behaviors landing in later plans; their subject plans replace todos with real assertions and turn them green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live v1→v2 in-place Dexie upgrade on Ian's actual device | INC-02 / A4 | The automated path proves the JSON-import ladder + a fresh-DB upgrade; the in-place upgrade of Ian's EXISTING phone/laptop IndexedDB can only be observed on his devices | After deploy: open the app on the device that already holds v1 data; confirm prior floors still show and no console upgrade error; then import a previously-exported v1 backup and confirm it restores |
| Parser correctness against the REAL pasted statement | INC-08 / A3 | The gold fixture is constructed from documented figures; the verbatim raw paste was not captured in 02-DISCUSSION-LOG.md | At UAT, Ian pastes his actual checking statement; confirm exactly the 2 payroll rows default-check and the confirm table matches expectation; reconcile the fixture if the real format differs |
| Phone readability of the dashboard | UI-06 (P5, but viewed here) | Responsive layout judgment | Open `/dashboard` on phone; confirm bar + 3 cards render without horizontal scroll |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < ~8s (full) / ~3s (targeted)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-05-28

Post-execution audit against the as-built codebase (this VALIDATION.md was authored pre-execution with all rows ⬜ pending / ❌ W0; updated here to reflect reality).

| Metric | Count |
|--------|-------|
| Requirements in scope | 11 (INC-01..08, UI-03, EDGE-01, EDGE-05) |
| COVERED | 11 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved this audit | 0 (no auditor spawn needed) |
| Escalated to manual-only | 3 (unchanged — device upgrade, real-paste reconcile, phone layout) |

**Evidence:** `npx vitest run` → 13 files, **123 passed / 0 failed** (3.26s). `npx tsc -b --noEmit` → exit 0. All 12 Per-Task rows green; all 10 Wave 0 files present.

**CR-01 closure confirmed:** the verifier (02-VERIFICATION.md) flagged that `IncomeBar.test.tsx` originally asserted the buggy literal `$3k`, locking the defect into a green suite. That is now fixed — `IncomeBar.test.tsx:70-81` renders with `defendedLine={2500}`, asserts `$2.5k` is present, and asserts `$3k` is absent (regression lock for the user-editable defended line). The remaining `$3k` assertion (line 58) correctly tests the $3,000 *default* case only.

**Not validation gaps:** the WARNING cluster from 02-VERIFICATION.md / 02-REVIEW.md (WR-01..08, IN-01..04 — robustness/consistency nits) are tracked in review artifacts and do not represent missing requirement coverage.

Phase 2 is **Nyquist-compliant**: every requirement has automated, green verification.
