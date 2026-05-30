// FoodPage — /food route.
// C1-CRITICAL: The protected food floor is NEVER editable downward.
// The floor renders as a locked, rent-like line with a Lock icon.
// No input, no pencil, no edit affordance on the floor line (V6/FOOD-12).
//
// Copywriting Contract: all strings sourced from 04-UI-SPEC Copywriting Contract.
// C1 NEVER-USE: "Cut food spending" / "Reduce food budget" / "Save on food" / "Trim food costs"
//
// I-06 DOUBLE-COUNT GUARD: the gateable food layer is display-only.
// Its total is NEVER added into foodFloorAtom.floor or survivalFloorAtom.
// The floor card always shows foodFloorAtom.floor exactly, unchanged by the gateable sum.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { Lock } from 'lucide-react'
import {
  foodFloorAtom,
  foodBadgeStatusAtom,
  flavorLineAtom,
  saveFlavorLineAtom,
} from '../domains/food/food.atoms'
import { gateableExpensesAtom } from '../domains/expenses/expenses.atoms'
import type { FloorGap } from '../domains/food/costEngine'
import NumberInput from '../components/NumberInput'
import { toMonthlyEquivalent } from '../storage/schema'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ── Month label ───────────────────────────────────────────────────────────────

function currentMonthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ── Gap copy (exact Copywriting Contract strings from 04-UI-SPEC) ─────────────

function gapCopy(gap: FloorGap): string {
  if (gap.type === 'stale-plan') {
    const date = gap.lastKnownDate ?? 'unknown'
    return `No meal plan covers today — showing fallback floor (last known: ${date})`
  }
  if (gap.type === 'unpriced-ingredient') {
    return `Ingredient '${gap.ingredientName}' has no unit cost — add it in Meal config`
  }
  if (gap.type === 'undefined-meal') {
    return `Meal '${gap.mealName}' has no definition — add ingredients in Meal config`
  }
  if (gap.type === 'unset-flat-cost') {
    return `Meal '${gap.mealName}' needs a cost — add it in Meal config`
  }
  return 'An unknown gap was detected — check Meal config'
}

// ── StatusBadge (D-11) ────────────────────────────────────────────────────────

type StatusBadgeProps = {
  status: 'clean' | 'needs-attention'
  gaps: FloorGap[]
}

