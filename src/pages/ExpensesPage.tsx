// ExpensesPage — /expenses route.
// SC#1: add/edit/delete expense lines; categorized PROTECTED vs GATEABLE view.
// UI-SPEC §Surface 2 verbatim. Copywriting Contract honored throughout.
// EXP-07: soft advisory when name matches /whey|supplement/i — never blocks submit (C1).
// Seeded PROTECTED starter rows are handled by main.tsx seedExpensesIfEmpty().

import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  protectedExpensesAtom,
  gateableExpensesAtom,
  saveExpenseItemAtom,
  updateExpenseItemAtom,
  deleteExpenseItemAtom,
} from '../domains/expenses/expenses.atoms'
import type { ExpenseItem, Classification, Cadence } from '../storage/schema'
import TextInput from '../components/TextInput'
import NumberInput from '../components/NumberInput'
import SelectInput from '../components/SelectInput'
import ClassificationToggle from '../components/ClassificationToggle'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import DestructiveButton from '../components/DestructiveButton'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const CADENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'oneoff', label: 'One-off' },
]

function cadenceBadge(cadence: Cadence): string {
  if (cadence === 'monthly') return '/ mo'
  if (cadence === 'annual') return '/ yr'
  return 'one-off'
}

// EXP-07 advisory — soft text, never blocks submit (C1 / clinical-safety posture).
function exp07Advisory(name: string): string | undefined {
  if (/whey|supplement/i.test(name)) {
    return 'Supplement costs belong in the food floor (Phase 4). Add here only if you want this in fixed-ex-food.'
  }
  return undefined
}

function cadenceHelper(cadence: Cadence, amount: number): string | undefined {
  if (cadence === 'annual') {
    return `Counted as ${currency.format(amount / 12)}/mo in the survival floor.`
  }
  if (cadence === 'oneoff') {
    return 'One-off costs are excluded from the survival floor.'
  }
  return undefined
}

// ── Inline edit row ────────────────────────────────────────────────────────────

type EditRowProps = {
  item: ExpenseItem
  onDone: () => void
}

function EditRow({ item, onDone }: EditRowProps) {
  const updateExpense = useSetAtom(updateExpenseItemAtom)
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(item.amount)
  const [cadence, setCadence] = useState<Cadence>(item.cadence)
  const [classification, setClassification] = useState<Classification>(item.classification)

  const canSave = name.trim().length > 0 && Number.isFinite(amount) && amount > 0

  async function handleSave() {
    if (!canSave || item.id == null) return
    await updateExpense({ id: item.id, patch: { name: name.trim(), amount, cadence, classification } })
    onDone()
  }

  return (
    <div className="bg-surface-raised border border-accent rounded-sm p-sp-3 flex flex-col gap-sp-3">
      <TextInput id={`edit-name-${item.id}`} label="Name" value={name} onChange={setName} />
      <NumberInput
        id={`edit-amount-${item.id}`}
        label="Amount"
        value={amount}
        onChange={setAmount}
        helper={cadenceHelper(cadence, amount)}
      />
      <SelectInput
        id={`edit-cadence-${item.id}`}
        label="Cadence"
        value={cadence}
        onChange={(v) => setCadence(v as Cadence)}
        options={CADENCE_OPTIONS}
      />
      <ClassificationToggle value={classification} onChange={setClassification} />
      <div className="flex gap-sp-2">
        <PrimaryButton onClick={() => void handleSave()} disabled={!canSave}>
          Save
        </PrimaryButton>
        <SecondaryButton onClick={onDone}>Cancel</SecondaryButton>
      </div>
    </div>
  )
}

// ── Expense row ────────────────────────────────────────────────────────────────

type ExpenseRowProps = {
  item: ExpenseItem
}

