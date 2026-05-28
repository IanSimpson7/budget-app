<!-- GSD:project-start source:PROJECT.md -->
## Project

**Budget App**

A single-user React budgeting web app for Ian: a **floor-vs-actual dashboard** with a **pay-yourself-first surplus router**. Tracks variable commission income against a conservative passive floor and a defended-line backfill trigger, categorizes expenses as protected vs. discretionary, and recommends (but never executes) surplus sweeps to the emergency fund. The protected food floor is structurally locked — sourced read-only from a separate meal-planner system, never editable downward — because the user is in BED recovery and food restriction is the clinical trigger.

**Core Value:** **Show Ian where this month's income stands against the floor that matters, and where surplus should go first — without ever pressuring food or moving money.**

### Constraints

### Inviolable (NEVER break, any version, any reason)

- **C1 — Food floor protection**: Never gate, reduce, or suggest cutting the protected food floor. The app may compress *discretionary food volume above the floor*; the floor itself is structurally non-editable downward in the UI. Restriction is the BED clinical trigger.
- **C2 — No credentials**: No bank/brokerage API, no stored passwords, no live account linking. All data enters manually (typed, paste-parsed, OCR later). If a backend is ever added, it must not store credentials.
- **C3 — No money movement**: App computes and recommends allocations. Ian executes every transfer himself. App is advisor, never actor. No trade execution, no transfers, no auto-routing.

### Design

- **Tech**: Vite + React (web app, not single-file artifact). Component structure, state management, responsive. TypeScript strongly preferred for the contracts (FoodNeed, Floors, SurplusPlan).
- **Persistence**: IndexedDB behind a storage abstraction; JSON export/import for backup. Local-only.
- **Deploy**: GitHub Pages static build. Phone is view-mostly; laptop is data source-of-truth.
- **Derived values recompute**: survival floor, EF targets, surplus, food floor — never stored as stale copies.
- **One generic sinking-fund primitive**: future instances (car fund, etc.) are zero-rework.
- **Solvency math uses the passive floor, never the average or the $3,000 defended line.**
- **Two floors, two jobs**: passive floor for solvency math, $3,000 for backfill-trigger alerts.
- **Budget on 2 checks/month**: extra (3rd) check in a month is surplus, never new baseline.

### Calibration

User operates at systems-architect level. Make independent architectural decisions, debug via refinement cycles, explain mechanisms over outcomes. Depth over speed. Leverage-pause on the single most determinative decision (state/data-model architecture) before proceeding.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture is mapped — see `## Architecture pointers (post-Phase-1)` below and `.planning/phases/01-foundation-storage-deploy/SKELETON.md` for the authoritative source.
<!-- GSD:architecture-end -->

## Stack (post-Phase-1)

Pinned versions in production as of Phase 1 (foundation-storage-deploy):

- **React 19.2.x** + react-dom 19.2.x
- **Vite 8.0.12** (build tool; `base: '/budget-app/'` for Pages subpath)
- **TypeScript ~5.6** (strict mode; `tsc -b` runs before `vite build`)
- **Jotai 2.20.0** — atom-based state, colocated per domain, no central store
- **Dexie 4.4.2** — IndexedDB wrapper behind the storage abstraction
- **react-router-dom 7.x** — **HashRouter** (required for GitHub Pages subpath, no server rewrites)
- **`tailwindcss` 3.4.x** — **PIN v3** (do NOT upgrade to v4; the config-file + token model this project depends on changed in v4)
- **Vitest 4.1.6** + React Testing Library + `fake-indexeddb` + `structuredClone` polyfill (test env)
- **lucide-react** — icons
- **Deploy:** GitHub Pages via `actions/deploy-pages` (no `gh-pages` branch); workflow at `.github/workflows/deploy.yml`

## Conventions (post-Phase-1)

- **Colocated atoms:** `src/domains/<domain>/<domain>.atoms.ts`. No central store file.
- **Single storage abstraction:** `src/storage/storage.ts` is the ONLY file domain code imports for persistence. Domain code never touches Dexie or IndexedDB directly.
- **Migrations are pure functions** used by BOTH the Dexie upgrade callback AND the JSON import path — one source of truth for schema evolution.
- **All UI tokens from `tailwind.config.ts`** — no inline hex anywhere in source.
- **All interactive elements `min-h-[44px]`** — phone tap-target floor.
- **All financial values rendered in `font-mono`.**
- **no atomWithObservable** until Phase 2 (a React 19 interaction bug blocks it for now).
- **No `localStorage` / `sessionStorage` anywhere in source** — persistence is IndexedDB via the storage abstraction only.

## Architecture pointers (post-Phase-1)

- **Architectural source of truth for Phases 2–5:** `.planning/phases/01-foundation-storage-deploy/SKELETON.md`.
- **Phase 2** will introduce reactive `atomWithObservable + liveQuery` for the dashboard (lifts the Phase-1 ban once the React 19 path is validated).
- **Phase 4** will introduce a `foodFloor` settings key guarded by the **C1 lock** (food floor never editable downward).

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
