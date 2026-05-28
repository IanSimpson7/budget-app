// MetricCard — single stat card for the dashboard.
// UI-SPEC §Three Metric Cards (lines 135-149).
// Variant pattern mirrors NumberInput.tsx variant/class-composition style.
//
// Props:
//   label    — font-sans text-xs text-text-secondary
//   value    — font-mono text-[20px] text-text-primary (or text-success for default surplus)
//   subtext  — font-sans text-xs text-text-secondary (optional)
//   variant  — 'default' | 'alert' (alert = warning border + bg-warning/10)

type Props = {
  label: string
  value: string
  subtext?: string | undefined
  variant?: 'default' | 'alert' | undefined
  valueColor?: string | undefined
}

const cardBase =
  'bg-surface-raised border border-surface-border rounded-sm p-sp-3 flex flex-col gap-sp-1'
// bg-warning bg-opacity-10 applies the warning token at 10% opacity.
// Tailwind v3: bg-opacity-* works with plain hex tokens unlike /10 modifier.
const alertOverride = 'border-warning bg-warning bg-opacity-10'

export default function MetricCard({
  label,
  value,
  subtext,
  variant = 'default',
  valueColor,
}: Props) {
  const cardClass = variant === 'alert' ? `${cardBase} ${alertOverride}` : cardBase
  const labelClass =
    variant === 'alert'
      ? 'font-sans text-xs text-warning'
      : 'font-sans text-xs text-text-secondary'
  const defaultValueColor = valueColor ?? 'text-text-primary'

  return (
    <div className={cardClass}>
      <span className={labelClass}>{label}</span>
      <span className={`font-mono text-[20px] leading-[1.2] ${defaultValueColor}`}>{value}</span>
      {subtext && <span className="font-sans text-xs text-text-secondary">{subtext}</span>}
    </div>
  )
}
