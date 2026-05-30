# Budget App

Personal floor-vs-actual budgeting dashboard with EF-first surplus router. Single-user, local-only, no credentials.

**Live:** https://iansimpson7.github.io/budget-app/  (Phase 1 — Settings + Backup only)

## Three Inviolable Constraints
- C1: Food floor never gated, reduced, or suggested as a cut
- C2: No bank credentials, no bank/brokerage API, ever
- C3: App never moves money / executes trades

## Dev
- `nvm use` (Node 20 per .nvmrc)
- `npm install`
- `npm run dev` — local dev server (typically http://localhost:5173/budget-app/)
- `npm run test -- --run` — full test suite
- `npm run build` — production build to `dist/`

## Deploy
Push to `main` → GitHub Actions runs `.github/workflows/deploy.yml` → GitHub Pages serves `dist/` at the URL above. Repo Settings → Pages → Source must be "GitHub Actions".

## Food floor and SMC plan data (V8 — v1 deploy reality)

The food floor is computed from scheduled meal names in `../schedule-meal-coordinator/plans/*.md`.
These files are bundled into the app at **build time** via Vite's `import.meta.glob` — there is no runtime filesystem access.

**v1 deploy flow:** The GitHub Actions runner does NOT check out the `schedule-meal-coordinator` repo, so `import.meta.glob` resolves **0 plan files** on CI. The deployed app always shows the stale/fallback floor (the `max(lastComputed, allTimeHighWater)` value, defaulting to ~$550/mo seed). This is expected and documented v1 behavior.

**To publish new plan data to the live app:**
1. Ensure `../schedule-meal-coordinator/plans/` is up to date on your local machine.
2. Run `npm run build` (this bundles the current plan files into `dist/`).
3. `git push` — the Actions workflow deploys the freshly built `dist/`.

**Live wiring (SMC-01):** Automatic CI bundling of the SMC repo is deferred to v2. The food floor UI badge will show "Needs attention" on the deployed app until Ian runs a local build and pushes it.

## Status
- [x] Phase 1 — Foundation, Storage, Deploy
- [ ] Phase 2 — Income Model with Two Floors
- [ ] Phase 3 — Expense Model + Sinking Funds
- [ ] Phase 4 — Food Contract (Locked Floor)
- [ ] Phase 5 — Surplus Router + Unified Dashboard

Full spec: `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` (workspace-relative).
Planning artifacts: `.planning/`.
