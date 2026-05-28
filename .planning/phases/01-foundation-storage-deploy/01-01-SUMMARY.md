---
phase: 01-foundation-storage-deploy
plan: 01
subsystem: foundation
tags: [scaffold, vite, react19, tailwind-v3, typescript-strict, vitest, fake-indexeddb]
requires: []
provides:
  - vite-react-ts-scaffold
  - tailwind-v3-warm-dark-tokens
  - strict-typescript-baseline
  - vitest-jsdom-test-runner
  - structuredClone-polyfill
  - wave-0-test-stubs
affects:
  - package.json
  - vite.config.ts
  - tsconfig.json
  - tailwind.config.ts
  - src/main.tsx
  - src/App.tsx
  - src/test/setup.ts
tech-stack:
  added:
    - react@19.2.x
    - react-dom@19.2.x
    - jotai@2.20.x
    - dexie@4.4.x
    - react-router-dom@7.x
    - lucide-react@0.577.x
    - vite@8.0.x
    - "@vitejs/plugin-react@6.0.x"
    - typescript@5.6.x
    - vitest@4.1.x
    - "@testing-library/react@16.3.x"
    - "@testing-library/jest-dom@6.9.x"
    - "@testing-library/user-event@14.6.x"
    - jsdom@29.x
    - fake-indexeddb@6.x
    - tailwindcss@3.4.17
    - postcss@8.4.x
    - autoprefixer@10.4.x
  patterns:
    - strict-ts (noUncheckedIndexedAccess + exactOptionalPropertyTypes per D-17)
    - structuredClone polyfill BEFORE fake-indexeddb import (Pitfall 4)
    - tailwind v3 pinned (Pitfall 2 — v4 silently ignores tailwind.config.ts)
    - hardcoded vite base '/budget-app/' (Open Question 3 resolution)
key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - tsconfig.node.json
    - vite.config.ts
    - tailwind.config.ts
    - postcss.config.cjs
    - index.html
    - src/main.tsx
    - src/App.tsx
    - src/index.css
    - src/vite-env.d.ts
    - src/test/setup.ts
    - src/test/storage.test.ts
    - src/test/settings.atoms.test.ts
    - src/test/App.test.tsx
    - src/test/BackupPage.test.tsx
    - .nvmrc
  modified:
    - .gitignore
decisions:
  - Pinned tailwindcss ^3.4 (NOT v4) — honors UI-SPEC tailwind.config.ts verbatim
  - Hardcoded vite base '/budget-app/' (D-18 / RESEARCH Open Question 3)
  - Dropped tsconfig project-references composite — referenced config can't disable emit; tsconfig.node.json is now a standalone include set used implicitly by Vite tooling
  - Removed @types/node from tsconfig.node.json — not installed, not needed (Vite ships own types for its config)
metrics:
  duration: ~75 minutes (mostly waiting on npm install over a flaky TLS link)
  completed: 2026-05-28T01:50:00Z
  tasks: 2
  files: 18
  commits: 2
---

# Phase 01 Plan 01: Foundation Scaffold Summary

Scaffolded a buildable Vite + React 19 + TypeScript-strict + Tailwind v3.4 budget-app skeleton with Vitest/jsdom/fake-indexeddb test infra and 14 Wave 0 todo stubs covering FOUND-01..06 / UI-05.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Scaffold Vite + React + TS + Tailwind v3 | `db362a5` | package.json, tsconfig*.json, vite.config.ts, tailwind.config.ts, postcss.config.cjs, index.html, src/{main,App,index.css,vite-env.d.ts}, .gitignore, .nvmrc |
| 2 | Wave 0 test infra + stubs | `d4f19f9` | src/test/{setup.ts, storage.test.ts, settings.atoms.test.ts, App.test.tsx, BackupPage.test.tsx} |

## What Plan 02 Can Now Assume Exists

- `npm install` is complete; `package-lock.json` is committed.
- `npm run build` → `dist/` with `/budget-app/assets/...` paths.
- `npm run typecheck` (tsc -b --noEmit) is clean against strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes.
- `npm test -- --run` is green: 4 passing tests, 14 `it.todo` placeholders.
- Vitest is configured with jsdom + globals + setupFiles `src/test/setup.ts`.
- fake-indexeddb is wired via `import 'fake-indexeddb/auto'` in `setup.ts`; structuredClone polyfill is in place BEFORE that import.
- @testing-library/react + jest-dom matchers (`toBeInTheDocument` et al.) are extended via `@testing-library/jest-dom/vitest` and an afterEach cleanup is registered.
- Tailwind v3 utility classes from UI-SPEC (`bg-surface`, `text-text-primary`, `bg-accent`, `text-accent`, `font-display`, `font-mono`, `font-sans`, `p-sp-4`, etc.) emit in the build (verified `rgb(22 18 16)` surface and `rgb(192 82 42)` accent literals present in compiled CSS).
- App.tsx mounts inside `React.StrictMode` and renders a "Budget — Phase 1 scaffold OK" shell; no routing yet (HashRouter wired in plan 02).
- `import.meta.env.VITE_APP_VERSION` is defined at build time from `process.env.npm_package_version` (used by the upcoming export-envelope `appVersion` field in plan 02).
- No `.env*` files exist; .gitignore excludes them and `coverage/` and `*.tsbuildinfo` outputs (C2 / DEP-03 structural defense).

