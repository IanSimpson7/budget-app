---
phase: 01
slug: foundation-storage-deploy
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
audited: 2026-05-28
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + @testing-library/react 16 + @testing-library/user-event 14 + fake-indexeddb 6 (jsdom) |
| **Config file** | `vite.config.ts` (test block: jsdom, globals, `src/test/setup.ts`) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc -b --noEmit` |
| **Estimated runtime** | ~3 seconds (in-memory fake-indexeddb) |

> **Audit note (2026-05-28):** the as-built test convention is `src/test/*` — the pre-execution `src/__tests__/**` paths in the Wave 0 list below were never used. Actual Phase-1 test files: `src/test/storage.test.ts`, `src/test/settings.atoms.test.ts`, `src/test/BackupPage.test.tsx`, `src/test/App.test.tsx`.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Requirement IDs below corrected to REQUIREMENTS.md definitions (the draft had FOUND-03/04/05 swapped): FOUND-03 = JSON export, FOUND-04 = JSON import, FOUND-05 = floors-as-editable-params, FOUND-06 = derived recompute.

| Task | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| scaffold app shell | 01 | 1 | FOUND-01 | No credentials in source; build exits 0 | smoke | `npx vitest run src/test/App.test.tsx` | ✅ | ✅ green |
| storage abstraction + Dexie v1 | 02 | 1 | FOUND-02 | Storage surface exposes no credential/money-move/floor-lower method (absence proof + `@ts-expect-error`) | unit | `npx vitest run src/test/storage.test.ts` | ✅ | ✅ green |
| JSON export envelope | 02 | 2 | FOUND-03 | Envelope carries schemaVersion + seeded floors | unit | `npx vitest run src/test/storage.test.ts` | ✅ | ✅ green |
| JSON import + version policy | 02 | 2 | FOUND-04 | `schemaVersion > current` hard-rejected; replace-not-merge; round-trips | unit + component | `npx vitest run src/test/storage.test.ts src/test/BackupPage.test.tsx` | ✅ | ✅ green |
| floors as editable params | 02 | 1 | FOUND-05 | Floors are user-editable parameters, never hard-coded constants | unit | `npx vitest run src/test/settings.atoms.test.ts` | ✅ | ✅ green |
| derived recompute | 02 | 1 | FOUND-06 | `derivedSurvivalFloorAtom` recomputes on input change (not stored stale) | unit | `npx vitest run src/test/settings.atoms.test.ts` | ✅ | ✅ green |
| backup surface export+import | 02 | 2 | UI-05 | Export/import actions + replace warning; static toast copy (no file content concatenated) | component | `npx vitest run src/test/BackupPage.test.tsx` | ✅ | ✅ green |
| GitHub Pages deploy | 03 | 3 | DEP-01, DEP-02, DEP-03 | App loads at live URL; test-gate before build; no runtime credentials | manual / CI | GitHub Actions run 26565927728 (success) + Ian phone-verified | ✅ (CI) | ✅ green (manual) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

No 3 consecutive tasks lack an automated verify. DEP-01/02/03 are inherently manual/CI (live deploy + real-device load) — covered by a green Actions run and Ian's phone verification, recorded in Manual-Only below.

---

## Wave 0 Requirements

**As-built (audit 2026-05-28) — all green.** The pre-execution paths below were superseded by the `src/test/*` convention; mapping each to its actual file:

- [x] `src/test/storage.test.ts` — FOUND-02 storage abstraction + FOUND-03 export envelope + FOUND-04 import/version-policy + C1/C2/C3 absence proof (11 tests)
- [x] `src/test/settings.atoms.test.ts` — FOUND-05 editable floors + FOUND-06 `derivedSurvivalFloorAtom` recompute (5 tests)
- [x] `src/test/BackupPage.test.tsx` — UI-05 export/import surface + replace-warning state machine (6 tests)
- [x] `src/test/App.test.tsx` — FOUND-01 app-shell smoke
- [x] `src/test/setup.ts` — fake-indexeddb + structuredClone polyfill (before fake-indexeddb import) + Blob.text() jsdom shim
- [x] `vite.config.ts` test block — jsdom environment, globals, `setupFiles: src/test/setup.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App loads at GitHub Pages URL on phone | DEP-01 | Requires live deploy + real device | Open `https://simpsonian354.github.io/budget-app/` on phone after first deploy |
| Settings value persists across page reload | FOUND-01 | Requires real IndexedDB (not fake) | Enter value → hard refresh → confirm value remains |
| Tap targets ≥ 44px, no horizontal scroll | UI-05 | Visual + interaction test | Phone browser DevTools or real device; check Settings + Backup surfaces |
| GitHub Actions auto-deploys on push to main | DEP-03 | Live CI check | Push a commit to main, confirm Actions run completes, confirm Pages updates |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are inherently manual/CI (DEP-*)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (mapped to as-built `src/test/*`)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 15s (~3s actual)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-05-28

Retroactive post-execution audit (this VALIDATION.md was a pre-execution `draft` stub with wrong requirement IDs and never-used `src/__tests__/**` paths; updated to as-built reality).

| Metric | Count |
|--------|-------|
| Requirements in scope | 10 (FOUND-01..06, UI-05, DEP-01..03) |
| COVERED (automated) | 7 (FOUND-01..06, UI-05) |
| Manual/CI by nature | 3 (DEP-01..03 — live deploy + real-device load) |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |

**Evidence:** Phase-1 test files (`storage.test.ts`, `settings.atoms.test.ts`, `BackupPage.test.tsx`, `App.test.tsx`) all green inside `npx vitest run` (full suite 13 files / 123 passed, 3.26s); `npx tsc -b --noEmit` exit 0. DEP-* proven by GitHub Actions run 26565927728 (success) + Ian's phone verification (01-03-SUMMARY Task 3).

Phase 1 is **Nyquist-compliant**: every automatable requirement has green automated verification; the three deploy requirements are covered by CI + manual device check.
