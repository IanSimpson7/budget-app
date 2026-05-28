// IncomeBar — horizontal progress meter showing MTD income against two floors.
// UI-SPEC §Income Bar Specification (lines 119-131), A11y §289-293.
//
// Segments (all colors from tailwind.config.ts tokens — NO inline hex):
//   • Actual fill (success): width = (mtdTotal / projectedMonth) × 100%
//   • Projected ghost (warning/40%): from fill edge to 100% when projected > mtd
//   • Passive floor marker: dashed text-secondary vertical line, labeled "floor"
//   • Defended-line tick: 2px solid accent vertical line, labeled "$3k"
//
// ARIA: role="meter" aria-valuenow={mtdTotal} aria-valuemin="0" aria-valuemax={projectedMonth}
//        aria-label="Month-to-date income"
// No animated width transitions (reduced-motion compliance + financial readability).

type Props = {
  mtdTotal: number
  projectedMonth: number
  passiveFloor: number
  defendedLine: number
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function IncomeBar({ mtdTotal, projectedMonth, passiveFloor, defendedLine }: Props) {
  // When projected is 0 (empty month), all widths collapse to 0 gracefully.
  const base = projectedMonth > 0 ? projectedMonth : 1

  const fillPct = Math.min(100, (mtdTotal / base) * 100)
  const ghostPct = projectedMonth > mtdTotal ? 100 - fillPct : 0
  const floorPct = Math.min(100, (passiveFloor / base) * 100)
  const defendedPct = Math.min(100, (defendedLine / base) * 100)

  // Overflow case: projected > defended × 1.2 — clamp bar at 100% and show label.
  const overflowAmount =
    projectedMonth > defendedLine * 1.2 ? projectedMonth - defendedLine : null

  return (
    <div>
      {/* ── Bar track ──────────────────────────────────────────────────────── */}
      <div
        role="meter"
        aria-valuenow={mtdTotal}
        aria-valuemin={0}
        aria-valuemax={projectedMonth}
        aria-label="Month-to-date income"
        className="relative h-[28px] w-full rounded-sm border border-surface-border bg-surface-raised overflow-hidden"
      >
        {/* Actual income fill */}
        <div
          className="absolute left-0 top-0 h-full bg-success"
          style={{ width: `${fillPct}%` }}
          aria-hidden="true"
        />

        {/* Projected ghost segment (warning at 40% opacity) */}
        {ghostPct > 0 && (
          <div
            className="absolute top-0 h-full bg-warning/40"
            style={{ left: `${fillPct}%`, width: `${ghostPct}%` }}
            aria-hidden="true"
          />
        )}

        {/* Passive floor marker — dashed text-secondary vertical line */}
        {floorPct > 0 && floorPct < 100 && (
          <div
            className="absolute top-0 h-full border-l border-dashed border-text-secondary"
            style={{ left: `${floorPct}%` }}
            aria-hidden="true"
          />
        )}

        {/* Defended-line tick — 2px solid accent */}
        {defendedPct > 0 && defendedPct <= 100 && (
          <div
            className="absolute top-0 h-full border-l-2 border-solid border-accent"
            style={{ left: `${Math.min(defendedPct, 99.5)}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ── Below-bar labels ───────────────────────────────────────────────── */}
      <div className="relative h-sp-4 mt-sp-1" aria-hidden="true">
        {/* Passive floor label */}
        {floorPct > 0 && floorPct < 100 && (
          <span
            className="absolute -translate-x-1/2 font-sans text-xs text-text-secondary"
            style={{ left: `${floorPct}%` }}
          >
            floor
          </span>
        )}

        {/* Defended-line label */}
        {defendedPct > 0 && defendedPct <= 100 && (
          <span
            className="absolute -translate-x-1/2 font-sans text-xs text-accent"
            style={{ left: `${Math.min(defendedPct, 99.5)}%` }}
          >
            $3k
          </span>
        )}
      </div>

      {/* Overflow note */}
      {overflowAmount !== null && (
        <p className="mt-sp-1 font-sans text-xs text-text-secondary">
          above defended line by{' '}
          <span className="font-mono">{currency.format(overflowAmount)}</span>
        </p>
      )}
    </div>
  )
}
