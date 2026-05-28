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

## Status
- [x] Phase 1 — Foundation, Storage, Deploy
- [ ] Phase 2 — Income Model with Two Floors
- [ ] Phase 3 — Expense Model + Sinking Funds
- [ ] Phase 4 — Food Contract (Locked Floor)
- [ ] Phase 5 — Surplus Router + Unified Dashboard

Full spec: `../../roles/FinancialAdviser/specs/budgeting_app_spec_v1.md` (workspace-relative).
Planning artifacts: `.planning/`.
