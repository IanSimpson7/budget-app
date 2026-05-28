// DashboardPage — /dashboard.
// UI-SPEC §Surface 1: Income Dashboard (lines 111-159).
// SC#3 (MTD income with two visual markers) + SC#4 (backfill alert when payroll < defended).
//
// Reads ONLY derived read-only atoms from income.atoms.ts (02-02).
// Persists NOTHING (FOUND-06 — no write atoms on this surface).
// { delay: 0 } on all async atoms (Pitfall 1 prophylaxis — belt-and-suspenders).

import { useAtomValue } from 'jotai'
import { Link } from 'react-router-dom'
import {
  mtdTotalAtom,
  projectedTotalAtom,
  projectedMonthPayrollAtom,
  surplusAtom,
  backfillActiveAtom,
  currentMonthChecksAtom,
} from '../domains/income/income.atoms'
import { floorsLoadAtom } from '../domains/settings/settings.atoms'
import IncomeBar from '../components/IncomeBar'
import MetricCard from '../components/MetricCard'
import BackfillAlertCard from '../domains/income/BackfillAlertCard'
import SecondaryButton from '../components/SecondaryButton'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function monthLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default function DashboardPage() {
  // { delay: 0 } — Pitfall 1 prophylaxis for React 19 + Jotai async-atom re-suspension
  const mtdTotal = useAtomValue(mtdTotalAtom, { delay: 0 })
  const projectedTotal = useAtomValue(projectedTotalAtom, { delay: 0 })
  const projectedPayroll = useAtomValue(projectedMonthPayrollAtom, { delay: 0 })
  const surplus = useAtomValue(surplusAtom, { delay: 0 })
  const backfillActive = useAtomValue(backfillActiveAtom, { delay: 0 })
  const currentChecks = useAtomValue(currentMonthChecksAtom, { delay: 0 })
  const floors = useAtomValue(floorsLoadAtom, { delay: 0 })

  const month = monthLabel()
  const isEmpty = currentChecks.length === 0

  return (
    <div className="flex flex-col gap-sp-6">
      {/* Section heading — UI-SPEC Copywriting Contract */}
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">
        Income · {month}
      </h2>

      {/* Income bar */}
      <IncomeBar
        mtdTotal={mtdTotal}
        projectedMonth={projectedTotal}
        passiveFloor={floors.passive}
        defendedLine={floors.defended}
      />

      {/* Three metric cards */}
      <div className="grid grid-cols-3 gap-sp-2 sm:gap-sp-3">
        {/* Month to date */}
        <MetricCard
          label="Month to date"
          value={isEmpty ? '$0.00' : currency.format(mtdTotal)}
          valueColor={isEmpty ? 'text-text-disabled' : undefined}
        />

        {/* Projected month */}
        <MetricCard
          label="Projected month"
          value={isEmpty ? '$0.00' : currency.format(projectedTotal)}
          valueColor={isEmpty ? 'text-text-disabled' : undefined}
        />

        {/* Surplus OR BackfillAlertCard — in-place swap (pre-mirrors Phase-5 SURP-07) */}
        {backfillActive ? (
          <BackfillAlertCard projectedPayroll={projectedPayroll} />
        ) : (
          <MetricCard
            label="Surplus"
            value={isEmpty ? '$0.00' : currency.format(surplus)}
            valueColor={isEmpty ? 'text-text-disabled' : 'text-success'}
          />
        )}
      </div>

      {/* Empty state message */}
      {isEmpty && (
        <p className="font-sans text-sm text-text-secondary">
          No income recorded for {month}.{' '}
          <Link to="/entry" className="text-accent underline">
            Enter your first check.
          </Link>
        </p>
      )}

      {/* Add check CTA — full-width on mobile */}
      <div>
        <Link to="/entry" className="block w-full sm:w-auto sm:inline-block">
          <SecondaryButton className="w-full sm:w-auto">Add check</SecondaryButton>
        </Link>
      </div>
    </div>
  )
}
