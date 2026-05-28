---
phase: 01-foundation-storage-deploy
plan: 03
subsystem: infra
tags: [github-actions, github-pages, vite, deploy, ci, docs]

# Dependency graph
requires:
  - phase: 01-02
    provides: Walking-skeleton app (Dexie storage, settings atoms, Settings/Backup pages, HashRouter App shell)
  - phase: 01-01
    provides: Vite+React+TS scaffold, .nvmrc, pinned tailwindcss v3, test infra
provides:
  - Live GitHub Pages deployment at https://iansimpson7.github.io/budget-app/
  - GitHub Actions deploy workflow (push-to-main → build → test gate → deploy-pages)
  - CLAUDE.md post-Phase-1 Stack / Conventions / Architecture-pointers sections
  - README.md with live URL, inviolable constraints, dev/deploy steps, phase status
affects: [phase-2-income, all-future-phases-deploy-on-push]

# Tech tracking
tech-stack:
  added: [actions/checkout@v4, actions/setup-node@v4, actions/configure-pages@v4, actions/upload-pages-artifact@v3, actions/deploy-pages@v4]
  patterns: [push-to-main auto-deploy, test-gate-before-build, deploy-pages artifact flow (no gh-pages branch)]

key-files:
  created:
    - .github/workflows/deploy.yml
    - README.md
    - .planning/phases/01-foundation-storage-deploy/01-03-SUMMARY.md
  modified:
    - CLAUDE.md

key-decisions:
  - "GitHub coordinates confirmed: account IanSimpson7, repo budget-app — matches the hardcoded vite base '/budget-app/', so no vite.config.ts change needed"
  - "Test gate (npm run test -- --run) runs BEFORE npm run build in the workflow — a failing test blocks deploy"
  - "Pages source set to 'GitHub Actions' (artifact flow), not a gh-pages branch"
  - "All workflow actions are official GitHub-owned (actions/* namespace), pinned to MAJOR version tags per T-01-13"

patterns-established:
  - "Auto-deploy: every push to main runs deploy.yml; workflow_dispatch allows manual re-run from the Actions tab"
  - "Docs reflect deployed reality: README live URL + CLAUDE.md Stack/Conventions/Architecture pointers are the orientation surface for future sessions"

requirements-completed: [DEP-01, DEP-02, DEP-03, UI-05, FOUND-01]

# Metrics
duration: ~25min (across checkpoint resumes)
completed: 2026-05-28
---

# Phase 1 Plan 03: GitHub Pages Deploy + Phone Verification Summary

**Budget App is live and phone-reachable at https://iansimpson7.github.io/budget-app/ — every push to main now auto-builds, test-gates, and deploys via GitHub Actions. Phase 1 is complete.**

## Performance

- **Duration:** ~25 min (spanning checkpoint pauses for repo-coordinate decision and phone verification)
- **Completed:** 2026-05-28
- **Tasks:** 4/4 (2 checkpoints + 2 auto)
- **Files modified:** 3 (deploy.yml created, README.md created, CLAUDE.md modified)

## Accomplishments

### Task 1 — GitHub repo coordinates (checkpoint:decision)
Ian confirmed account **IanSimpson7**, repo **budget-app**. This matches the hardcoded `base: '/budget-app/'` in vite.config.ts — no config change or rebuild required (option-a path).

### Task 2 — Deploy workflow + push (auto, commit 292c0cc)
Created `.github/workflows/deploy.yml`: `on push:[main]` + `workflow_dispatch`; permissions `contents:read / pages:write / id-token:write`; concurrency `group:pages cancel-in-progress:true`; single `deploy` job with 8 steps (checkout → setup-node via `.nvmrc` + npm cache → `npm ci` → `npm run test -- --run` → `npm run build` → configure-pages → upload-pages-artifact `./dist` → deploy-pages). First run on commit `292c0cc` completed **green**.
- Run: https://github.com/IanSimpson7/budget-app/actions/runs/26565927728 (conclusion: success)

### Task 3 — Phone verification (checkpoint:human-verify)
Ian confirmed **"it works from my phone"** — the live app loads and renders on his phone. Phone-verify APPROVED. All Phase 1 ROADMAP success criteria (phone-reachable, persistence across reload, export/import, auto-deploy) confirmed by Ian's device test.

