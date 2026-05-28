---
phase: 2
slug: income-model-with-two-floors
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
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
| 02-01-01 | 01 | 1 | INC-02 | T-02-01 | v1 backup imports; version-too-new refused; migration widens nothing | integration | `npx vitest run src/test/migrations.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | INC-01 | T-02-02 / T-02-03 | income round-trips export/import; storage surface has no credential/money-move method | integration | `npx vitest run src/test/storage.income.test.ts src/test/storage.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | INC-01 | T-02-02 | gold fixture + absence proof present | unit | `npx vitest run src/test/storage.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | INC-08 | T-02-D / T-02-V | parser splits gold fixture; bounded input; no eval/dynamic regex | unit | `npx vitest run src/domains/income/parser/parseStatement.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | INC-04, EDGE-05 | T-02-05 | surplus = 3rd payroll by LOCAL month; conservative auto-check (D-05) | unit | `npx vitest run src/domains/income/classify.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | INC-03, INC-06, EDGE-01 | T-02-04 / T-02-05 | projection D-11; backfill payroll-only; gift doesn't suppress; nothing persisted | unit | `npx vitest run src/domains/income/income.atoms.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | INC-01, INC-07 | T-02-V / T-02-X | manual entry persists; validation gates save; no innerHTML | component | `npx vitest run src/domains/income/CheckEntryForm.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | UI-03 | T-02-06 | /entry route + tab shell; save via storage only | integration | `npx vitest run && npx tsc -b --noEmit` | ✅ (existing App smoke) | ⬜ pending |
| 02-04-01 | 04 | 4 | INC-05 | T-02-04 | meter ARIA; token-only color; read-only | component | `npx vitest run src/components/IncomeBar.test.tsx` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 4 | INC-06, EDGE-01 | T-02-05 | backfill alert replaces surplus card on payroll < defended | component | `npx vitest run && npx tsc -b --noEmit` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 4 | INC-08, EDGE-05 | T-02-03 / T-02-X | commit only checked rows; gift/asset-sale excluded; remember sources; no innerHTML | integration | `npx vitest run src/domains/income/PasteParseFlow.test.tsx` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 4 | UI-03 | T-02-06 | paste tab wired; estimate field persists via storage | integration | `npx vitest run && npx tsc -b --noEmit` | ✅ (existing settings test) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

No 3 consecutive tasks lack an automated verify — every task above has an `<automated>` command.

---

## Wave 0 Requirements

Created in Plan 02-01 (Task 3) so plans 02-05 have concrete targets:

- [ ] `src/domains/income/parser/__fixtures__/checking-may-2026.txt` — the gold statement sample (constructed from documented figures; **A3: reconcile against Ian's real paste at UAT**). Contains `GLI EAST LANSING`, `1,127.51`, `1,296.59`, `VANGUARD SELL`, `VENMO`, `TYPE: PAYROLL`.
- [ ] `src/test/migrations.test.ts` — v1→v2 path + v1 backup import + version-too-new refusal (INC-02)
- [ ] `src/test/storage.income.test.ts` — income CRUD + known-source/estimate persistence + export/import round-trip (INC-01)
- [ ] extend `src/test/storage.test.ts` — absence proof adds `executeSweep`/`decreaseFoodFloor` (C2/C3)
- [ ] `src/domains/income/parser/parseStatement.test.ts` — block split, field extraction, credit/debit (INC-08)
- [ ] `src/domains/income/classify.test.ts` — surplus + LOCAL-month boundary + default taxable + conservative auto-check (INC-04, EDGE-05)
- [ ] `src/domains/income/income.atoms.test.ts` — projection, backfill payroll-only, gift-doesn't-suppress (INC-06, D-09, D-11)
- [ ] `src/domains/income/CheckEntryForm.test.tsx` — manual entry persists + validation + surplus badge (INC-01/INC-07)
- [ ] `src/components/IncomeBar.test.tsx` — meter ARIA (INC-05)
- [ ] `src/domains/income/PasteParseFlow.test.tsx` — paste→confirm→commit, only-checked-rows, gift excluded (INC-08, UI-03)

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

**Approval:** ready
