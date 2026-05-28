---
phase: 01
slug: foundation-storage-deploy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x + React Testing Library |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-scaffolding | 01 | 1 | FOUND-01, DEP-01 | — | No credentials in source | manual | `npm run build` exits 0 | ❌ W0 | ⬜ pending |
| 01-dexie-schema | 01 | 1 | FOUND-02, FOUND-06 | — | No credential-storage methods exposed | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-storage-abstraction | 01 | 1 | FOUND-02 | — | Storage API exposes no credentials | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-settings-atoms | 01 | 1 | FOUND-06 | — | Floor values never go below seed | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-settings-ui | 01 | 2 | FOUND-01, UI-05 | — | Tap targets ≥ 44px, no horizontal scroll | manual | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-backup-export | 01 | 2 | FOUND-04 | — | JSON envelope includes schemaVersion | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-backup-import | 01 | 2 | FOUND-05 | — | schemaVersion > current = hard reject | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-migrations | 01 | 2 | FOUND-03 | — | Same fn used by Dexie upgrade + import | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-deploy | 01 | 3 | DEP-01, DEP-02, DEP-03 | — | App loads at GH Pages URL | manual | GitHub Actions green | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/storage/db.test.ts` — stubs for FOUND-02 (Dexie schema, storage abstraction)
- [ ] `src/__tests__/storage/migrations.test.ts` — stubs for FOUND-03 (migration ladder)
- [ ] `src/__tests__/atoms/settings.test.ts` — stubs for FOUND-06 (derived Jotai atoms)
- [ ] `src/__tests__/backup/export.test.ts` — stubs for FOUND-04 (export envelope)
- [ ] `src/__tests__/backup/import.test.ts` — stubs for FOUND-05 (import + schema rejection)
- [ ] `src/test-setup.ts` — fake-indexeddb + structuredClone polyfill (jsdom requirement)
- [ ] `vite.config.ts` test block — jsdom environment, setupFiles pointing to test-setup.ts

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
