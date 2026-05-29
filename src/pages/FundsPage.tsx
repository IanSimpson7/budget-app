// FundsPage — /funds route.
// SC#3: car-insurance fund visible, accruing ~$82/mo toward $982 with status + progress.
// SC#4/EDGE-06: mark-paid resets balance + advances payout; annual cost never a monthly line.
// SC#5: second fund added via the same form, no code change.
// UI-04: sinking-fund instances show progress toward payout dates.
// C3: NO execute/transfer affordance anywhere — record actions only.
// UI-SPEC §Surface 3 verbatim. Copywriting Contract honored throughout.

import { useState, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  sinkingFundsAtom,
  saveFundAtom,
  updateFundAtom,
  deleteFundAtom,
  markFundPaidAtom,
} from '../domains/funds/funds.atoms'
import type { SinkingFund, SinkingFundCadence } from '../storage/schema'
import FundCard from '../components/FundCard'
import TextInput from '../components/TextInput'
import NumberInput from '../components/NumberInput'
import SelectInput from '../components/SelectInput'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import DestructiveButton from '../components/DestructiveButton'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const CADENCE_OPTIONS = [
  { value: 'annual', label: 'Annual' },
  { value: 'oneoff', label: 'One-off' },
]

// Format YYYY-MM → "Month YYYY+1" for mark-paid annual confirmation copy.
function nextYearPayoutLabel(payoutDate: string): string {
  const parts = payoutDate.split('-').map(Number)
  const year = parts[0] ?? new Date().getFullYear()
  const month = parts[1] ?? 1
  const d = new Date(year, month - 1, 1)
  d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ── Inline edit form ───────────────────────────────────────────────────────────

type EditFormProps = {
  fund: SinkingFund
  onDone: () => void
}

function EditForm({ fund, onDone }: EditFormProps) {
  const updateFund = useSetAtom(updateFundAtom)
  const [name, setName] = useState(fund.name)
  const [annualAmount, setAnnualAmount] = useState(fund.annualAmount)
  const [monthlyAccrual, setMonthlyAccrual] = useState(fund.monthlyAccrual)
  const [balance, setBalance] = useState(fund.balance)
  const [payoutDate, setPayoutDate] = useState(fund.payoutDate)
  const [cadence, setCadence] = useState<SinkingFundCadence>(fund.cadence)

  const canSave =
    name.trim().length > 0 &&
    Number.isFinite(annualAmount) &&
    annualAmount > 0 &&
    payoutDate.length > 0

  async function handleSave() {
    if (!canSave || fund.id == null) return
    await updateFund({
      id: fund.id,
      patch: {
        name: name.trim(),
        annualAmount,
        monthlyAccrual,
        balance,
        payoutDate,
        cadence,
      },
    })
    onDone()
  }

  return (
    <div className="bg-surface-raised border border-accent rounded-sm p-sp-4 flex flex-col gap-sp-3">
      <TextInput id={`edit-name-${fund.id}`} label="Fund name" value={name} onChange={setName} />
      <NumberInput
        id={`edit-target-${fund.id}`}
        label="Annual target"
        value={annualAmount}
        onChange={setAnnualAmount}
        helper="Provisional targets can be updated anytime."
      />
      <NumberInput
        id={`edit-accrual-${fund.id}`}
        label="Monthly accrual"
        value={monthlyAccrual}
        onChange={setMonthlyAccrual}
      />
      <NumberInput
        id={`edit-balance-${fund.id}`}
        label="Current balance"
        value={balance}
        onChange={setBalance}
      />
      <div className="flex flex-col gap-sp-1">
        <label
          htmlFor={`edit-payout-${fund.id}`}
          className="font-sans text-xs font-semibold text-text-secondary"
        >
          Payout date
        </label>
        <input
          id={`edit-payout-${fund.id}`}
          type="month"
          value={payoutDate}
          onChange={(e) => setPayoutDate(e.target.value)}
          className="bg-surface-raised text-text-primary font-sans text-sm border border-surface-border rounded-sm min-h-[44px] px-[12px] focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>
      <SelectInput
        id={`edit-cadence-${fund.id}`}
        label="Cadence"
        value={cadence}
        onChange={(v) => setCadence(v as SinkingFundCadence)}
        options={CADENCE_OPTIONS}
      />
      <div className="flex gap-sp-2">
        <PrimaryButton onClick={() => void handleSave()} disabled={!canSave}>
          Save
        </PrimaryButton>
        <SecondaryButton onClick={onDone}>Cancel</SecondaryButton>
      </div>
    </div>
  )
}

// ── FundCardWithActions — wraps FundCard with inline confirm state ─────────────

type FundCardWithActionsProps = {
  fund: SinkingFund
}

function FundCardWithActions({ fund }: FundCardWithActionsProps) {
  const markPaid = useSetAtom(markFundPaidAtom)
  const deleteFund = useSetAtom(deleteFundAtom)
  const [editing, setEditing] = useState(false)
  const [confirmingPaid, setConfirmingPaid] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  if (editing) {
    return <EditForm fund={fund} onDone={() => setEditing(false)} />
  }

  if (confirmingPaid) {
    const isAnnual = fund.cadence === 'annual'
    return (
      <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 flex flex-col gap-sp-3">
        <p className="font-sans text-sm text-text-secondary">
          {isAnnual
            ? `Mark ${fund.name} as paid? Balance resets and target date advances to ${nextYearPayoutLabel(fund.payoutDate)}.`
            : `Mark ${fund.name} as complete? This fund will be archived.`}
        </p>
        <div className="flex gap-sp-2">
          <PrimaryButton onClick={() => { void markPaid(fund); setConfirmingPaid(false) }}>
            {isAnnual ? 'Mark paid' : 'Mark complete'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setConfirmingPaid(false)}>Cancel</SecondaryButton>
        </div>
      </div>
    )
  }

  if (confirmingRemove) {
    return (
      <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 flex flex-col gap-sp-3">
        <p className="font-sans text-sm text-text-secondary">
          Remove {fund.name}? Accruals will no longer feed the survival floor.
        </p>
        <div className="flex gap-sp-2">
          <DestructiveButton
            onClick={() => {
              if (fund.id != null) void deleteFund(fund.id)
            }}
          >
            Remove
          </DestructiveButton>
          <SecondaryButton onClick={() => setConfirmingRemove(false)}>Cancel</SecondaryButton>
        </div>
      </div>
    )
  }

  return (
    <FundCard
      fund={fund}
      onEdit={() => setEditing(true)}
      onMarkPaid={() => setConfirmingPaid(true)}
      onRemove={() => setConfirmingRemove(true)}
    />
  )
}

// ── FundsPage ──────────────────────────────────────────────────────────────────

export default function FundsPage() {
  const funds = useAtomValue(sinkingFundsAtom)
  const saveFund = useSetAtom(saveFundAtom)
  const addFormRef = useRef<HTMLElement>(null)

  // Add form state
  const [name, setName] = useState('')
  const [annualAmount, setAnnualAmount] = useState(0)
  const [monthlyAccrual, setMonthlyAccrual] = useState(0)
  const [balance, setBalance] = useState(0)
  const [payoutDate, setPayoutDate] = useState('')
  const [cadence, setCadence] = useState<SinkingFundCadence>('annual')

  // Pre-populate monthly accrual when annual target changes
  function handleAnnualAmountChange(next: number) {
    setAnnualAmount(next)
    // Only auto-fill if user hasn't manually set accrual (or it was auto-derived)
    if (Number.isFinite(next) && next > 0) {
      setMonthlyAccrual(parseFloat((next / 12).toFixed(2)))
    }
  }

  const canAdd =
    name.trim().length > 0 &&
    Number.isFinite(annualAmount) &&
    annualAmount > 0 &&
    payoutDate.length > 0

  async function handleAdd() {
    if (!canAdd) return
    await saveFund({
      name: name.trim(),
      annualAmount,
      monthlyAccrual: Number.isFinite(monthlyAccrual) && monthlyAccrual > 0 ? monthlyAccrual : annualAmount / 12,
      balance: Number.isFinite(balance) ? balance : 0,
      payoutDate,
      cadence,
    })
    // Reset form
    setName('')
    setAnnualAmount(0)
    setMonthlyAccrual(0)
    setBalance(0)
    setPayoutDate('')
    setCadence('annual')
  }

  const isEmpty = funds.length === 0

  return (
    <div className="flex flex-col gap-sp-6 max-w-[640px] mx-auto">
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Sinking Funds</h2>

      {/* Fund cards */}
      {isEmpty ? (
        <div className="flex flex-col gap-sp-2">
          <p className="font-sans text-sm font-semibold text-text-primary">No sinking funds yet</p>
          <p className="font-sans text-sm text-text-secondary">
            Add a fund to spread annual costs across months — no budget shock when the bill arrives.
          </p>
          <button
            type="button"
            className="font-sans text-sm text-accent underline text-left min-h-[44px]"
            onClick={() => addFormRef.current?.querySelector('input')?.focus()}
          >
            Add your first fund
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-sp-4">
          {funds.map((fund) => (
            <FundCardWithActions key={fund.id} fund={fund} />
          ))}
        </div>
      )}

      {/* Add sinking fund form */}
      <section ref={addFormRef} className="flex flex-col gap-sp-4">
        <h3 className="font-sans text-sm font-semibold text-text-primary">Add a sinking fund</h3>
        <TextInput
          id="fund-name"
          label="Fund name"
          value={name}
          onChange={setName}
          placeholder="e.g. Car Insurance"
        />
        <NumberInput
          id="fund-annual-target"
          label="Annual target"
          value={annualAmount}
          onChange={handleAnnualAmountChange}
          helper="Provisional targets can be updated anytime."
        />
        <NumberInput
          id="fund-monthly-accrual"
          label="Monthly accrual"
          value={monthlyAccrual}
          onChange={setMonthlyAccrual}
          helper={
            annualAmount > 0
              ? `Suggested: ${currency.format(annualAmount / 12)}/mo`
              : undefined
          }
        />
        <NumberInput
          id="fund-balance"
          label="Current balance"
          value={balance}
          onChange={setBalance}
        />
        <div className="flex flex-col gap-sp-1">
          <label
            htmlFor="fund-payout-date"
            className="font-sans text-xs font-semibold text-text-secondary"
          >
            Payout date
          </label>
          <input
            id="fund-payout-date"
            type="month"
            value={payoutDate}
            onChange={(e) => setPayoutDate(e.target.value)}
            className="bg-surface-raised text-text-primary font-sans text-sm border border-surface-border rounded-sm min-h-[44px] px-[12px] focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <SelectInput
          id="fund-cadence"
          label="Cadence"
          value={cadence}
          onChange={(v) => setCadence(v as SinkingFundCadence)}
          options={CADENCE_OPTIONS}
        />
        <div>
          <PrimaryButton onClick={() => void handleAdd()} disabled={!canAdd}>
            Add fund
          </PrimaryButton>
        </div>
      </section>
    </div>
  )
}
