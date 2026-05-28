---
phase: 01
slug: foundation-storage-deploy
status: draft
created: 2026-05-28
---

# Walking Skeleton — Budget App Phase 1

> The thinnest possible end-to-end working slice that proves the full stack.
> Every Phase 1 plan builds toward or IS this skeleton.

---

## User Story (verbatim from ROADMAP)

**As a** solo user (Ian, on his phone), **I want to** open the deployed GitHub Pages URL, change the passive floor value in Settings, refresh the browser, and see my value persist; then export a JSON backup file, **so that** I have proof the app's persistence + deploy pipeline works end-to-end before any income/expense logic is built.

---

## The Skeleton Slice (end-to-end)

```
Phone browser → https://simpsonian354.github.io/budget-app/#/settings
        ↓
React 19 app (HashRouter) renders SettingsPage
        ↓
useAtomValue(floorsLoadAtom)  ──── plain async Jotai atom (NOT atomWithObservable)
        ↓
storage.getFloors()             ──── abstraction module above Dexie
        ↓
db.settings.get('floors')       ──── Dexie 4.4.2 → IndexedDB
        ↓
SettingsPage renders 3 number inputs (passive, defended, foodSeed)
        ↓
User edits "Passive income floor" → clicks "Save settings"
        ↓
storage.saveFloors(newFloors)
        ↓
db.settings.put({ key: 'floors', value: newFloors })
        ↓
Toast "Settings saved." (4s auto-dismiss)
        ↓
[user hard-refreshes page]
        ↓
Same load chain → new value renders → PROOF persistence works
        ↓
User navigates to /#/backup → clicks "Export backup"
        ↓
storage.exportAll() → Blob → URL.createObjectURL() → <a download>
        ↓
File saved: budget-app-backup-2026-05-28.json
        ↓
User clicks "Import backup" → file picker → confirms replace → imports
        ↓
storage.importAll(file) → schema check → migration ladder → replace all → toast
        ↓
PROOF round-trip works
```

---

## Architectural Decisions Locked Here (subsequent phases build on these)

### Framework
- **Build tool:** Vite 8.0.12 + `@vitejs/plugin-react` 6.0.1 (SWC fast refresh).
- **Runtime:** React 19.2.6 + react-dom 19.2.6.
- **Language:** TypeScript ~5.x with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` (D-17).
- **Browser target:** evergreen — last 2 majors of Chrome/Safari/Firefox + mobile Safari (D-20). No legacy polyfills.

### State Management
- **Library:** Jotai 2.20.0 (D-01).
- **Pattern:** atoms colocated with domain (`src/domains/<domain>/<domain>.atoms.ts`); no central store (D-02).
- **Phase 1 atom style:** plain async atoms (load-on-mount) — NOT `atomWithObservable + liveQuery` (React 19 re-suspension bug per RESEARCH.md Pitfall 1). Reactive `liveQuery` deferred to Phase 2.
- **Derived values:** read-only computed atoms; never persisted (FOUND-06).

### Persistence
- **DB library:** Dexie 4.4.2 (D-04). Direct Dexie usage CONFINED to `src/storage/db.ts`.
- **Storage abstraction:** `src/storage/storage.ts` exposes `getFloors`, `saveFloors`, `exportAll`, `importAll` (D-05). Domain code imports from here only — never from `db.ts`.
- **Schema (v1):**
  ```
  incomeChecks: '++id, date, source'
  expenseItems: '++id, name, category, protected, cadence'
  sinkingFunds: '++id, name, payoutDate'
  accounts:     '++id, type'
  settings:     '&key'   // singletons by key
  ```
- **Settings singletons by key:** `'floors'`, `'emergencyFund'`, `'foodFloor'`, `'flavorLine'`, `'unitCostMap'`, `'portionModel'` (D-06, D-07). Only `'floors'` populated in Phase 1.

### Export/Import Envelope
- **Schema version:** `CURRENT_SCHEMA_VERSION = 1` constant in `src/storage/schema.ts` (D-08).
- **Envelope:** `{ schemaVersion, exportedAt (ISO), appVersion (from package.json via import.meta.env), data }`.
- **Filename:** `budget-app-backup-YYYY-MM-DD.json`.
- **Migration ladder:** `src/storage/migrations.ts` — pure functions `migrate_1_to_2(data) → data` used by BOTH Dexie `.upgrade()` callbacks AND import path (D-09). No Dexie imports inside migrations.
- **Version policy (D-10/D-11):**
  - `schemaVersion < current` → run ladder → load (replace, not merge).
  - `schemaVersion > current` → REFUSE with explicit toast: "This backup was created by a newer version of the app. Update the app to import it."
  - `schemaVersion == current` → load directly (replace).
  - JSON.parse wrapped in try/catch → toast "File could not be read. Check the file is a valid budget backup."

### Routing
- **Library:** react-router-dom 7.x with **HashRouter** (D-15). GitHub Pages subpath needs no server-side redirect.
- **Phase 1 routes:** `/#/settings`, `/#/backup`. AppShell renders header + nav. Phase 2+ adds `/dashboard`, `/food`, `/entry`, `/funds` to the same nav (max 6 routes total, flat — per UI-SPEC).
- **Index redirect:** root `/` → `/#/settings` (default landing).

### Styling
- **Library:** **Tailwind v3.4.x — pin v3, NOT v4** (RESEARCH.md critical finding 1). v4 silently ignores `tailwind.config.ts`; UI-SPEC config uses v3 syntax.
- **PostCSS:** required for v3 (`postcss`, `autoprefixer`).
- **Config file:** `tailwind.config.ts` per UI-SPEC §"Tailwind Config Snippet" verbatim (custom tokens: `surface`, `accent`, `destructive`, `text-*`, sp-* spacing, font families, borderRadius 2/4px max).
- **Fonts:** Google Fonts link in `index.html` — DM Serif Display + IBM Plex Mono + IBM Plex Sans (per UI-SPEC).
- **Icons:** lucide-react 0.577.0 only.