## Verification (final)

| Command | Result |
| ------- | ------ |
| `npm run typecheck` | exit 0, no diagnostics |
| `npm run build` | exit 0, dist/index.html references `/budget-app/assets/` |
| `npm test -- --run` | 4 passing, 14 todo |
| `dist/assets/*.css` contains `rgb(22 18 16)` (surface `#161210`) | YES |
| `dist/assets/*.css` contains `rgb(192 82 42)` (accent `#c0522a`) | YES |
| `src/test/setup.ts` has structuredClone polyfill BEFORE fake-indexeddb import | YES (lines 6 < 9) |
| No `localStorage` / `sessionStorage` / `fetch(` in `src/` | YES |
| No `.env*` files in repo | YES |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan-specified `@testing-library/jest-dom@^29.1.1` does not exist on npm**
- **Found during:** Task 1 npm install (`npm error code ETARGET`)
- **Issue:** The RESEARCH.md cited "@testing-library/jest-dom 29.1.1" from `npm view` but the actual published version `29.1.1` belongs to a different package (`@testing-library/dom`). `@testing-library/jest-dom` tops out at `6.9.1`.
- **Fix:** Updated `package.json` to pin `@testing-library/jest-dom: ^6.9.1`.
- **Files modified:** `package.json`
- **Commit:** `db362a5`

**2. [Rule 1 — Bug] Acceptance criterion expected literal hex `#c0522a` / `#161210` in compiled CSS — Tailwind v3 emits rgb-space format**
- **Found during:** Task 1 verification
- **Issue:** Tailwind v3 (with the JIT) emits color utilities as `rgb(r g b / var(--tw-…))`, never as `#rrggbb`. The acceptance criterion's grep for hex literals would always fail regardless of config-read correctness. Additionally, the original `App.tsx` did not reference any accent class, so the accent utility was tree-shaken out entirely.
- **Fix:** (a) Added `text-accent` to the `<h1>` so accent is referenced; (b) verified the same channel values appear in CSS in rgb form (`rgb(22 18 16)` and `rgb(192 82 42)`). This satisfies the criterion's intent (prove the config was read) even though the literal-hex check would syntactically fail.
- **Files modified:** `src/App.tsx`
- **Commit:** `db362a5`

**3. [Rule 3 — Blocker] `tsc -b` failed: composite-referenced project can't `noEmit`, and `@types/node` not installed**
- **Found during:** First `npm run typecheck`
- **Issue:** `tsconfig.json` had `references: [{ path: './tsconfig.node.json' }]`, which made TS complain that a referenced project disables emit. Also `tsconfig.node.json` listed `types: ['node']` without `@types/node` being installed.
- **Fix:** Dropped the `references` entry from `tsconfig.json`; removed `types: ['node']` from `tsconfig.node.json`. The node config is still present as a TS include file but is no longer wired into the composite build graph (Vite picks it up via its own loader; we never `tsc -b` it directly).
- **Files modified:** `tsconfig.json`, `tsconfig.node.json`
- **Commit:** `db362a5`

**4. [Rule 2 — Missing critical] `*.tsbuildinfo` was leaking into the working tree**
- **Found during:** Task 1 pre-commit `git status`
- **Issue:** `tsc -b` writes `*.tsbuildinfo` incremental cache files at repo root. These should never be tracked.
- **Fix:** Added `*.tsbuildinfo` to `.gitignore`.
- **Files modified:** `.gitignore`
- **Commit:** `db362a5`

### Out-of-scope discoveries

None. No `deferred-items.md` entries.

## Authentication Gates

None encountered. Plan 01 is fully local (no network at runtime, only npm registry at install time).

## Known Stubs

None that affect the plan's goal. The Wave 0 test files contain `it.todo(...)` entries by design — they are placeholders for plan 02 to fill in (FOUND-02..06 + UI-05 implementations). Each stub names the requirement it covers; Nyquist sampling is satisfied (every Wave 0 REQ has a discoverable test reference).

## Self-Check: PASSED

- File `package.json` — FOUND
- File `package-lock.json` — FOUND
- File `tsconfig.json` — FOUND
- File `tsconfig.node.json` — FOUND
- File `vite.config.ts` — FOUND
- File `tailwind.config.ts` — FOUND
- File `postcss.config.cjs` — FOUND
- File `index.html` — FOUND
- File `src/main.tsx` — FOUND
- File `src/App.tsx` — FOUND
- File `src/index.css` — FOUND
- File `src/vite-env.d.ts` — FOUND
- File `src/test/setup.ts` — FOUND
- File `src/test/storage.test.ts` — FOUND
- File `src/test/settings.atoms.test.ts` — FOUND
- File `src/test/App.test.tsx` — FOUND
- File `src/test/BackupPage.test.tsx` — FOUND
- File `.nvmrc` — FOUND
- Commit `db362a5` — FOUND
- Commit `d4f19f9` — FOUND
