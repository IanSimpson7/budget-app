// Income domain — reactive Jotai atom chain.
//
// Source atom: atomWithObservable over storage.observeIncomeChecks().
//   initialValue: [] sidesteps the React 19 re-suspense bug (Pitfall 1, RESEARCH.md).
//   The atom NEVER suspends; an empty array renders as the dashboard empty state.
//
// Derived atoms: pure, read-only, NEVER persisted (FOUND-06).
//   Every dashboard number (MTD, projected, surplus, backfill) recomputes from the
//   source atom on each liveQuery emission. Nothing computed is written back.
//
// Boundary: this file imports `storage` (the public abstraction), NEVER `db`.
//   Verified by: grep gate in plan 02-02 and storage.test.ts absence-proof.
import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import { floorsLoadAtom } from '../settings/settings.atoms'
import { isInLocalMonth, classifySurplus } from './classify'
import type { IncomeCheck } from './income.types'

// ── Source atom ────────────────────────────────────────────────────────────────
// atomWithObservable bridges Dexie's liveQuery Observable to Jotai.
// initialValue:[] prevents Suspense (Pitfall 1 workaround).
// The Observable is obtained via storage.observeIncomeChecks() — storage imports db,
// not us (Pitfall 5 / grep gate).
export const incomeChecksAtom = atomWithObservable<IncomeCheck[]>(
  () => storage.observeIncomeChecks(),
  { initialValue: [] },
)

// ── Current-month filter ───────────────────────────────────────────────────────
// Checks whose date falls in the current LOCAL calendar month (D-12 / Pitfall 2).
export const currentMonthChecksAtom = atom((get): IncomeCheck[] =>
  get(incomeChecksAtom).filter((c) => isInLocalMonth(c.date)),
)

// ── MTD totals ─────────────────────────────────────────────────────────────────
/** Sum of ALL income categories this month (payroll + gift + other). */
export const mtdTotalAtom = atom((get): number =>
  get(currentMonthChecksAtom).reduce((s, c) => s + c.netAmount, 0),
)

/** Payroll-only MTD sum (feeds the defended-line comparison, D-09). */
export const mtdPayrollAtom = atom((get): number =>
  get(currentMonthChecksAtom)
    .filter((c) => c.category === 'payroll')
    .reduce((s, c) => s + c.netAmount, 0),
)

// ── Baseline payroll (non-surplus, sorted ascending by date) ────────────────────
// Used for the landedPayrollCount and the 2-check model (D-11, D-12).
export const baselinePayrollAtom = atom((get): IncomeCheck[] => {
  const monthChecks = get(currentMonthChecksAtom)
  const surplusIds = classifySurplus(monthChecks)
  return monthChecks
    .filter((c) => c.category === 'payroll' && !surplusIds.has(c.id!))
    .sort((a, b) => a.date.localeCompare(b.date))
})

// ── Landed payroll count (capped at 2 — D-11) ──────────────────────────────────
export const landedPayrollCountAtom = atom((get): number =>
  Math.min(get(baselinePayrollAtom).length, 2),
)

// ── Estimate per check (D-11) ──────────────────────────────────────────────────
// Stored setting is an OVERRIDE; when unset/zero, falls back to the most recent
// payroll check amount (RESEARCH Q2 resolved decision).
const estimatePerCheckSettingAtom = atom(async (): Promise<number> =>
  storage.getEstimatePerCheck(),
)

export const estimatePerCheckAtom = atom(async (get): Promise<number> => {
  const setting = await get(estimatePerCheckSettingAtom)
  if (setting > 0) return setting
  // Fallback: most recent payroll check amount (D-11)
  const allPayroll = get(incomeChecksAtom)
    .filter((c) => c.category === 'payroll')
    .sort((a, b) => b.date.localeCompare(a.date))
  return allPayroll[0]?.netAmount ?? 0
})

// ── Projected month payroll (D-11) ─────────────────────────────────────────────
// projectedMonthPayroll = mtdPayroll + max(0, 2 − landedCount) × estimate
// This is payroll-ONLY — gift/other income does NOT feed the projected payroll.
export const projectedMonthPayrollAtom = atom(async (get): Promise<number> => {
  const landed = get(landedPayrollCountAtom)
  const mtdPayroll = get(mtdPayrollAtom)
  const estimate = await get(estimatePerCheckAtom)
  return mtdPayroll + Math.max(0, 2 - landed) * estimate
})