function StatusBadge({ status, gaps }: StatusBadgeProps) {
  const [open, setOpen] = useState(false)
  const detailId = 'food-badge-detail'

  const badgeClasses =
    status === 'clean'
      ? 'bg-success bg-opacity-10 border border-success text-success font-sans text-xs rounded-sm px-sp-2 py-sp-1 font-semibold min-h-[44px] flex items-center'
      : 'bg-warning bg-opacity-10 border border-warning text-warning font-sans text-xs rounded-sm px-sp-2 py-sp-1 font-semibold min-h-[44px] flex items-center'

  const label =
    status === 'clean'
      ? open
        ? 'Plan current (tap to collapse)'
        : 'Plan current'
      : open
        ? 'Needs attention (tap to collapse)'
        : 'Needs attention'

  return (
    <div>
      <button
        type="button"
        data-testid="food-status-badge"
        className={badgeClasses}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && gaps.length > 0 && (
        <div
          id={detailId}
          className="bg-surface-raised border border-warning rounded-sm p-sp-3 mt-sp-2"
        >
          <ul role="list" className="flex flex-col gap-sp-2">
            {gaps.map((gap, i) => (
              <li
                key={i}
                role="listitem"
                className="font-sans text-sm text-warning"
              >
                {gapCopy(gap)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── ProtectedFloorCard ─────────────────────────────────────────────────────────
// C1/V6: NO input, NO pencil, NO edit affordance on the floor value.
// Lock icon is always present — never conditional.

type ProtectedFloorCardProps = {
  floor: number
  status: 'clean' | 'needs-attention'
  gaps: FloorGap[]
}

function ProtectedFloorCard({ floor, status, gaps }: ProtectedFloorCardProps) {
  return (
    <div
      data-testid="protected-floor-card"
      className="bg-surface-raised border border-surface-border rounded-sm p-sp-3 flex flex-col gap-sp-2"
    >
      {/* Label row: Lock icon + "Protected floor" + badge (right-aligned) */}
      <div className="flex items-center justify-between flex-wrap gap-sp-2">
        <div className="flex items-center gap-sp-1 min-h-[44px]">
          <Lock
            size={16}
            aria-hidden="true"
            data-testid="lock-icon"
            className="text-text-secondary shrink-0"
          />
          <span className="font-sans text-xs font-semibold text-text-secondary">
            Protected floor
          </span>
        </div>
        <StatusBadge status={status} gaps={gaps} />
      </div>

      {/* Floor value — NON-INTERACTIVE span (C1/V6) */}
      <span
        data-testid="floor-value"
        className="font-mono text-[20px] leading-[1.2] text-text-primary"
      >
        {currency.format(floor)}
      </span>

      {/* Explainer — always visible, never toggled (C1 condition 3) */}
      <span className="font-sans text-xs text-text-secondary">
        Computed from your meal plan — protected
      </span>
    </div>
  )
}

// ── FlavorLineCard (FOOD-10) ───────────────────────────────────────────────────
// "Flavor & condiments — protected" with an upward-only edit affordance.
// Rendered inside the protected section alongside the locked floor.

function FlavorLineCard() {
  const flavorLine = useAtomValue(flavorLineAtom)
  const saveFlavorLine = useSetAtom(saveFlavorLineAtom)

  const amount = typeof flavorLine === 'object' && flavorLine !== null
    ? (flavorLine as { amount: number }).amount
    : 50

  return (
    <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-3 flex flex-col gap-sp-2">
      <span className="font-sans text-xs font-semibold text-text-secondary">
        Flavor &amp; condiments — protected
      </span>
      <div data-testid="flavor-amount-input">
        <NumberInput
          id="flavor-amount"
          label="Monthly amount"
          value={amount}
          onChange={(next) => void saveFlavorLine({ amount: next })}
          helper="Excluded from per-meal pricing. Covers syrups, sauces, and condiments."
        />
      </div>
    </div>
  )
}

// ── GateableFoodCard (D-10, I-06 double-count guard) ──────────────────────────
// Display-only. The total here is NEVER added into foodFloorAtom.floor.
// Summed from Phase 3 gateable food expense lines — pure presentation join.

function GateableFoodCard() {
  const gateableExpenses = useAtomValue(gateableExpensesAtom)

  // Sum all gateable expenses (monthly equivalent).
  // D-10: this is a SEPARATE figure — NEVER added to foodFloorAtom.floor.
  const gateableTotal = gateableExpenses.reduce(
    (sum, item) => sum + toMonthlyEquivalent(item.amount, item.cadence),
    0,
  )

  return (
    <div
      data-testid="gateable-food-section"
      className="bg-surface-raised border border-surface-border rounded-sm p-sp-3 flex flex-col gap-sp-2"
    >
      <span className="font-sans text-xs font-semibold text-text-secondary">
        Discretionary food (gateable)
      </span>
      <span className="font-mono text-[20px] leading-[1.2] text-text-primary">
        {currency.format(gateableTotal)}
      </span>
      <span className="font-sans text-xs text-text-secondary">
        From your expense lines —{' '}
        <Link
          to="/expenses"
          className="text-accent underline min-h-[44px] inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          edit in Expenses
        </Link>
      </span>
    </div>
  )
}

// ── FoodPage ───────────────────────────────────────────────────────────────────

export default function FoodPage() {
  const foodFloor = useAtomValue(foodFloorAtom)
  const badgeStatus = useAtomValue(foodBadgeStatusAtom)

  // foodFloor may be a Promise-resolved value (async atom)
  const floor =
    typeof foodFloor === 'object' && foodFloor !== null && 'floor' in foodFloor
      ? (foodFloor as { floor: number }).floor
      : 550
  const gaps =
    typeof foodFloor === 'object' && foodFloor !== null && 'gaps' in foodFloor
      ? (foodFloor as { gaps: FloorGap[] }).gaps
      : []
  const status =
    typeof badgeStatus === 'string' && (badgeStatus === 'clean' || badgeStatus === 'needs-attention')
      ? badgeStatus
      : ('clean' as const)

  const monthLabel = currentMonthLabel()

  return (
    <div className="flex flex-col gap-sp-6 max-w-[640px] mx-auto">
      {/* Page heading */}
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">
        Food · {monthLabel}
      </h2>

      {/* Protected floor card (C1/V6 — read-only, Lock icon always present) */}
      <ProtectedFloorCard floor={floor} status={status} gaps={gaps} />

      {/* Flavor line — protected, upward edit only (FOOD-10) */}
      <FlavorLineCard />

      {/* Gateable discretionary food layer (D-10, I-06 — display-only, never summed into floor) */}
      <GateableFoodCard />

      {/* Link to config surface */}
      <div>
        <Link
          to="/food/config"
          className="font-sans text-sm text-accent underline min-h-[44px] inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Meal cost configuration
        </Link>
      </div>
    </div>
  )
}
