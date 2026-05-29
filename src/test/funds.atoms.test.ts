// Atom tests for sinkingFundsAtom, isOnTrack, monthsUntilPayout, markFundPaidAtom.
// Tests EDGE-06, D-06, D-07.

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { createStore } from 'jotai'
import * as storage from '../storage/storage'
import {
  sinkingFundsAtom,
  isOnTrack,
  fundStatus,
  monthsUntilPayout,
  markFundPaidAtom,
} from '../domains/funds/funds.atoms'
import type { SinkingFund } from '../storage/schema'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

const CAR_FUND: Omit<SinkingFund, 'id'> = {
  name: 'Car insurance',
  annualAmount: 982,
  monthlyAccrual: 82,
  balance: 0,
  payoutDate: '2027-03',
  cadence: 'annual',
  provisional: true,
}

// ── sinkingFundsAtom ───────────────────────────────────────────────────────

describe('sinkingFundsAtom', () => {
  it('returns [] from a fresh DB (initialValue — no suspension)', () => {
    const store = createStore()
    expect(store.get(sinkingFundsAtom)).toEqual([])
  })
})

// ── monthsUntilPayout ──────────────────────────────────────────────────────

describe('monthsUntilPayout', () => {
  it('returns a non-negative number for a future date', () => {
    // 2027-03 is in the future from any 2026 date
    const months = monthsUntilPayout('2027-03')
    expect(months).toBeGreaterThanOrEqual(0)
  })

  it('clamps to 0 for a past payoutDate (months never negative)', () => {
    const months = monthsUntilPayout('2020-01')
    expect(months).toBe(0)
  })

  it('returns 0 for the current month', () => {
    const now = new Date()
    const currentYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const months = monthsUntilPayout(currentYYYYMM)
    expect(months).toBe(0)
  })

  it('uses local Date constructor (not UTC string) to avoid timezone off-by-one (Pitfall 2)', () => {
    // 2027-03 → local Date(2027, 2, 1) — month index is 2 (March)
    // If YYYY-MM were passed to new Date() directly it would be UTC midnight,
    // which in negative-offset timezones shifts to Feb 28 local.
    // monthsUntilPayout must always return the same value regardless of UTC offset.
    const months = monthsUntilPayout('2027-03')
    // From any 2026-05 date: (2027-2026)*12 + (3-current_month)
    // We just verify it's a whole number and non-negative
    expect(Number.isInteger(months)).toBe(true)
    expect(months).toBeGreaterThanOrEqual(0)
  })
})

// ── fundStatus / isOnTrack (rate-based, chosen 2026-05-29) ──────────────────
//
// Status is rate-based, NOT projected-balance-based: a normal $0 mid-cycle fund
// whose accrual rate covers a full cycle is on-track and must not false-alarm.

describe('fundStatus', () => {
  it('is on-track for car insurance at seed state (balance=0, $82/mo covers $984 ≥ $982)', () => {
    // Regression for the projected-balance false alarm: $0 balance with a future
    // payout previously showed "Behind"; the rate covers the cycle so it is on-track.
    const fund: SinkingFund = { ...CAR_FUND, id: 1, payoutDate: '2027-03' }
    expect(fundStatus(fund)).toBe('on-track')
    expect(isOnTrack(fund)).toBe(true)
  })

  it('is on-track when fully funded regardless of rate', () => {
    const fund: SinkingFund = { ...CAR_FUND, id: 1, balance: 982, monthlyAccrual: 1, payoutDate: '2030-01' }
    expect(fundStatus(fund)).toBe('on-track')
  })

  it('is behind when the accrual rate cannot cover a full cycle and it is unfunded', () => {
    // accrual 10 × 12 = 120 < 982, future payout, balance 0 → genuine rate shortfall
    const fund: SinkingFund = { ...CAR_FUND, id: 1, balance: 0, monthlyAccrual: 10, payoutDate: '2030-01' }
    expect(fundStatus(fund)).toBe('behind')
    expect(isOnTrack(fund)).toBe(false)
  })

  it('is overdue when the payout month has passed and it is still unfunded', () => {
    const fund: SinkingFund = { ...CAR_FUND, id: 1, balance: 0, payoutDate: '2020-01' }
    expect(fundStatus(fund)).toBe('overdue')
    expect(isOnTrack(fund)).toBe(false)
  })

  it('is on-track when funded even if the payout month has passed', () => {
    const fund: SinkingFund = { ...CAR_FUND, id: 1, balance: 982, payoutDate: '2020-01' }
    expect(fundStatus(fund)).toBe('on-track')
  })
})

// ── markFundPaidAtom (EDGE-06) ─────────────────────────────────────────────

describe('markFundPaidAtom (EDGE-06)', () => {
  it('annual fund: resets balance to 0 and advances payoutDate by exactly 12 months', async () => {
    const id = await storage.addSinkingFund({ ...CAR_FUND, balance: 900, payoutDate: '2027-03' })
    const funds = await storage.listSinkingFunds()
    const fund = funds.find(f => f.id === id)!

    const store = createStore()
    await store.set(markFundPaidAtom, fund)

    const updated = await storage.listSinkingFunds()
    const after = updated.find(f => f.id === id)!
    expect(after.balance).toBe(0)
    expect(after.payoutDate).toBe('2028-03') // 2027-03 + 12 months = 2028-03
  })

  it('annual fund: 2027-12 advances to 2028-12 (no YYYY-13 bug)', async () => {
    const id = await storage.addSinkingFund({ ...CAR_FUND, payoutDate: '2027-12' })
    const funds = await storage.listSinkingFunds()
    const fund = funds.find(f => f.id === id)!

    const store = createStore()
    await store.set(markFundPaidAtom, fund)

    const updated = await storage.listSinkingFunds()
    const after = updated.find(f => f.id === id)!
    expect(after.payoutDate).toBe('2028-12') // must NOT be '2027-13'
  })

  it('oneoff fund: is deleted on mark-paid (EDGE-06)', async () => {
    const id = await storage.addSinkingFund({
      name: 'Car purchase',
      annualAmount: 5000,
      monthlyAccrual: 417,
      balance: 5000,
      payoutDate: '2027-06',
      cadence: 'oneoff',
    })
    const funds = await storage.listSinkingFunds()
    const fund = funds.find(f => f.id === id)!

    const store = createStore()
    await store.set(markFundPaidAtom, fund)

    const remaining = await storage.listSinkingFunds()
    expect(remaining.find(f => f.id === id)).toBeUndefined()
  })

  it('mark-paid on fund with no id is a no-op', async () => {
    const store = createStore()
    const fundWithNoId: SinkingFund = { ...CAR_FUND } // no id
    await expect(store.set(markFundPaidAtom, fundWithNoId)).resolves.toBeUndefined()
  })
})