### Testing
- **Runner:** Vitest 4.1.6 + `@testing-library/react` ~16.x + `@testing-library/jest-dom` 29.1.1 + `@testing-library/user-event` ~14.x + jsdom ~26.x + fake-indexeddb ~6.x (D-16).
- **Environment:** jsdom in `vite.config.ts` test block.
- **Setup file:** `src/test/setup.ts` — imports `fake-indexeddb/auto`, `@testing-library/jest-dom/vitest`; defines `structuredClone` polyfill (jsdom does not implement it; required by fake-indexeddb v5+ per RESEARCH.md Pitfall 4):
  ```ts
  if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
  }
  ```
- **Sampling commands:**
  - Per-task: `npm run test -- --run`
  - Per-wave: `npm run test -- --run --coverage`

### Deploy
- **Host:** GitHub Pages.
- **Repo:** `simpsonian354/budget-app` (confirmed provisional default — Ian to confirm at execution start; if different, executor updates `vite.config.ts` `base` accordingly).
- **Base path:** `base: '/budget-app/'` hardcoded in `vite.config.ts` (RESEARCH.md Open Question 3 resolved to hardcoded).
- **Source:** GitHub Pages "Source: GitHub Actions" (NOT a `gh-pages` branch — artifact-based deploy).
- **Workflow:** `.github/workflows/deploy.yml` using `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`. Trigger: push to `main`. Permissions: `pages: write`, `id-token: write`.

### Directory Layout (locked for all 5 phases)

```
budget-app/
├── .github/workflows/deploy.yml
├── public/
├── src/
│   ├── main.tsx                    # React root, JotaiProvider, HashRouter
│   ├── App.tsx                     # Route definitions
│   ├── index.css                   # Tailwind base/components/utilities + font imports
│   ├── storage/
│   │   ├── db.ts                   # Dexie subclass, version declarations
│   │   ├── schema.ts               # TS types (Floors, SettingsRow, ExportEnvelope) + CURRENT_SCHEMA_VERSION
│   │   ├── migrations.ts           # Pure migration ladder
│   │   └── storage.ts              # Public abstraction: getFloors, saveFloors, exportAll, importAll
│   ├── domains/
│   │   └── settings/
│   │       ├── settings.atoms.ts   # floorsLoadAtom, saveFloorsAtom
│   │       └── settings.types.ts   # Floors type re-export
│   ├── pages/
│   │   ├── SettingsPage.tsx
│   │   └── BackupPage.tsx
│   ├── components/
│   │   ├── AppShell.tsx            # header + nav (HashLink to /#/settings, /#/backup)
│   │   ├── NumberInput.tsx
│   │   ├── PrimaryButton.tsx
│   │   ├── SecondaryButton.tsx
│   │   ├── DestructiveButton.tsx
│   │   └── Toast.tsx               # bottom-center mobile, bottom-right desktop
│   └── test/
│       ├── setup.ts                # jest-dom + fake-indexeddb/auto + structuredClone polyfill
│       ├── storage.test.ts         # FOUND-02/03/04
│       ├── settings.atoms.test.ts  # FOUND-05/06
│       ├── App.test.tsx            # FOUND-01 smoke
│       └── BackupPage.test.tsx     # UI-05 integration
├── index.html                      # Google Fonts <link>s
├── tailwind.config.ts              # UI-SPEC verbatim — v3 syntax
├── postcss.config.cjs              # tailwindcss + autoprefixer
├── vite.config.ts                  # base: '/budget-app/', test block
├── tsconfig.json                   # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── package.json
└── CLAUDE.md                       # boot doc → points to spec
```

---

## What "Skeleton Working" Means (the gate)

All of the following must be TRUE before Phase 1 closes:

1. `npm run build` exits 0 locally.
2. `dist/index.html` contains the substring `/budget-app/assets/` (base path correct).
3. `npm run test -- --run` exits 0 with all Wave 0 tests green.
4. Push to `main` triggers `.github/workflows/deploy.yml`; Actions run finishes green.
5. `https://simpsonian354.github.io/budget-app/` resolves on Ian's phone; loads the app shell + Settings page.
6. Ian can: change Passive floor from 2400 → 2500 → Save → hard-refresh → sees 2500.
7. Ian can: click Export backup → downloads `budget-app-backup-YYYY-MM-DD.json` containing `{ schemaVersion: 1, data: { settings: { floors: { passive: 2500, ... } } } }`.
8. Ian can: click Import backup on a different device/state → file picker → "Replace and import" → toast "Backup imported. Data restored." → values match imported file.
9. Importing a file with `schemaVersion: 99` shows the version-too-new error toast and does NOT replace state.
10. Inviolable constraints are STRUCTURAL: storage abstraction interface has no `saveCredentials`/`setApiKey`/`moveMoney`/`decreaseFoodFloor` methods. TypeScript compile-time enforcement.

---

## Items Phase 1 Explicitly Does NOT Touch (scope discipline)

- Income entry, expense entry, food floor computation, dashboard, surplus router. (Phases 2–5.)
- `atomWithObservable` + `liveQuery`. (Phase 2 dashboard.)
- SMC file reads (`../schedule-meal-coordinator/`). (Phase 4.)
- Service worker / offline-first. (v2.)
- Encryption at rest. (Not in threat model; no credentials per C2.)
- Custom domain. (Default `<user>.github.io/budget-app/` is fine.)

---

*Skeleton drafted: 2026-05-28. Locks architecture for Phases 2–5.*
