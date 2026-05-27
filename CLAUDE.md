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

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

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
