---
phase: 03
slug: expense-model-sinking-funds
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-29
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Single-user, local-only React app. No network surface, no credentials (C2). The only untrusted-input boundary is the JSON backup import; the app never moves money (C3) and never gates/reduces the protected food floor (C1).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| JSON import file → `storage.replaceAll` | Untrusted backup content crosses into IndexedDB; the only credential-free external surface in the app (C2) | Expense + fund + settings records (financial values) |
| Form input → storage write | User-typed name/amount/accrual crosses into IndexedDB via guarded `addExpenseItem` / `addSinkingFund` | Financial field values |
| Atom derivation → dashboard render | Derived survival-floor / accrual values must render finite currency, never NaN-corrupt | Derived numeric values |
| mark-paid action → storage write | Records a user-asserted real-world payout; the app performs NO money movement (C3) | Fund balance reset + payout-date advance (DB state only) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Tampering | `importAll`/`replaceAll` on crafted backup (NaN/negative/non-finite financial fields) | mitigate | `Number.isFinite` guards in replaceAll insert loops reject non-finite (`storage.ts:347-349` expense, `:357-359` fund); round-trip + malformed-value tests (`storage.expenses.test.ts:167`, `storage.funds.test.ts:145`) | closed |
| T-03-02 | Tampering | `addExpenseItem`/`addSinkingFund` writing NaN that propagates to `survivalFloorAtom` | mitigate | Storage-write throw on non-finite (`storage.ts:72-74` expense; `:127-132` fund annualAmount + monthlyAccrual); unit tests assert throw | closed |
| T-03-03 | Tampering | Hypothetical money-movement / credential method on storage surface (C2/C3 erosion) | mitigate | Structural — no such method added; absence-proof assertions hold (`storage.test.ts:30-46`: `saveCredentials`/`setApiKey`/`storeBankToken`/`moveMoney`/`executeSweep`/`decreaseFoodFloor` all `undefined`) | closed |
| T-03-04 | Tampering | Prototype pollution via `__proto__` keys in imported settings | accept | Settings written via `db.settings.put({key,value})` with explicit keys; `Object.entries()` (`storage.ts:333`) does not yield `__proto__`; local single-user, no network (C2) — protection stronger than the acceptance claim required | closed |
| T-03-05 | Tampering | Amount field accepting NaN/empty propagating to survival floor | mitigate | `canAdd` requires finite positive amount (`ExpensesPage.tsx:194`, EditRow `:71`); `disabled={!canAdd}` (`:240`); storage throw as defense in depth (`storage.ts:72-74`) | closed |
| T-03-06 | Information Disclosure | EXP-07 advisory must NOT block user (clinical-safety posture — never restrict food/supplement entry) | accept | Advisory is soft `TextInput helper` text only (`ExpensesPage.tsx:220-223`); zero involvement in `canAdd` (`:194`) — submit stays enabled, aligning with C1 | closed |
| T-03-07 | Denial of Service | Async `survivalFloorAtom` suspending dashboard without a boundary | mitigate | `<Suspense>` wraps route tree (`App.tsx:1,20`); `useAtomValue(survivalFloorAtom, { delay: 0 })` (`DashboardPage.tsx:41`) | closed |
| T-03-08 | Tampering | mark-paid/add-fund mutating fund state to simulate a transfer (C3 erosion) | mitigate | Structural — FundsPage imports only `save/update/delete/markFundPaid` atoms; `markFundPaidAtom` calls only `updateSinkingFund`/`deleteSinkingFund` (`funds.atoms.ts:90-111`); no transfer/execute affordance in any fund UI file | closed |
| T-03-09 | Tampering | annualAmount/monthlyAccrual/balance entered as NaN or negative | mitigate | Storage-layer throw (`storage.ts:127-132`); `canAdd` requires finite positive annualAmount (`FundsPage.tsx:226-230`); non-finite monthlyAccrual fallback prevents NaN reaching storage (`:237`) | closed |
| T-03-10 | Repudiation | Provisional car-insurance target silently locked, preventing renewal update | accept | UI never locks the target — EditForm always exposes editable `annualAmount` NumberInput with no disabled/readonly (`FundsPage.tsx:85-93`); provisional flag drives advisory text only (`FundCard.tsx`); aligns with D-05 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-04 | Prototype pollution via imported `__proto__` settings key — local single-user app, no network surface (C2); `Object.entries()` iteration does not yield `__proto__`; Dexie does not eval keys. Low residual risk. | Ian Simpson | 2026-05-29 |
| AR-03-02 | T-03-06 | EXP-07 whey/supplement advisory is intentionally non-blocking. Restricting food/supplement entry is the BED clinical trigger; soft advisory is the deliberate clinical-safety posture (C1). | Ian Simpson | 2026-05-29 |
| AR-03-03 | T-03-10 | Provisional sinking-fund target is intentionally always editable (never locked) so Ian can update at renewal (D-05). Informational advisory only. | Ian Simpson | 2026-05-29 |
| AR-03-04 | REVIEW WR-05 | No runtime guard against entering car insurance as BOTH an expense line and a sinking fund, which would double-count it in the survival floor. Data-integrity gap, not a security threat; C2/C3 unaffected. A soft advisory (mirroring EXP-07) is a candidate follow-up. | Ian Simpson | 2026-05-29 |
| AR-03-05 | REVIEW WR-06 | EXP-07 advisory is not wired to the expense EDIT path — renaming an item to "whey protein" via edit shows no advisory. UX-consistency gap in a C1-adjacent feature; C1 itself (floor never gated/reduced) is fully intact; edit gate behavior unchanged. | Ian Simpson | 2026-05-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-29 | 10 | 10 | 0 | gsd-security-auditor (Claude) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-29