### Task 4 — Docs update (auto, commit 9c115ff)
- **CLAUDE.md:** added `## Stack (post-Phase-1)` (pinned versions incl. `tailwindcss` 3.4.x v3 pin), `## Conventions (post-Phase-1)` (colocated atoms, single storage abstraction, pure migrations, tailwind tokens, `min-h-[44px]`, no atomWithObservable, no localStorage), `## Architecture pointers (post-Phase-1)` (SKELETON.md as source of truth, Phase 2 atomWithObservable+liveQuery, Phase 4 foodFloor C1 lock). All original inviolable-constraints / design / calibration content preserved.
- **README.md:** created with live URL, three inviolable constraints, dev steps, deploy flow, 5-phase status (Phase 1 checked).

## Requirements Completed

| ID | Status | Evidence |
|----|--------|----------|
| FOUND-01 | ✓ | App shell + routing live on deployed URL |
| UI-05 | ✓ | Settings/Backup pages render on phone (Ian verified) |
| DEP-01 | ✓ | Static bundle deployed to GitHub Pages (green run + reachable URL) |
| DEP-02 | ✓ | Actions workflow builds + deploys on push to main (run 26565927728 success) |
| DEP-03 | ✓ | No external credentials at runtime (source grep in plan 01 + Task 3 step-10 network-tab guidance; only Google Fonts, no creds) |

Phase 1 full requirement set (FOUND-01..06, UI-05, DEP-01..03) closed across plans 01-01, 01-02, 01-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Doc consistency] `tailwindcss` literal token added to CLAUDE.md Stack section**
- **Found during:** Task 4 verification
- **Issue:** Stack section initially read "Tailwind 3.4.x", but the plan's automated verify (`grep -q 'tailwindcss' CLAUDE.md`) and acceptance criterion require the literal package name `tailwindcss`.
- **Fix:** Changed the bullet to `` `tailwindcss` 3.4.x ``.
- **Files modified:** CLAUDE.md
- **Commit:** 9c115ff

**2. [Rule 3 — Structure] CLAUDE.md uses GSD-managed sentinel sections, not a "Build order (suggested)" section**
- **Issue:** The plan said to add the three new sections "AFTER the existing 'Build order (suggested)' section." The current CLAUDE.md has no such section — it uses GSD sentinel-bounded `## Technology Stack` / `## Conventions` / `## Architecture` placeholders.
- **Fix:** Added the three literal-named sections (`## Stack (post-Phase-1)`, etc.) immediately after the GSD architecture block, satisfying the acceptance criteria for literal headers while leaving all original (inviolable constraints, design, calibration, GSD) content intact. Pointed the GSD Architecture placeholder at the new section.

## Follow-ups / Open Items for Phase 2

- **[DATED — act before 2026-06-02] Bump GitHub Actions major-version tags.** The `@v4`/`@v3` actions in `deploy.yml` currently run on Node 20. GitHub force-migrates Actions runners to Node 24 on **2026-06-02**; bump the action tags (checkout, setup-node, configure-pages, upload-pages-artifact, deploy-pages) to their latest majors before then to avoid deprecation-warning → eventual failure. Tracked also in deferred-items.md.
- Phase 2 lifts the `atomWithObservable` ban — validate the React 19 `atomWithObservable + liveQuery` path for the dashboard.
- T-01-16 (multi-tab IndexedDB upgrade) only validated single-tab in Phase 1; Phase 2 schema bump should exercise the `versionchange` close path.
- T-01-08: `floors.foodSeed` is user-editable both directions in Phase 1; the C1 downward-lock applies to the future Phase 4 `settings['foodFloor']` singleton specifically.

## Known Stubs

None blocking. The deployed app is the intended Phase-1 walking skeleton (Settings + Backup only); Phases 2–5 build the income/expense/food/surplus surfaces. Default floor values (passive ~2400, etc.) are intentional seeds, documented in STATE.md "Provisional values to converge during build."

## Self-Check: PASSED
- `.github/workflows/deploy.yml` — FOUND
- `README.md` — FOUND
- `CLAUDE.md` (Stack/Conventions/Architecture-pointers sections) — FOUND
- Commit 292c0cc (deploy workflow) — FOUND in git log
- Commit 9c115ff (docs) — FOUND in git log
- Actions run 26565927728 — conclusion: success
