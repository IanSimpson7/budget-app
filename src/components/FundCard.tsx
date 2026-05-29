// FundCard — single sinking-fund card for /funds route.
// UI-SPEC §Surface 3 / Fund Card verbatim.
// Renders: name + status badge row, progress bar, 3-col metrics row, payout date,
//   provisional flag, actions row.
// C3: NO transfer/execute/move-money affordance anywhere. Record actions only.
// Accessibility: role="progressbar" with aria-valuenow/min/max; status badge uses text
//   label (not color alone) per a11y spec.

import type { SinkingFund } from '../storage/schema'
import { fundStatus, type FundStatus } from '../domains/funds/funds.atoms'
import SecondaryButton from './SecondaryButton'
import DestructiveButton from './DestructiveButton'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// Status → label + token color. Text label (not color alone) per a11y spec.
const STATUS_DISPLAY: Record<FundStatus, { label: string; text: string; fill: string }> = {
  'on-track': { label: 'On track', text: 'text-success', fill: 'bg-success' },
  behind: { label: 'Behind', text: 'text-warning', fill: 'bg-warning' },
  overdue: { label: 'Overdue', text: 'text-destructive', fill: 'bg-destructive' },
}

// Format YYYY-MM → "Month YYYY" using local Date constructor (Pitfall 2).
function formatPayoutDate(payoutDate: string): string {
  const parts = payoutDate.split('-').map(Number)
  const year = parts[0] ?? new Date().getFullYear()
  const month = parts[1] ?? 1
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export type FundCardProps = {
  fund: SinkingFund
  onEdit: (fund: SinkingFund) => void
  onMarkPaid: (fund: SinkingFund) => void
  onRemove: (fund: SinkingFund) => void
}

export default function FundCard({ fund, onEdit, onMarkPaid, onRemove }: FundCardProps) {
  const status = fundStatus(fund)
  const display = STATUS_DISPLAY[status]
  const fillPercent = Math.min(100, fund.annualAmount > 0 ? (fund.balance / fund.annualAmount) * 100 : 0)

  return (
    <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 flex flex-col gap-sp-3">
      {/* Name + status badge row */}
      <div className="flex justify-between items-center">
        <span className="font-sans text-sm font-semibold text-text-primary">{fund.name}</span>
        <span className={`font-sans text-xs font-semibold ${display.text}`}>
          {display.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-[6px] rounded-sm bg-surface-border">
        <div
          role="progressbar"
          aria-valuenow={fund.balance}
          aria-valuemin={0}
          aria-valuemax={fund.annualAmount}
          className={`h-full rounded-sm ${display.fill}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {/* 3-col metrics row */}
      <div className="grid grid-cols-3 gap-sp-2">
        <div className="flex flex-col gap-sp-1">
          <span className="font-sans text-xs text-text-secondary">Current</span>
          <span className="font-mono text-[20px] text-text-primary">{currency.format(fund.balance)}</span>
        </div>
        <div className="flex flex-col gap-sp-1">
          <span className="font-sans text-xs text-text-secondary">Target</span>
          <span className="font-mono text-[20px] text-text-primary">{currency.format(fund.annualAmount)}</span>
        </div>
        <div className="flex flex-col gap-sp-1">
          <span className="font-sans text-xs text-text-secondary">/ mo accrual</span>
          <span className="font-mono text-[20px] text-text-primary">{currency.format(fund.monthlyAccrual)}</span>
        </div>
      </div>

      {/* Payout date */}
      <span className="font-sans text-xs text-text-secondary">Due {formatPayoutDate(fund.payoutDate)}</span>

      {/* Provisional flag */}
      {fund.provisional && (
        <span className="font-sans text-xs text-warning">
          Target is provisional — update at renewal.
        </span>
      )}

      {/* Actions row — record actions only (C3) */}
      <div className="flex gap-sp-2">
        <SecondaryButton onClick={() => onEdit(fund)}>Edit</SecondaryButton>
        <SecondaryButton onClick={() => onMarkPaid(fund)}>Mark paid</SecondaryButton>
        <DestructiveButton onClick={() => onRemove(fund)}>Remove</DestructiveButton>
      </div>
    </div>
  )
}
