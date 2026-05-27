# Phase 1: Foundation, Storage, Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 1-Foundation, Storage, Deploy
**Areas discussed:** State management architecture, IndexedDB wrapper choice, Data model + schema versioning, Phase 1 placeholder UI scope

---

## State Management Architecture (LEVERAGE-PAUSE-1)

| Option | Description | Selected |
|--------|-------------|----------|
| React Context + useReducer | Built-in, no deps. Every component reading a context re-renders on any change to it. Hand-splitting contexts becomes the plumbing tax. | |
| Zustand | Single store, selector hooks. Conventional, popular, easy. Derived values are selector functions you maintain. | |
| Redux Toolkit | Established patterns, devtools, Immer. Heavier boilerplate. Designed for huge apps with async middleware ecosystems we don't have. | |
| Jotai | Atomic state with derived atoms. `derivedAtom = atom(get => fn(get(a), get(b)))` makes recompute-on-change the library's default behavior. | ✓ |

**User's choice:** Jotai
**Notes:** Ian asked for foundational explanation ("I am completely unfamiliar with any of these things"). Walked through state-management problem space → Context's re-render limitation → why external libs exist → mechanism of each option. Recommendation explicitly tied to spec FOUND-06 ("derived values recompute, never store stale copies") — Jotai's derived atoms ARE that rule. Ian self-checked his understanding ("changing one part of the context [doesn't make] everything else too heavy or break the system entirely"); corrected to "everything re-renders" rather than "everything changes" and added the positive feature of derived atoms. Confirmed open-source/free ("Is it free?" → yes, MIT). Locked.

---

## IndexedDB Wrapper Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Dexie.js (~22KB) | Full wrapper with schema declarations, indexed queries, built-in migration ladder. ORM-ish. | ✓ |
| idb (Jake Archibald, ~1.5KB) | Thin promise wrapper. You still write IndexedDB primitives but with `await`. Minimal. | |
| idb-keyval (~0.6KB) | localStorage-like API over IndexedDB. Loses indexing entirely. | |

**User's choice:** Dexie.js
**Notes:** Asked Ian if he wanted a jargon-free explanation while moving to next area; provided one — IndexedDB as the browser's built-in database, why raw API is hostile (callback-based, transaction-scoped), what Dexie sits on top to provide. Three reasons for Dexie: (1) real 10-entity schema deserves declaration, (2) date-range queries on income/expenses benefit from Dexie's indexing, (3) Dexie's migration system answers the schema-versioning question that was next on the list. 22KB bundle cost explicitly named.

---

## Data Model Organization + Schema Versioning

| Option | Description | Selected |
|--------|-------------|----------|
| 4 collection tables + 1 settings key-value table | Collections (incomeChecks, expenseItems, sinkingFunds, accounts) get indexed tables; singletons (floors, EF, foodFloor, flavorLine, unitCostMap, portionModel) live as keyed rows in one settings table. | ✓ |
| Separate Dexie table per singleton | Each singleton gets its own one-row table. More ceremony, more tables. | |
| Mix Dexie (collections) + idb-keyval (singletons) | Two libraries side by side. More dependencies, more mental model. | |

**Schema versioning sub-decision:**

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned export envelope with shared migration ladder | Every export has `{schemaVersion, exportedAt, appVersion, data}`. Migration functions `migrate_N_to_N+1(data)` shared by Dexie upgrades AND JSON imports. Refuse newer-version imports rather than coercing. | ✓ |
| Implicit versioning (just dump `db.export()`) | Simpler now, painful later when schema evolves and old backups won't load. | |

**User's choice:** Both as recommended ("works fine for me")
**Notes:** Ian asked one clarifying question — confirmed flavor line = seasonings/sauces/syrups, the protected ~$50/mo line per spec §5d. Otherwise accepted the recommendation directly. Phase 1 ships schemaVersion: 1; Phase 4 will bump to 2 when FoodFloor fields land.

---

## Phase 1 Placeholder UI Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Settings + Backup surfaces with three editable floor params | Settings: passive floor (default 2400), defended line (default 3000), food floor seed (default 550). Backup: Export + Import buttons. No dashboard, no entry, no other surfaces. | ✓ |
| Generic "type a value" placeholder | Cheaper to ship but throwaway. Doesn't reuse into Phase 2. | |
| Full dashboard skeleton with placeholder values | Premature. Phase 2 will reshape it once income model lands. | |

**User's choice:** Settings + Backup with three editable floor params ("It looks good to me")
**Notes:** Aligned with FOUND-05 (all floors stored as editable parameters from day one) and Phase 2's needs (passive floor and defended line are load-bearing for the income solvency math). Phase 1 ships verifiably done: open URL on phone, change a number, refresh, see it persist; export JSON, import on another device, see it restored.

---

## Claude's Discretion (decided independently per spec calibration)

- **Routing**: react-router-dom with HashRouter (avoids GH Pages SPA subpath issue). Routes `/settings`, `/backup` in Phase 1; future surfaces drop in without architectural change.
- **Testing**: Vitest + React Testing Library scaffolded in Phase 1. Financial-app derived values are exactly the kind of pure logic unit tests catch best.
- **TypeScript strictness**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Vite `base` config**: derived from repo name at build time; assume `budget-app` until reconfirmed at plan-phase.
- **Bundle target**: modern evergreen browsers only (last 2 majors); no legacy polyfills.
- **Styling library**: deferred to plan-phase (Tailwind likely, CSS modules acceptable fallback).

---

## Deferred Ideas

- **Custom domain for GitHub Pages** — not raised; `simpsonian354.github.io/budget-app/` is fine; CNAME later if wanted.
- **Service worker / offline-first** — IndexedDB works offline once loaded; a service worker would make initial load offline too. v2 nice-to-have.
- **Encryption at rest** — no credentials in this app per C2, so threat model doesn't justify the complexity. Revisit only if v2 stores PII (which it won't).
- **Receipt-via-Gmail-API integration** — discussed during project init; Ian explicitly chose not to pursue ("nah it's probably not worth doing"). Out of v1 and v2.

---

*Phase: 1-Foundation-Storage-Deploy*
*Discussion logged: 2026-05-27*
