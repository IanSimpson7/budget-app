// BackfillAlertCard — replaces the surplus MetricCard when payroll projection
// drops below the defended line (D-09, INC-06, EDGE-01).
//
// UI-SPEC §Backfill Alert Card (lines 144-149), A11y line 294.
// role="alert" so screen readers announce it on dynamic appearance.
// Copy verbatim from UI-SPEC §Copywriting Contract.
// Tokens only — no inline hex.

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

type Props = {
  projectedPayroll: number
  defendedLine: number
}

const wholeCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function BackfillAlertCard({ projectedPayroll, defendedLine }: Props) {
  return (
    <div
      role="alert"
      className="bg-warning bg-opacity-10 border border-warning rounded-sm p-sp-3 flex flex-col gap-sp-1"
    >
      <span className="font-sans text-xs text-warning">Backfill alert</span>
      <span className="font-mono text-[20px] leading-[1.2] text-text-primary">
        {currency.format(projectedPayroll)}
      </span>
      <span className="font-sans text-xs text-text-secondary">
        below {wholeCurrency.format(defendedLine)} — add sessions to defend
      </span>
    </div>
  )
}
