// Sinking-fund domain — reactive Jotai atom chain.
//
// Source atom: atomWithObservable over storage.observeSinkingFunds().
//   initialValue:[] sidesteps the React 19 re-suspense bug (Pitfall 1).
//
// Exported helpers: monthsUntilPayout, isOnTrack (pure functions — consumed by
//   UI to render on-track/behind status without derived atoms for simplicity).
//
// Boundary: this file imports `storage` ONLY — never `db`. Grep gate.

import { atom } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import * as storage from '../../storage/storage'
import type { SinkingFund } from '../../storage/schema'

// ── Source atom ────────────────────────────────────────────────────────────────

export const sinkingFundsAtom = atomWithObservable<SinkingFund[]>(
  () => storage.observeSinkingFunds(),
  { initialValue: [] },
)

// ── Sum of all monthly accruals (exported for survivalFloorAtom in expenses.atoms.ts) ──

// Pure synchronous derived atom consumed by expenses.atoms.ts to include fund
// accruals in the survival floor (D-08).
export const sinkingFundAccrualsAtom = atom((get): number =>
  get(sinkingFundsAtom).reduce((sum, f) => sum + f.monthlyAccrual, 0),
)

// ── monthsUntilPayout (pure function) ─────────────────────────────────────────
//
// Pitfall 2 avoidance: parse YYYY-MM by splitting to integers and using the
// LOCAL Date constructor (year, month-1, 1) — never pass 'YYYY-MM' directly
// to new Date() which interprets it as UTC midnight and can return the wrong
// local month in negative-offset timezones.

export function monthsUntilPayout(payoutDate: string): number {
  return Math.max(0, payoutMonthsDelta(payoutDate))
}

// Signed month delta to the payout month: negative when the payout month is in
// the past, 0 in the current month, positive in the future. Unclamped so callers
// can distinguish "overdue" from "due this month". Parses YYYY-MM via the local
// Date frame per Pitfall 2.
function payoutMonthsDelta(payoutDate: string): number {
  const parts = payoutDate.split('-').map(Number)
  const py = parts[0] ?? 0
  const pm = parts[1] ?? 1
  const now = new Date()
  return (py - now.getFullYear()) * 12 + (pm - (now.getMonth() + 1))
}

// ── fundStatus (pure function, D-06 — rate-based) ─────────────────────────────
//
// Status semantics (chosen 2026-05-29, supersedes the original projected-balance
// model that false-alarmed a normal $0 mid-cycle fund):
//   on-track → fully funded, OR the accrual RATE covers a full annual cycle
//              (monthlyAccrual × 12 >= annualAmount). Current balance is NOT
//              held against the fund — a $0 balance partway through a cycle is
//              normal and must not raise a "behind" alarm (clinical-safety posture).
//   behind   → not yet funded AND the rate is structurally too low to ever cover
//              the cycle. This is the only genuine early warning we surface.
//   overdue  → the payout month has passed and the fund is still not fully funded.

export type FundStatus = 'on-track' | 'behind' | 'overdue'

export function fundStatus(fund: SinkingFund): FundStatus {
  const funded = fund.balance >= fund.annualAmount
  if (funded) return 'on-track'
  if (payoutMonthsDelta(fund.payoutDate) < 0) return 'overdue'
  if (fund.monthlyAccrual * 12 >= fund.annualAmount) return 'on-track'
  return 'behind'
}

// Backward-compatible boolean wrapper. True only for the on-track state.
export function isOnTrack(fund: SinkingFund): boolean {
  return fundStatus(fund) === 'on-track'
}

// ── Write atoms ────────────────────────────────────────────────────────────────
// Write-only. No refresh counter — liveQuery re-emits automatically on IDB write.

export const saveFundAtom = atom(
  null,
  async (_get, _set, fund: Omit<SinkingFund, 'id'>): Promise<void> => {
    await storage.addSinkingFund(fund)
  },
)

export const updateFundAtom = atom(
  null,
  async (_get, _set, { id, patch }: { id: number; patch: Partial<SinkingFund> }): Promise<void> => {
    await storage.updateSinkingFund(id, patch)
  },
)

export const deleteFundAtom = atom(
  null,
  async (_get, _set, id: number): Promise<void> => {
    await storage.deleteSinkingFund(id)
  },
)

// ── markFundPaidAtom (EDGE-06, D-07) ──────────────────────────────────────────
//
// annual fund: reset balance=0, advance payoutDate +12 months via Date arithmetic
//   (avoids YYYY-13 off-by-one — setFullYear handles month wrapping correctly).
// oneoff fund: delete the row (fund completes; no recurrence needed).
// C3: this is a DB state update — NOT a money action. Ian initiates manually.

export const markFundPaidAtom = atom(
  null,
  async (_get, _set, fund: SinkingFund): Promise<void> => {
    if (!fund.id) return
    if (fund.cadence === 'oneoff') {
      await storage.deleteSinkingFund(fund.id)
    } else {
      // Advance payoutDate by exactly 12 calendar months using Date arithmetic.
      // Parse YYYY-MM as local (year, month-1, 1) per Pitfall 2.
      const parts = fund.payoutDate.split('-').map(Number)
      const year = parts[0] ?? 0
      const month = parts[1] ?? 1
      const d = new Date(year, month - 1, 1)
      d.setFullYear(d.getFullYear() + 1)
      const newPayoutDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      await storage.updateSinkingFund(fund.id, {
        balance: 0,
        payoutDate: newPayoutDate,
      })
    }
  },
)
