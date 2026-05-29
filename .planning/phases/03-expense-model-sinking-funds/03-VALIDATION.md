---
phase: 3
slug: expense-model-sinking-funds
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + React Testing Library + fake-indexeddb |
| **Config file** | `vitest.config.ts` (existing — installed Phase 1) |
| **Quick run command** | `npm run test -- --run <file>` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run <file>`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

> Populated by the planner. Critical behaviors flagged by RESEARCH.md Validation Architecture:
> classification correctness, survival-floor live recompute, sinking-fund accrual math,
> payout-without-shock, second-instance-no-code-change, no-double-count (car insurance),
> whey/supplements excluded from fixed-ex-food (C1 placeholder), export/import stub wiring.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for expense classification + survival-floor derivation (EXP-01..04, EDGE-06)
- [ ] Test stubs for sinking-fund accrual + payout-no-shock (EXP-05, EXP-06)
- [ ] `collectSchemaV1Data` / `replaceAll` export-import stub wiring test (per RESEARCH pitfall)
- [ ] No-double-count regression test (car insurance not in both expense line and fund)

*Existing vitest + fake-indexeddb infrastructure covers the framework; no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phone-readable protected-vs-gateable + funds layout | UI-04 | Visual/responsive on real device | Open live URL on phone, verify no horizontal scroll, tap targets ≥44px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