function ExpenseRow({ item }: ExpenseRowProps) {
  const deleteExpense = useSetAtom(deleteExpenseItemAtom)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (editing) {
    return <EditRow item={item} onDone={() => setEditing(false)} />
  }

  return (
    <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-3 flex flex-col gap-sp-2">
      <span className="font-sans text-sm text-text-primary">{item.name}</span>
      <div className="flex items-baseline gap-sp-1">
        <span className="font-mono text-[20px] text-text-primary">
          {currency.format(item.amount)}
        </span>
        <span className="font-sans text-xs text-text-secondary">{cadenceBadge(item.cadence)}</span>
      </div>

      {confirming ? (
        <div className="flex flex-col gap-sp-2">
          <span className="font-sans text-sm text-text-secondary">
            Remove {item.name}? This will update the survival floor.
          </span>
          <div className="flex gap-sp-2">
            <DestructiveButton
              onClick={() => {
                if (item.id != null) void deleteExpense(item.id)
              }}
            >
              Remove
            </DestructiveButton>
            <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="flex gap-sp-2">
          <SecondaryButton onClick={() => setEditing(true)}>Edit</SecondaryButton>
          <DestructiveButton onClick={() => setConfirming(true)}>Remove</DestructiveButton>
        </div>
      )}
    </div>
  )
}

// ── Column ─────────────────────────────────────────────────────────────────────

type ColumnProps = {
  heading: string
  items: ExpenseItem[]
  emptyText: string
}

function Column({ heading, items, emptyText }: ColumnProps) {
  return (
    <div className="flex flex-col gap-sp-3">
      <h3 className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide">
        {heading}
      </h3>
      {items.length === 0 ? (
        <p className="font-sans text-sm text-text-secondary">{emptyText}</p>
      ) : (
        items.map((item) => <ExpenseRow key={item.id} item={item} />)
      )}
    </div>
  )
}

// ── ExpensesPage ───────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const protectedExpenses = useAtomValue(protectedExpensesAtom)
  const gateableExpenses = useAtomValue(gateableExpensesAtom)
  const saveExpense = useSetAtom(saveExpenseItemAtom)

  // Form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [classification, setClassification] = useState<Classification>('protected')

  const canAdd = name.trim().length > 0 && Number.isFinite(amount) && amount > 0
  const advisory = exp07Advisory(name)
  const amountHelper = cadenceHelper(cadence, amount)

  async function handleAdd() {
    if (!canAdd) return
    await saveExpense({ name: name.trim(), amount, cadence, classification })
    // Reset form
    setName('')
    setAmount(0)
    setCadence('monthly')
    setClassification('protected')
  }

  const isEmpty = protectedExpenses.length === 0 && gateableExpenses.length === 0

  return (
    <div className="flex flex-col gap-sp-6 max-w-[640px] mx-auto">
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Expenses</h2>

      {/* Add expense form */}
      <section className="flex flex-col gap-sp-4">
        <TextInput
          id="expense-name"
          label="Name"
          value={name}
          onChange={setName}
          helper={advisory}
          placeholder="e.g. Housing"
        />
        <NumberInput
          id="expense-amount"
          label="Amount"
          value={amount}
          onChange={setAmount}
          helper={amountHelper}
        />
        <SelectInput
          id="expense-cadence"
          label="Cadence"
          value={cadence}
          onChange={(v) => setCadence(v as Cadence)}
          options={CADENCE_OPTIONS}
        />
        <ClassificationToggle value={classification} onChange={setClassification} />
        <div>
          <PrimaryButton onClick={() => void handleAdd()} disabled={!canAdd}>
            Add expense
          </PrimaryButton>
        </div>
      </section>

      {/* Categorized expense list */}
      {isEmpty ? (
        <div className="flex flex-col gap-sp-2">
          <p className="font-sans text-sm font-semibold text-text-primary">No expenses recorded</p>
          <p className="font-sans text-sm text-text-secondary">
            Add your fixed costs to compute the survival floor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-4">
          <Column
            heading="Protected"
            items={protectedExpenses}
            emptyText="No protected expenses yet."
          />
          <Column
            heading="Gateable"
            items={gateableExpenses}
            emptyText="No gateable expenses yet."
          />
        </div>
      )}
    </div>
  )
}