// ── Projected total (all categories) ──────────────────────────────────────────
// Non-payroll income is already landed; add it to the payroll projection.
export const projectedTotalAtom = atom(async (get): Promise<number> => {
  const projectedPayroll = await get(projectedMonthPayrollAtom)
  const nonPayrollLanded = get(currentMonthChecksAtom)
    .filter((c) => c.category !== 'payroll')
    .reduce((s, c) => s + c.netAmount, 0)
  return projectedPayroll + nonPayrollLanded
})

// ── Floors (from settings) ─────────────────────────────────────────────────────
const passiveFloorAtom = atom(async (get) => {
  const floors = await get(floorsLoadAtom)
  return floors.passive
})

const defendedLineAtom = atom(async (get) => {
  const floors = await get(floorsLoadAtom)
  return floors.defended
})

// ── Surplus (INC-03 — vs passive floor, NEVER defended or average) ─────────────
// surplus = max(0, projectedTotal − passiveFloor)
// NEVER computed against the defended line (INC-03 correctness invariant).
export const surplusAtom = atom(async (get): Promise<number> => {
  const projected = await get(projectedTotalAtom)
  const passive = await get(passiveFloorAtom)
  return Math.max(0, projected - passive)
})

// ── Backfill alert (D-09 / EDGE-01) ────────────────────────────────────────────
// backfillActive = projectedMonthPayroll < defendedLine
// Uses PAYROLL-ONLY projection — gift income must NEVER suppress this alert (Pitfall 4).
export const backfillActiveAtom = atom(async (get): Promise<boolean> => {
  const projectedPayroll = await get(projectedMonthPayrollAtom)
  const defended = await get(defendedLineAtom)
  return projectedPayroll < defended
})

// ── Known sources (D-06) ───────────────────────────────────────────────────────
// Plain async atom — autocomplete tolerates initial empty array.
// Reads storage.getKnownSources(); re-fetches on every mount (no liveQuery needed
// for known-source list — it updates on manual-entry save, not in real-time).
export const knownSourcesAtom = atom(async (): Promise<import('./income.types').KnownSource[]> =>
  storage.getKnownSources(),
)

// ── Save write-atom (manual entry form) ───────────────────────────────────────
// Write-only. Persists via storage.addIncomeCheck ONLY.
// NO refreshCounterAtom bump — liveQuery source atom (incomeChecksAtom) re-emits
// automatically on IDB write (PATTERNS lines 370-372 prohibition on manual counter).
export const saveIncomeCheckAtom = atom(
  null,
  async (_get, _set, check: Omit<import('./income.types').IncomeCheck, 'id'>): Promise<void> => {
    await storage.addIncomeCheck(check)
  },
)

// ── Commit checked rows + remember sources (paste-parse flow) ─────────────────
// Write-only. Receives the full rows array; filters to checked rows only.
// Persists via storage.addIncomeChecks + storage.saveKnownSources.
// NO refreshCounterAtom — liveQuery re-emits on IDB write automatically.
// D-07: note ← raw block text (already on CandidateRow); balance preserved.
// T-02-06: only storage.addIncomeChecks + saveKnownSources are called — no
//   credential, money-move, or floor-lowering method (Tampering mitigation).
export const commitCheckedRowsAtom = atom(
  null,
  async (
    _get,
    _set,
    rows: import('./income.types').CandidateRow[],
  ): Promise<void> => {
    const checked = rows.filter((r) => r.checked)
    // Map CandidateRow → Omit<IncomeCheck, 'id'> (D-07: note = raw block text)
    const toSave: Omit<import('./income.types').IncomeCheck, 'id'>[] = checked.map((r) => ({
      date: r.date ?? new Date().toISOString().slice(0, 10),
      netAmount: r.netAmount ?? 0,
      source: r.source ?? '',
      note: r.note ?? r.raw,
      category: r.category,
      taxable: r.taxable,
    }))
    await storage.addIncomeChecks(toSave)

    // D-06: remember each checked row's (source, category, taxable) into knownSources
    // Dedup by source — existing entries are overwritten with the committed values.
    const existing = await storage.getKnownSources()
    const merged = [...existing]
    for (const row of checked) {
      const src = row.source ?? ''
      if (!src) continue
      const idx = merged.findIndex((ks) => ks.source === src)
      const entry: import('./income.types').KnownSource = {
        source: src,
        category: row.category,
        taxable: row.taxable,
      }
      if (idx >= 0) {
        merged[idx] = entry
      } else {
        merged.push(entry)
      }
    }
    await storage.saveKnownSources(merged)
  },
)
