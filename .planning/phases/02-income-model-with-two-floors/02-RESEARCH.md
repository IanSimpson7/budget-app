# Phase 2: Income Model with Two Floors - Research

**Researched:** 2026-05-28
**Domain:** Reactive client state (Jotai + Dexie liveQuery under React 19), free-text statement parsing, derived financial computation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
These are LOCKED by `02-CONTEXT.md` D-01..D-14. Research investigates THESE, not alternatives.

**Paste-Parse Pipeline (INC-08, UI-03):**
- **D-01:** Generic statement parser with a `statementType` seam. Pipeline shape: `raw text → candidate rows → editable confirm table → commit`. Phase 2 builds **core + checking adapter** only (proven against Ian's real statement sample). Phase 3 adds the CC/itemized adapter. The pipeline shell must be account/format-agnostic so Phase 3 reuses it without reshaping the model.
- **D-02:** Block-based parsing, not line-based. A block begins at a line matching `^\d{2}/\d{2}/\d{4}` (MM/DD/YYYY) and accumulates following lines until the next date-line or EOF. Multi-line metadata (`TYPE:/ID:/CO:/DATA:/NAME:/Card #`) belongs to the block. Skip a leading header row (`Date Description Amount Balance`).
- **D-03:** Field extraction. Trailing two comma-formatted decimals in a block = `(netAmount, balanceAfter)`. `date` ← MM/DD/YYYY→ISO. `netAmount` ← first trailing number, commas stripped, signed. `source` ← `CO:` value if present, else first description line (after "ACH Deposit"). `note` ← raw block text (preserves TYPE/ID for audit).
- **D-04:** Credit vs. debit is deterministic, not guessed. Primary signal = sign of the Amount column. Fallback (sign absent) = sign of `balanceAfter − previousBalanceAfter`. First block (no prior balance) falls back to "Deposit/Debit" wording.
- **D-05:** Conservative auto-check in the confirm step — never silently drop. All rows render in an editable confirm table. Default-checked = credits where `TYPE: PAYROLL` is present OR `source` ∈ known income sources. Default-unchecked = all other credits (cashback, asset sales, Venmo, refunds) AND all debits. Nothing commits without confirmation.
- **D-06:** Remember known income sources. Once Ian confirms a source string (e.g. "GLI EAST LANSING"→payroll/taxable, "VENMO"→gift/non-taxable), persist it so future pastes auto-check + auto-categorize matching rows.
- **D-07:** Balance captured to `note`, account wiring deferred. The trailing balance number is preserved in `note` but NOT wired to an `Account` balance in Phase 2.

**Income Categorization & Two-Floor Split (INC-02, INC-03, INC-05, INC-06):**
- **D-08:** `IncomeCheck` gains `category: 'payroll' | 'gift' | 'other'` and `taxable: boolean`. Default taxability derives from category (payroll→taxable, gift→non-taxable, other→taxable) and is editable. Known-source memory (D-06) auto-tags both fields.
- **D-09:** The two floors consume DIFFERENT income subsets:
  - **Defended line / backfill alert** → **payroll income only.** Gift money must NOT suppress the backfill signal.
  - **Passive floor / solvency / surplus** → **total income** (payroll + gift + other).
- **D-10:** YTD taxable-income figure available in the model (sum of `taxable` income year-to-date). Data foundation for deferred `TAX-01`; no tax computation in Phase 2.

**Projection & 3rd-Check Surplus (INC-04, EDGE-05):**
- **D-11:** `projectedMonth = sum(payroll checks landed this calendar month) + max(0, 2 − landedPayrollCount) × estimatePerCheck`, where `estimatePerCheck` = **the most recent actual payroll check amount**. Expected payroll count fixed at **2/month**.
- **D-12:** 3rd payroll check rule = automatic + per-check override. The 3rd+ payroll check whose `date` falls in a calendar month is auto-flagged surplus: excluded from the 2-check baseline and from `projectedMonth`, added to surplus. Per-check manual override exists. Classification keyed strictly on the check's `date` (local calendar month). Gift/other income is NEVER part of the 2-check baseline.

**Dashboard (INC-05):**
- **D-13:** Horizontal income bar. One phone-width bar: solid fill = MTD actual (total income), lighter "ghost" segment to `projectedMonth`, shaded solvency band up to the passive floor, marker tick at the $3,000 defended line. Defended-line comparison reflects payroll-only projection (D-09).
- **D-14:** Three `font-mono` number cards below the bar: month-to-date, projected month, surplus — surplus card is **replaced by the backfill alert** when payroll-projection < defended line. Pre-mirrors Phase 5 SURP-07.

### Claude's Discretion
- Reactive dashboard wiring: Phase 2 lifts the Phase-1 `atomWithObservable` ban → use `atomWithObservable + liveQuery` for the live dashboard. **Validate the React 19 path during planning/execution** (see Pitfall 1 — this research provides the validated pattern).
- Routes: add `/dashboard` and `/entry` to the existing HashRouter (pre-scaffolded in Phase 1).
- Exact confirm-table UX (inline edit vs. row toggles), date-parser tolerance, source-matching strategy (exact vs. normalized) — decide within D-01..D-06.

### Deferred Ideas (OUT OF SCOPE)
- Expense model, sinking funds, survival floor — **Phase 3**
- Credit-card / itemized statement *adapter* — **Phase 3** (the generic parser **seam** is built now; CC adapter validated against a real CC sample in Phase 3)
- Checking→card-payoff reconciliation / double-counting — **Phase 3**
- Food floor — **Phase 4**
- Surplus *routing* (EF-first sweep, gift-surplus investing), independence indicator — **Phase 5**
- Estimated-tax feature `TAX-01` — **v2 backlog** (Phase 2 lays only the data foundation: `taxable` flag + YTD taxable sum)
- Account-balance tracking / `Account` entity wiring — **later** (Phase 2 parses balance into `note` only)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INC-01 | Record a biweekly net income check `{date, netAmount, source, note}` | `IncomeCheck` type + `storage.addIncomeCheck`; CheckEntryForm manual tab |
| INC-02 | Configure two distinct floors: passive + defended (default $3,000) | Already in `Floors` type (passive/defended). SettingsPage edits both — verify/extend, don't rebuild |
| INC-03 | Solvency math against passive floor, never average or defended line | `surplusAtom` and solvency derive from passive floor; D-09 split codifies this |
| INC-04 | 2-check/month baseline; 3rd check = surplus | `landedPayrollCountAtom` + D-12 surplus classification keyed on `date` calendar month |
| INC-05 | Dashboard: MTD income vs BOTH lines (solvency band + backfill marker) | `IncomeBar` component (`role="meter"`) per D-13; derived atoms feed it |
| INC-06 | Backfill alert when projected income < defended line | `backfillActiveAtom` (payroll-projection < defended); BackfillAlertCard `role="alert"` |
| INC-07 | Manual typed entry as always-available fallback | CheckEntryForm "Manual entry" tab (default) |
| INC-08 | Paste-parse block → categorized entries → confirm/edit → commit | Parser (D-01..D-06) + PasteParseFlow + ConfirmTable |
| UI-03 | Entry surface supports typed + paste-parse with confirm step | EntryTabBar two-tab control; `/entry` route |
| EDGE-01 | Income below passive or defended surfaces warning/alert; never silently absorbed | Backfill alert + solvency band; conservative confirm step (D-05) |
| EDGE-05 | 3rd check in a month classified as surplus (= INC-04) | D-12 auto-flag + per-check override |
</phase_requirements>

## Summary

Phase 2 has three distinct technical surfaces, each with a clear validated approach. **(1) The reactive data layer** is the single highest-risk unknown and it is now de-risked: the Phase-1 ban on `atomWithObservable + liveQuery` was caused by a React 19 Suspense re-entry bug (pmndrs/jotai #2848) that is still open as of May 2026, but has a known, low-cost workaround. The cleanest fix for this app is to give every `atomWithObservable` an `initialValue` so the atom never suspends; the secondary belt-and-suspenders fix is `useAtomValue(atom, { delay: 0 })` at consumption sites. **(2) The paste-parser** is a pure-function, fully-specified state machine — block accumulation keyed on a date regex, trailing-number field extraction, deterministic credit/debit by amount sign with a balance-delta fallback — needing no library and no external service (constraint C2). **(3) The two-floor income model + derived computation** is a chain of read-only Jotai derived atoms over one reactive source atom; nothing computed is ever persisted (FOUND-06).

The architecture is already locked by `SKELETON.md` and `02-CONTEXT.md` (D-01..D-14). This research's job is therefore prescriptive: confirm the exact reactive pattern, confirm the parser is a hand-rolled pure function (no library), and lay out the derived-atom chain and the schema-migration v1→v2 mechanics that the planner must produce as tasks. CLAUDE.md inviolable constraints (C2 no bank API, C3 no money movement) are satisfied structurally — the parser consumes pasted text only, and the storage surface gains read/write of `IncomeCheck` but no credential or transfer methods.

**Primary recommendation:** Use `atomWithObservable(() => liveQuery(querier), { initialValue: [] })` for the source `incomeChecksAtom` (no suspense, no React 19 bug). Build the parser as a pure `parseStatement(text, adapter): CandidateRow[]` function under `src/domains/income/parser/` with the checking adapter as the only adapter in Phase 2. Express every dashboard number (MTD, projected, surplus, backfill-active) as a read-only derived atom — never store a computed value.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist `IncomeCheck` (CRUD) | Storage abstraction (`storage.ts`) | Dexie (`db.ts`) | Domain code imports only `storage.ts`; Dexie confined to storage/. Adds `addIncomeCheck`/`listIncomeChecks`/`updateIncomeCheck`/`deleteIncomeCheck` — and nothing money-moving (C3 structural) |
| Reactive read of income table | Jotai source atom (`incomeChecksAtom`) | Dexie `liveQuery` | `atomWithObservable + liveQuery` is the reactive cache above the storage layer; auto-emits on every write incl. cross-tab |
| Parse pasted statement text | Pure function (`parser/`) | — | No I/O, no service, no Dexie — pure `string → CandidateRow[]`. Fully unit-testable; satisfies C2 (no bank API) by construction |
| MTD / projected / surplus / backfill computation | Jotai derived atoms | — | FOUND-06: derived, read-only, never persisted. Recompute on source change |
| Known-source memory | `settings` singleton (`knownSources` key) | Storage abstraction | Reuses the Phase-1 settings-by-key pattern; reactive via its own `liveQuery` atom |
| Floor parameters (passive/defended/estimatePerCheck) | `settings` singleton (`floors` + new key) | SettingsPage UI | Editable parameters (FOUND-05); passive/defended already exist — extend, don't rebuild |
| Dashboard rendering | React components (`IncomeBar`, `MetricCard`, `BackfillAlertCard`) | Tailwind tokens | Pure presentation over derived-atom values; tokens-only per CLAUDE.md |

## Standard Stack

No new runtime dependencies. Phase 2 is built entirely on the Phase-1 pinned stack.

### Core (already installed — verified against package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jotai | ^2.20.0 | Source atom + derived-atom chain | `atomWithObservable` (from `jotai/utils`) is the idiomatic bridge for an RxJS-style observable like Dexie's `liveQuery` |
| dexie | ^4.4.2 | `liveQuery` observable over `incomeChecks` table | `liveQuery` handles IDB observer lifecycle + cross-tab sync; the `incomeChecks` table is already declared in db.ts |
| react / react-dom | ^19.2.0 | Rendering | The re-suspense bug (Pitfall 1) is a React-19-specific interaction — workaround required |
| react-router-dom | ^7.0.0 (HashRouter) | `/dashboard`, `/entry` routes | Routes added to existing AppShell nav |
| tailwindcss | ^3.4.17 (PIN v3) | All UI tokens | **Do NOT upgrade to v4** — config-file token model breaks (Phase-1 Pitfall 2) |
| lucide-react | ^0.577.0 | Icons | Already present; UI-SPEC says no icon required for the alert |

### Supporting (testing — already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.6 | Unit + integration runner | Parser pure-function tests, derived-atom tests, classification tests |
| @testing-library/react | ^16.0.0 | Component + atom render tests | Confirm-table interaction, dashboard render |
| fake-indexeddb | ^6.0.0 | IDB in test env | Storage CRUD + `liveQuery` atom tests |
| @testing-library/user-event | ^14.0.0 | User interaction simulation | Confirm-table checkbox toggles, form entry |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled parser | A CSV/statement-parsing library (e.g. papaparse) | The format is block-based multi-line ACH (NOT CSV); a CSV lib does not fit. Format is fully specified (D-02..D-04). A pure function is more testable and adds zero dependency. **Use the hand-rolled pure function.** |
| `atomWithObservable` | Dexie's own `useLiveQuery` React hook | `useLiveQuery` would bypass Jotai's derived-atom chain (the project's chosen recompute mechanism, FOUND-06). Mixing two reactive systems fragments state. **Stay in Jotai.** |
| `atomWithObservable` | Plain async atom + manual refresh counter (Phase-1 pattern) | Works but is NOT reactive to cross-tab writes and requires every writer to bump the counter. The dashboard wants live updates on commit. **Use `atomWithObservable` now that the ban is lifted.** |

**Installation:** None required. `atomWithObservable` is imported from `jotai/utils`; `liveQuery` from `dexie`.

**Version verification:** All versions confirmed against `package.json` (read this session). jotai 2.20.0 and dexie 4.4.2 confirmed current-enough by Phase-1 `[VERIFIED: npmjs.com]`. No new packages — no registry verification needed (satisfies the "verify before install" learned rule by adding nothing).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
  Manual entry ────►│  CheckEntryForm (manual tab)                 │
  (typed)           │  validate → storage.addIncomeCheck(check)    │──┐
                    └─────────────────────────────────────────────┘  │
                                                                      │
  Pasted text ─────►┌─────────────────────────────────────────────┐  │
  (block)           │  PasteParseFlow                              │  │
                    │   step 1: textarea                           │  │
                    │   ▼ parseStatement(text, checkingAdapter)    │  │  writes
                    │   CandidateRow[]  (pure fn, no I/O)           │  │
                    │   ▼ apply knownSources auto-check/categorize │  │
                    │   step 2: ConfirmTable (edit + tick)         │  │
                    │   ▼ commit checked rows                      │  │
                    │   storage.addIncomeChecks(rows) +            │──┤
                    │   remember new confirmed sources             │  │
                    └─────────────────────────────────────────────┘  │
                                                                      ▼
                              ┌──────────────────────────────────────────────┐
                              │ storage.ts  (abstraction — only persistence)  │
                              │   addIncomeCheck / listIncomeChecks(range) /  │
                              │   updateIncomeCheck / deleteIncomeCheck /     │
                              │   getKnownSources / saveKnownSources          │
                              │   (NO credential/transfer methods — C2/C3)    │
                              └───────────────┬──────────────────────────────┘
                                              ▼
                              ┌──────────────────────────────────────────────┐
                              │ db.ts  Dexie  incomeChecks table              │
                              │   .version(2) upgrade adds category/taxable   │
                              └───────────────┬──────────────────────────────┘
                                              ▼  liveQuery emits on every write
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ income.atoms.ts                                                            │
   │                                                                            │
   │  incomeChecksAtom = atomWithObservable(()=>liveQuery(...), {initialValue:[]})│
   │        │                                                                   │
   │        ├─► currentMonthChecksAtom  (filter date ∈ this calendar month)     │
   │        │        ├─► mtdTotalAtom        (Σ all categories)                 │
   │        │        ├─► mtdPayrollAtom      (Σ payroll only)                   │
   │        │        ├─► landedPayrollCountAtom (count non-surplus payroll)     │
   │        │        └─► surplusChecksAtom   (3rd+ payroll, D-12)               │
   │        │                                                                   │
   │  estimatePerCheckAtom (settings → fallback most-recent payroll)            │
   │        ▼                                                                   │
   │  projectedMonthAtom = mtdPayroll + max(0, 2 - landedCount)×estimate (D-11) │
   │  projectedTotalAtom  = projectedMonthPayroll + non-payroll landed          │
   │  surplusAtom         = projectedTotal - passiveFloor (when above defended) │
   │  backfillActiveAtom  = projectedMonthPayroll < defendedLine                │
   └────────────────────────────────────┬───────────────────────────────────────┘
                                         ▼  read-only consumption ({delay:0} or initialValue)
            ┌──────────────────────────────────────────────────────────┐
            │ /dashboard:  IncomeBar(role=meter) + 3× MetricCard         │
            │              backfill swaps surplus card (role=alert)      │
            └──────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── storage/
│   ├── schema.ts                 # ADD IncomeCheck type, KnownSource type; bump CURRENT_SCHEMA_VERSION → 2
│   ├── db.ts                     # ADD .version(2).stores(...).upgrade(...) — same fields as migrate_1_to_2
│   ├── migrations.ts             # ADD migrate_1_to_2 + register MIGRATIONS[1]
│   └── storage.ts                # ADD income CRUD + known-source get/save (NO money/credential methods)
├── domains/
│   └── income/
│       ├── income.atoms.ts       # source atom + full derived chain (see diagram)
│       ├── income.types.ts       # IncomeCheck, CandidateRow, Category re-exports
│       ├── parser/
│       │   ├── parseStatement.ts # pure: (text, adapter) → CandidateRow[]
│       │   ├── checkingAdapter.ts# block/field rules for Ian's checking format (D-02..D-04)
│       │   └── adapter.types.ts  # StatementAdapter interface (the Phase-3 seam, D-01)
│       ├── classify.ts           # pure: surplus classification (D-12), default taxable (D-08)
│       ├── CheckEntryForm.tsx
│       ├── PasteParseFlow.tsx
│       ├── ConfirmTable.tsx
│       ├── BackfillAlertCard.tsx
│       └── SourceAutocomplete.tsx
├── components/
│   ├── IncomeBar.tsx             # role="meter"
│   ├── MetricCard.tsx            # variant?: 'default' | 'alert'
│   └── EntryTabBar.tsx           # ARIA tabs
└── pages/
    ├── DashboardPage.tsx         # /dashboard
    └── EntryPage.tsx             # /entry
```

### Pattern 1: Reactive Dexie → Jotai source atom (the de-risked React 19 path)

**What:** A single source atom that emits the current `incomeChecks` rows and re-emits on every write (including cross-tab), wired through Dexie `liveQuery`.

**When to use:** The one source atom that the entire derived chain reads from.

```typescript
// Source: jotai.org/docs/utilities/async + github.com/pmndrs/jotai/discussions/2848
// + dexie.org/docs/liveQuery()
import { atomWithObservable } from 'jotai/utils'
import { liveQuery } from 'dexie'
import { db } from '../../storage/db'   // EXCEPTION: atom file may reference db ONLY to
                                        // build the liveQuery observable; all mutation goes
                                        // through storage.ts. (Confirm seam choice in planning —
                                        // alternative is a storage.observeIncomeChecks() helper
                                        // that returns the Observable, keeping atoms db-free.)
import type { IncomeCheck } from './income.types'

// initialValue:[] means the atom NEVER suspends — this sidesteps the React 19
// re-suspense bug entirely (Pitfall 1). The empty array renders as the dashboard
// empty state until the first liveQuery emission lands (sub-millisecond locally).
export const incomeChecksAtom = atomWithObservable<IncomeCheck[]>(
  () => liveQuery(() => db.incomeChecks.toArray() as Promise<IncomeCheck[]>),
  { initialValue: [] },
)
```

**Decision for the planner — keep atoms db-free (preferred):** To honor the project boundary that "domain code never imports Dexie directly," add a thin `observeIncomeChecks(): Observable<IncomeCheck[]>` to `storage.ts` that returns `liveQuery(() => db.incomeChecks.toArray())`. The atom then imports `storage`, not `db`. This preserves the structural rule and keeps the C2/C3 enforcement surface intact. **Recommend this seam.** [VERIFIED: codebase — settings.atoms.ts imports only storage, never db]

### Pattern 2: Derived atoms (read-only, never persisted — FOUND-06)

**What:** Every dashboard number is a pure function of the source atom + settings. Nothing computed is written back.

```typescript
// Source: jotai.org/docs/guides/composing-atoms
import { atom } from 'jotai'
import { incomeChecksAtom } from './incomeChecksAtom'

const inThisMonth = (isoDate: string, now = new Date()) => {
  // D-12: classify on the check's LOCAL calendar month (a June-1 check is June)
  const d = new Date(isoDate + 'T00:00:00')        // parse as local midnight
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export const currentMonthChecksAtom = atom((get) =>
  get(incomeChecksAtom).filter((c) => inThisMonth(c.date)),
)

export const mtdTotalAtom = atom((get) =>
  get(currentMonthChecksAtom).reduce((s, c) => s + c.netAmount, 0),
)

// Payroll-only, surplus-excluded, sorted by date so the "3rd+" rule is deterministic
export const baselinePayrollAtom = atom((get) =>
  get(currentMonthChecksAtom)
    .filter((c) => c.category === 'payroll' && !c.surplusOverride /* see classify.ts */)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

export const landedPayrollCountAtom = atom((get) =>
  Math.min(get(baselinePayrollAtom).length, 2),   // baseline caps at 2 (D-12)
)
```

**Anti-pattern avoided:** Do NOT persist `projectedMonth`, `surplus`, or `backfillActive`. They are derived (FOUND-06). Persisting them creates the stale-copy bug Phase 1 explicitly forbids.

### Pattern 3: Pure block-based statement parser (D-02..D-04, no library)

**What:** A pure function that turns pasted text into candidate rows. State machine: scan lines, start a new block on a date-line, accumulate until the next date-line/EOF.

```typescript
// Source: D-02..D-04 (CONTEXT.md). Pure function — no I/O, satisfies C2 by construction.
const DATE_LINE = /^\d{2}\/\d{2}\/\d{4}/
const HEADER = /^date\s+description\s+amount\s+balance/i
// Trailing two comma-formatted signed decimals = (netAmount, balanceAfter)
const TRAILING_NUMS = /(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/

export interface StatementAdapter {            // D-01 seam — Phase 3 adds creditCardAdapter
  readonly statementType: 'checking' | 'creditcard'
  extractFields(block: string[]): Partial<CandidateRow>
  isCredit(row: Partial<CandidateRow>, prevBalance: number | null): boolean
}

export function parseStatement(text: string, adapter: StatementAdapter): CandidateRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const blocks: string[][] = []
  let cur: string[] | null = null
  for (const line of lines) {
    if (!line.trim() || HEADER.test(line)) continue          // skip blanks + header (D-02)
    if (DATE_LINE.test(line)) { cur = [line]; blocks.push(cur) }
    else if (cur) cur.push(line)                             // metadata belongs to block
  }
  let prevBalance: number | null = null
  return blocks.map((block) => {
    const fields = adapter.extractFields(block)              // D-03
    const credit = adapter.isCredit(fields, prevBalance)     // D-04 (sign, balance-delta fallback)
    if (fields.balanceAfter != null) prevBalance = fields.balanceAfter
    return { ...fields, isCredit: credit, raw: block.join('\n') } as CandidateRow
  })
}
```

**Real-format reference (the gold test fixture — from `02-DISCUSSION-LOG.md`):** tab-delimited, header row present, signed comma amounts, trailing `(amount, balance)` pair, multi-line ACH blocks with `TYPE:/ID:/CO:` metadata. PAYROLL rows = `GLI EAST LANSING`. Non-income credits the parser must default-uncheck: `VANGUARD SELL` $3,000 (asset sale), `Cashback Redeemed from L30` $223.97, `VENMO CASHOUT` $600 + $350 (parental gift → category `gift`, non-taxable, counts toward total but NOT defended line).

### Pattern 4: Schema migration v1 → v2 (the single-source-of-truth contract)

**What:** Bumping the schema requires THREE paired edits (per migrations.ts contract block, D-09 of Phase 1).

```typescript
// 1. schema.ts: add type + bump version
export const CURRENT_SCHEMA_VERSION = 2 as const
export type IncomeCheck = Readonly<{
  id?: number
  date: string                 // ISO yyyy-mm-dd, classified by local calendar month
  netAmount: number            // signed; income rows positive
  source: string
  note: string                 // raw block text incl. balance (D-07)
  category: 'payroll' | 'gift' | 'other'   // D-08
  taxable: boolean                          // D-08
  surplusOverride?: boolean                 // D-12 per-check manual override
}>

// 2. migrations.ts: pure fn (no Dexie) + register
export function migrate_1_to_2(data: SchemaV1Data): SchemaV2Data {
  // v1 had zero incomeChecks; nothing to backfill. Known-source list starts empty.
  return { ...data, settings: { ...data.settings, knownSources: data.settings.knownSources ?? [] } }
}
export const MIGRATIONS: Record<number, MigrationFn> = { 1: migrate_1_to_2 }

// 3. db.ts: matching Dexie upgrade (incomeChecks indexes unchanged; field-only change
//    needs no new index, but version MUST advance so Dexie + import stay aligned)
this.version(2).stores({ /* same stores; '++id, date, source' already covers queries */ })
  .upgrade(async () => { /* field-only addition: no row rewrite needed */ })
```

**Pitfall the planner must avoid:** importing an old v1 backup must still work. The current `importAll` refuses any version with no migration path; registering `MIGRATIONS[1]` is what makes v1 backups importable into v2. [VERIFIED: codebase — storage.ts lines 122-129 walk the ladder].

### Anti-Patterns to Avoid
- **Mixing Dexie's `useLiveQuery` hook with Jotai atoms:** fragments reactive state. Stay in the Jotai derived chain.
- **Counting all deposits as income:** D-05 exists precisely because the real statement had a $3,000 asset sale + cashback. Auto-check ONLY payroll/known-source credits.
- **Letting gift income suppress the backfill alert:** D-09 — the defended-line projection is payroll-ONLY. A `backfillActiveAtom` that uses total income is a correctness bug.
- **Persisting derived values:** violates FOUND-06.
- **Parsing the check date as UTC (`new Date('2026-06-01')`):** UTC parse can shift the month by a day in negative-offset timezones, misclassifying a month-boundary check. Parse as local midnight (`+ 'T00:00:00'`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive IndexedDB subscription | Manual IDB `onupgradeneeded`/change listeners | Dexie `liveQuery` | Handles observer lifecycle, transaction boundaries, cross-tab sync |
| Observable→React glue | Custom `useEffect`+`useState` subscription | `atomWithObservable` (jotai/utils) | Built for exactly this; the only caveat is the React-19 workaround (Pitfall 1) |
| Schema migration | switch/case on version in import code | The existing pure migration ladder (`migrations.ts`) | Already built in Phase 1; reuse for both Dexie upgrade AND JSON import (D-09) |
| Recompute-on-change | Manual recompute + cached field | Jotai derived atoms | The project's chosen recompute mechanism (FOUND-06); explicit and traceable |
| Currency display | Custom number formatting | `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})` + `font-mono` | Locale-correct, no rounding surprises; render in `font-mono` per CLAUDE.md |

| **DO hand-roll** | The statement parser | A pure block-state-machine function | The format is bespoke multi-line ACH (not CSV/QFX); no library fits, and a pure fn is the most testable, zero-dependency choice. CONTEXT.md D-01..D-04 fully specify it. |

**Key insight:** Everything reactive and persistent is already a solved problem in this stack (Dexie + Jotai). The ONLY genuinely custom logic this phase introduces is the parser and the classification rules — and both are pure functions, which is exactly what should be hand-rolled (deterministic, unit-testable, no edge-case-hiding library).

## Runtime State Inventory

This phase is additive (greenfield income feature), not a rename/refactor — but it does evolve persisted schema, so the relevant state question is migration, covered above. For completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `incomeChecks` Dexie table exists (declared Phase 1) but is empty; `settings` table holds `floors` only | Populate `incomeChecks`; add `knownSources` + `estimatePerCheck` settings keys via migrate_1_to_2 |
| Live service config | None — local-only app, no external services (C2) | None |
| OS-registered state | None | None — verified: no scheduled tasks, no daemons |
| Secrets/env vars | None — `VITE_APP_VERSION` only (non-secret build stamp) | None |
| Build artifacts | None stale from this change | None |

**Schema-version coordination is the real "runtime state" risk:** an existing user (Ian) already has a v1 IndexedDB on his phone and laptop. The v1→v2 Dexie upgrade must run cleanly in-place (field-only, no index change → low risk), AND any v1 JSON backup must still import. Both paths use the same `migrate_1_to_2`. Verify both in tests.

## Common Pitfalls

### Pitfall 1: React 19 + `atomWithObservable` re-suspense (THE de-risk target)
**What goes wrong:** A component reading an `atomWithObservable(() => liveQuery(...))` atom flashes between Suspense fallback and data on every Dexie write — the dashboard flickers each time a check is committed.
**Why it happens:** React 19 changed Suspense resolution; jotai's `createContinuablePromise` wraps each already-fulfilled emission in a new pending promise passed to `React.use`, causing a micro-suspension. **Still open as of May 2026** (pmndrs/jotai #2848; latest fix attempt #3026 needs `delay:0` + `unstable_promiseStatus:true`).
**How to avoid (validated, primary):** Provide `initialValue` to `atomWithObservable` so the atom never suspends at all. For an array source, `{ initialValue: [] }`. This is the cleanest fix and matches the dashboard's empty-state need.
**How to avoid (secondary/belt-and-suspenders):** At any consumption site that still suspends, use `useAtomValue(atom, { delay: 0 })`. `{ delay: 0 }` queues a macrotask, breaking the re-suspense cycle.
**Warning signs:** Repeated Suspense fallbacks in React DevTools on each commit; dashboard numbers blink.
[VERIFIED: WebSearch — github.com/pmndrs/jotai/discussions/2848, confirmed open May 2026] [CITED: jotai.org/docs/utilities/async — initialValue prevents suspension]

### Pitfall 2: Month-boundary check misclassified (timezone)
**What goes wrong:** A check dated `2026-06-01` entered on May 31 gets counted in May (or vice-versa), corrupting the 2-check baseline and surplus classification.
**Why it happens:** `new Date('2026-06-01')` parses as UTC midnight; in US timezones that is May 31 local.
**How to avoid:** Always parse the stored ISO date as LOCAL midnight: `new Date(iso + 'T00:00:00')`. D-12 explicitly says classification is on the local calendar month.
**Warning signs:** Off-by-one-day surplus flags near month boundaries.

### Pitfall 3: Non-income deposits counted as income
**What goes wrong:** Asset sale ($3,000 VANGUARD SELL) or cashback gets auto-committed, shattering floor math and (for the asset sale) violating the spirit of SURP-06.
**Why it happens:** Naive "all credits are income" logic.
**How to avoid:** D-05 conservative auto-check — default-check ONLY `TYPE: PAYROLL` or known-source credits; everything else (incl. all debits) defaults unchecked but visible. Nothing commits without Ian's tick.
**Warning signs:** Real-statement test fixture commits more than 2 income rows for May 2026.

### Pitfall 4: Gift income suppressing the backfill alert
**What goes wrong:** Parental Venmo gift ($600+$350) pushes total income over $3,000, hiding the backfill alert even though payroll alone is below the defended line.
**Why it happens:** Using total income for the defended-line comparison.
**How to avoid:** D-09 — `backfillActiveAtom` compares **payroll-only projection** against the defended line. Gift/other counts toward the passive-floor/solvency/total, never the defended line.
**Warning signs:** Backfill alert fails to fire for the May 2026 fixture (payroll $2,424.10 < $3,000).

### Pitfall 5: `liveQuery` atom imported `db` directly, breaking the storage boundary
**What goes wrong:** Domain code reaches into `db.ts`, eroding the structural C2/C3 enforcement that lives at the storage-abstraction seam.
**How to avoid:** Add `storage.observeIncomeChecks(): Observable<IncomeCheck[]>` so the atom imports `storage`, not `db` (Pattern 1 note).
**Warning signs:** `import { db }` appears in `src/domains/`.

## Code Examples

### The May 2026 gold test case (use in unit + integration tests)
```typescript
// Source: 02-CONTEXT.md "Specific Ideas" — real data, must pass.
// Two PAYROLL checks, no gift this month:
//   05/01  GLI EAST LANSING  $1,127.51
//   05/15  GLI EAST LANSING  $1,296.59
// mtdTotal = mtdPayroll = 2424.10
// landedPayrollCount = 2  → projectedMonth = 2424.10 (no estimate added)
// passiveFloor 2400 → above passive (solvency ok)
// defendedLine 3000 → 2424.10 < 3000 → backfillActive === true   (EDGE-01)
// neither check is a 3rd → surplus = 0                            (INC-04)
```

### Backfill + surplus derived atoms (D-09, D-11, D-14)
```typescript
// Source: D-09/D-11/D-14 (CONTEXT.md)
export const estimatePerCheckAtom = atom(async (get) => {
  const setting = await get(estimatePerCheckSettingAtom)   // from settings
  if (setting && setting > 0) return setting
  // fallback: most recent payroll check amount (D-11)
  const payroll = get(incomeChecksAtom)
    .filter((c) => c.category === 'payroll')
    .sort((a, b) => b.date.localeCompare(a.date))
  return payroll[0]?.netAmount ?? 0
})

export const projectedMonthPayrollAtom = atom((get) => {
  const landed = get(landedPayrollCountAtom)
  const mtdPayroll = get(mtdPayrollAtom)
  const estimate = get(unwrapEstimateAtom)                 // unwrap async
  return mtdPayroll + Math.max(0, 2 - landed) * estimate   // D-11
})

export const backfillActiveAtom = atom((get) =>
  get(projectedMonthPayrollAtom) < get(defendedLineAtom),  // D-09: payroll-only vs defended
)
```

### Currency formatting (CLAUDE.md font-mono rule)
```typescript
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
// render value inside <span className="font-mono"> per CLAUDE.md inviolable
```

## State of the Art

| Old Approach (Phase 1) | Current Approach (Phase 2) | When Changed | Impact |
|------------------------|----------------------------|--------------|--------|
| Plain async atom + manual refresh counter | `atomWithObservable + liveQuery` with `initialValue` | Phase 2 (ban lifted) | Live, cross-tab-reactive dashboard; no manual refresh bumps |
| `CURRENT_SCHEMA_VERSION = 1`, empty MIGRATIONS | Version 2 + `migrate_1_to_2` registered | Phase 2 | v1 backups remain importable; in-place Dexie upgrade |
| Settings = `floors` only | + `knownSources`, + `estimatePerCheck` | Phase 2 | Source memory + projection basis |

**Deprecated/outdated:**
- The Phase-1 `atomWithObservable` ban is lifted for Phase 2 — but the underlying React 19 bug is NOT fixed upstream; it is *worked around* via `initialValue`/`delay:0`. Do not assume the bug is gone.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `initialValue: []` on `atomWithObservable` fully avoids the React 19 re-suspense bug (vs. only `delay:0` fixing it) | Pattern 1 / Pitfall 1 | LOW — if it still suspends at a consumer, add `{delay:0}` there too; both are documented workarounds, neither breaks anything |
| A2 | A field-only schema change (adding `category`/`taxable` to `incomeChecks`) needs a `.version(2)` bump but NO row rewrite/new index | Pattern 4 | LOW — `++id, date, source` already covers all queries; if a query needs `category`/`taxable` indexed later, add the index in the same `.version(2).stores()` |
| A3 | The real checking statement is tab-delimited with the exact `TYPE:/CO:` metadata shape described in the discussion log | Pattern 3 | MEDIUM — the parser/adapter is tuned to this format; **planner should make "validate parser against the captured real sample" an explicit acceptance test**, since the full raw sample lives in 02-DISCUSSION-LOG.md and was only partially surfaced this session |
| A4 | Ian already has a v1 IndexedDB on device, so the v1→v2 in-place upgrade path WILL execute (not just fresh installs) | Runtime State Inventory | LOW-MEDIUM — Phase 1 is live and phone-verified, so this is near-certain; test the upgrade path regardless |

## Open Questions

1. **Atom→storage seam for the `liveQuery` observable**
   - What we know: project rule says domain code never imports `db.ts`; `liveQuery` needs the Dexie table.
   - What's unclear: whether to relax the rule for the one source atom, or add `storage.observeIncomeChecks()`.
   - Recommendation: Add `storage.observeIncomeChecks(): Observable<IncomeCheck[]>`. Preserves the structural boundary; trivial to write. **Recommend the planner make this a task.**

2. **Where `estimatePerCheck` lives and how it auto-updates**
   - What we know: UI-SPEC puts an "Estimate per check" field in Settings, defaulting to the most recent payroll check, overridable (D-11).
   - What's unclear: whether the stored setting auto-overwrites on each new payroll check, or stays manual once set.
   - Recommendation: Treat the stored setting as an OVERRIDE; when unset/zero, derive from the most recent payroll check (the `estimatePerCheckAtom` fallback). This avoids a write-on-every-commit side effect and keeps the value derived-by-default (FOUND-06 spirit).

3. **Per-check surplus override storage**
   - What we know: D-12 specifies a per-check manual override of the auto-surplus flag.
   - What's unclear: store as `surplusOverride?: boolean` on the check vs. compute purely from date-order.
   - Recommendation: Store an optional `surplusOverride` on the `IncomeCheck` (auto rule computes the default; the field only records a deliberate deviation). Pure date-order computation handles the common case; the field handles off-pattern months.

## Environment Availability

Phase 2 adds no external dependencies — pure code/config + already-installed libraries. Build/test toolchain confirmed present via `package.json`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| jotai (atomWithObservable) | Reactive atoms | ✓ | ^2.20.0 | — |
| dexie (liveQuery) | Reactive source | ✓ | ^4.4.2 | — |
| vitest + fake-indexeddb | Tests | ✓ | ^4.1.6 / ^6.0.0 | — |

**Missing dependencies:** None. **Skip-eligible** but documented because the phase touches persistence.

> **Dated follow-up carried from STATE.md (not Phase-2 scope but ACT BEFORE 2026-06-02):** bump GitHub Actions tags in `deploy.yml` to latest majors (Node 24 runner migration). Flag to Ian; do not let a Phase-2 push silently fail on a deprecated runner.

## Validation Architecture

`workflow.nyquist_validation` — config not located this session; treated as ENABLED (default). This phase is heavily testable (pure parser, pure classification, derived math), so validation is warranted.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 + @testing-library/react 16 + fake-indexeddb 6 |
| Config file | `vite.config.ts` (test block: jsdom, globals, `src/test/setup.ts`) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INC-08 | Block parser splits real statement into correct candidate rows | unit | `npm run test -- --run parser` | ❌ Wave 0 |
| INC-08/D-04 | Credit/debit from amount sign + balance-delta fallback | unit | `npm run test -- --run parser` | ❌ Wave 0 |
| INC-08/D-05 | Conservative auto-check: only PAYROLL/known-source default-checked | unit | `npm run test -- --run classify` | ❌ Wave 0 |
| INC-01/INC-07 | Manual entry persists `IncomeCheck` via storage | integration | `npm run test -- --run storage` | ❌ Wave 0 |
| INC-04/EDGE-05 | 3rd payroll check in a month → surplus, excluded from baseline | unit | `npm run test -- --run classify` | ❌ Wave 0 |
| INC-04/D-12 | Month classification uses LOCAL calendar month (boundary date) | unit | `npm run test -- --run classify` | ❌ Wave 0 |
| INC-04/D-11 | `projectedMonth = mtdPayroll + max(0,2-landed)×estimate` | unit | `npm run test -- --run atoms` | ❌ Wave 0 |
| INC-06/EDGE-01/D-09 | Backfill fires on payroll-only projection < defended; gift does NOT suppress | unit | `npm run test -- --run atoms` | ❌ Wave 0 |
| INC-03 | Solvency/surplus computed against passive floor, not average/defended | unit | `npm run test -- --run atoms` | ❌ Wave 0 |
| INC-05 | IncomeBar renders meter with correct aria-valuenow/max | component | `npm run test -- --run IncomeBar` | ❌ Wave 0 |
| UI-03 | Paste→confirm→commit flow commits only checked rows | integration | `npm run test -- --run PasteParseFlow` | ❌ Wave 0 |
| INC-02 | v1→v2 migration; v1 backup still imports | integration | `npm run test -- --run migrations` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`. The May-2026 gold fixture (Pattern: "gold test case") MUST pass end-to-end.

### Wave 0 Gaps
- [ ] `src/domains/income/parser/parseStatement.test.ts` — block split, field extraction, credit/debit (INC-08)
- [ ] `src/domains/income/parser/__fixtures__/checking-may-2026.txt` — the real statement sample (copy verbatim from 02-DISCUSSION-LOG.md)
- [ ] `src/domains/income/classify.test.ts` — surplus classification + month-boundary + default taxable (INC-04, EDGE-05)
- [ ] `src/domains/income/income.atoms.test.ts` — projection, backfill, gift-doesn't-suppress (INC-06, D-09, D-11)
- [ ] `src/test/storage.income.test.ts` — income CRUD + known-source persistence (INC-01)
- [ ] `src/test/migrations.test.ts` — v1→v2 path + v1 backup import (INC-02)
- [ ] `src/components/IncomeBar.test.tsx` — meter ARIA (INC-05)

## Security Domain

`security_enforcement` config not located this session; treated as ENABLED. This is a single-user, local-only, credential-free app (C2). Threat surface is narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user local app; no auth, no accounts (Out of Scope per REQUIREMENTS) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user, no server |
| V5 Input Validation | **yes** | Pasted text is untrusted free text → parse defensively (no `eval`, no dynamic regex from input); validate manual form fields (date valid, amount > 0) before persist |
| V6 Cryptography | no | No credentials/secrets to protect (C2); no encryption-at-rest in threat model (SKELETON.md) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/huge paste input crashes parser or hangs UI | Denial of Service | Parser is pure + linear; cap input length, guard regex against catastrophic backtracking (the trailing-number regex is anchored, non-greedy-safe); empty-result path already specified (UI-SPEC "Empty parse result") |
| Pasted text rendered without escaping → XSS | (n/a — React escapes by default) | React auto-escapes JSX text; never `dangerouslySetInnerHTML` for parsed `note`/`source` |
| Structural constraint erosion (someone adds a money-moving method) | Tampering / spec violation | Keep storage surface free of credential/transfer methods; the Phase-1 "absence proof" test (storage.test.ts) should be extended to assert no new forbidden methods (C2/C3) |

**Inviolable constraint check:** C1 (food floor — not touched this phase, never violate), C2 (no bank API — parser consumes pasted text only, satisfied structurally), C3 (no money movement — storage gains income CRUD only; assert absence of transfer methods). All three are preserved.

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] — `src/storage/{storage,schema,db,migrations}.ts`, `src/domains/settings/settings.atoms.ts`, `package.json`, `vite.config.ts` (read this session — architectural source of truth)
- [VERIFIED: codebase] — `.planning/phases/01-foundation-storage-deploy/SKELETON.md`, `01-RESEARCH.md` Pitfall 1 (the documented React 19 ban + workaround)
- [CITED: jotai.org/docs/utilities/async] — `atomWithObservable`, `initialValue` prevents suspension
- [CITED: jotai.org/docs/guides/composing-atoms] — derived atom chains
- [CITED: dexie.org/docs/liveQuery()] — reactive Dexie observable

### Secondary (MEDIUM confidence)
- [VERIFIED: WebSearch — github.com/pmndrs/jotai/discussions/2848] — React 19 + atomWithObservable re-suspense; STILL OPEN May 2026; `delay:0` + fix attempt #3026 status
- [VERIFIED: WebSearch — dexie.org/docs/dexie-react-hooks + Dexie discussion #1276] — liveQuery + Jotai atomWithObservable integration pattern; `atomWithObservable(() => liveQuery(querier))`
- [VERIFIED: 02-DISCUSSION-LOG.md] — real statement format (block-based, tab-delimited, TYPE/CO metadata, the 6-deposits-only-2-income insight)

### Tertiary (LOW confidence)
- [ASSUMED] — exact tab-delimiter + metadata layout of the full real sample (A3); planner must make "validate against captured sample" an acceptance test

## Metadata

**Confidence breakdown:**
- Reactive pattern (React 19 + atomWithObservable): HIGH — Phase-1 finding confirmed still-current via WebSearch; `initialValue` workaround is documented and low-risk.
- Parser/classification: HIGH — fully specified by D-01..D-06, D-12; pure functions; real fixture available.
- Two-floor model + derived atoms: HIGH — D-08..D-14 lock the math; derived-atom mechanism proven in Phase 1.
- Schema migration: HIGH — contract + ladder already built in Phase 1; v2 is an additive field change.
- Real-statement format detail: MEDIUM — full raw sample lives in the discussion log; planner must validate the adapter against it.

**Research date:** 2026-05-28
**Valid until:** 2026-06-27 (30 days; stable pinned stack — the only moving target is the upstream jotai #2848 fix, which only ever makes the workaround unnecessary, never breaks it)
