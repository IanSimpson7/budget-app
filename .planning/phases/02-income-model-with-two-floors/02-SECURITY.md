---
phase: 02
slug: income-model-with-two-floors
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-28
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| imported JSON file → storage | Untrusted backup file crosses into persistence on `importAll` | Backup envelope (schemaVersion + data) |
| pasted free text → parser → confirm → storage | Untrusted statement text is parsed, user-reviewed, then only checked rows persist | Free text → candidate rows → IncomeCheck |
| form input → storage | User-typed check fields cross into persistence | date, netAmount, source, note |
| derived atoms → presentation | Read-only display of computed values; no new input boundary | Derived numeric/financial values |
| (no network / no credentials) | Local-only app, no backend, no auth, no secrets (C2/C3) | — |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Tampering | `importAll` envelope (storage.ts) | mitigate | `isPlainObject` + numeric `schemaVersion` + `isPlainObject(data)` gates persistence (storage.ts:164-205); `migrate_1_to_2` adds only `knownSources: []`, no surface widening (migrations.ts:25-34) | closed |
| T-02-02 | Tampering / spec | storage.ts public surface | mitigate | C2/C3 enforced by ABSENCE of credential/money-move methods; absence proof in storage.test.ts:30-46 (runtime `toBeUndefined()` + `@ts-expect-error` compile-time) | closed |
| T-02-03 | Integrity | conservative auto-check (classify.ts) | mitigate | `defaultChecked` returns true only for credits with `TYPE: PAYROLL` or known-source match (classify.ts:83-95); asset sale + gift excluded from committed set; no derived value persisted | closed |
| T-02-04 | Integrity | derived atoms / DashboardPage | mitigate | Dashboard uses `useAtomValue` on read-only derived atoms only; no write atom imported; persists nothing (FOUND-06) (DashboardPage.tsx:31-39) | closed |
| T-02-05 | Tampering (correctness) | `backfillActiveAtom` + surplus↔backfill swap | mitigate | Defended-line trigger compares `projectedMonthPayrollAtom` (payroll-only, income.atoms.ts:84-89) against defended line (124-128); gift cannot suppress the alert (D-09) | closed |
| T-02-06 | Tampering (spec) | save / commit path | mitigate | `saveIncomeCheckAtom` / `commitCheckedRowsAtom` call only `storage.addIncomeCheck(s)` + `saveKnownSources` (income.atoms.ts:142-196); no money-move/credential method | closed |
| T-02-D | Denial of Service | `parseStatement` | mitigate | Input length capped at 1,000,000 chars → RangeError (parseStatement.ts:29-33); anchored module-level regexes (no catastrophic backtracking); empty input returns `[]` (:54) | closed |
| T-02-V | Input Validation | `checkingAdapter` + CheckEntryForm | mitigate | `parseAmount` returns `undefined` on NaN, `toISO` no-throw (checkingAdapter.ts:22-36); CheckEntryForm validates real date + `netAmount > 0` + non-empty source before save (CheckEntryForm.tsx:90-93,133) | closed |
| T-02-X | XSS | source/note render (ConfirmTable, CheckEntryForm, toast) | mitigate | JSX text only (React auto-escapes); no `dangerouslySetInnerHTML`; toast copy is fixed template `Saved {n} checks.` where `n` is a count, never parsed content (PasteParseFlow.tsx:67) | closed |
| T-02-S | Spoofing | — | N/A | Single-user local app, no auth/accounts | closed |
| T-02-R | Repudiation | — | N/A | No multi-user audit requirement; single user | closed |
| T-02-I | Information Disclosure | — | N/A | No credentials/secrets stored (C2); IndexedDB is per-device by design | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-28 | 12 (9 active + 3 N/A) | 12 | 0 | gsd-security-auditor |

**Auditor note:** Code-review WR-01 (IncomeBar overflow note mixing total vs payroll income) was assessed during this audit and does NOT reopen T-02-05 — it is a cosmetic display defect on the above-threshold branch and does not feed the backfill trigger, the committed set, or any persisted value. 02-REVIEW.md CR-01 (fixed, commit 4e8d897) and WR-02..WR-08 are correctness/code-quality findings outside this register's security scope; none reopen a declared mitigation.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-28
