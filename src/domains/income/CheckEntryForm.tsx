// CheckEntryForm — Manual income check entry form.
// UI-SPEC §Surface 2: Check Entry §Manual Entry Tab verbatim.
//
// Persists via saveIncomeCheckAtom → storage.addIncomeCheck ONLY.
// NO direct db import. NO refreshCounterAtom (liveQuery re-emits automatically).
// Known-source autocomplete (D-06): selecting a source auto-fills category + taxable.
// Surplus badge (D-12): shown when entered month already has ≥2 payroll checks.
import { useEffect, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import NumberInput from '../../components/NumberInput'
import PrimaryButton from '../../components/PrimaryButton'
import Toast, { type ToastVariant } from '../../components/Toast'
import SourceAutocomplete from './SourceAutocomplete'
import { currentMonthChecksAtom, saveIncomeCheckAtom } from './income.atoms'
import { defaultTaxable, isInLocalMonth } from './classify'
import type { Category, KnownSource } from './income.types'

// ── helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isValidDate(iso: string): boolean {
  if (!iso) return false
  const d = new Date(`${iso}T00:00:00`)
  return !Number.isNaN(d.getTime())
}

// ── draft shape ───────────────────────────────────────────────────────────────

type Draft = {
  date: string
  netAmount: number | ''
  source: string
  category: Category
  taxable: boolean
  note: string
}

function emptyDraft(): Draft {
  return {
    date: todayISO(),
    netAmount: '',
    source: '',
    category: 'payroll',
    taxable: defaultTaxable('payroll'),
    note: '',
  }
}

// ── shared input class (all text inputs) ──────────────────────────────────────

const inputBase =
  'bg-surface-raised border border-surface-border rounded-sm px-sp-3 py-sp-2 ' +
  'font-sans text-sm text-text-primary min-h-[44px] w-full ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'placeholder:text-text-disabled'

const labelCls = 'font-sans text-xs font-semibold text-text-secondary'
const helperCls = 'font-sans text-xs text-text-secondary'
const errorCls = 'font-sans text-xs text-destructive'

// ── component ─────────────────────────────────────────────────────────────────

export default function CheckEntryForm() {
  // { delay: 0 } — Pitfall 1 prophylaxis (React 19 re-suspension protection)
  const currentMonthChecks = useAtomValue(currentMonthChecksAtom, { delay: 0 })
  const save = useSetAtom(saveIncomeCheckAtom)

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [touched, setTouched] = useState<Partial<Record<keyof Draft, boolean>>>({})
  const [autoFilled, setAutoFilled] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  // ── validation ──────────────────────────────────────────────────────────────

  const dateError =
    touched.date && !isValidDate(draft.date) ? 'Enter a valid date' : undefined
  const amountError =
    touched.netAmount && !(Number(draft.netAmount) > 0) ? 'Must be greater than 0' : undefined
  const sourceError =
    touched.source && draft.source.trim() === '' ? 'Source is required' : undefined

  const hasError =
    !isValidDate(draft.date) ||
    !(Number(draft.netAmount) > 0) ||
    draft.source.trim() === ''

  // ── surplus badge ──────────────────────────────────────────────────────────
  // Show the badge when the entered date's month already has ≥2 payroll checks.

  const surplusVisible = (() => {
    if (!isValidDate(draft.date)) return false
    const ref = new Date(`${draft.date}T00:00:00`)
    const payrollInMonth = currentMonthChecks.filter(
      (c) => c.category === 'payroll' && isInLocalMonth(c.date, ref),
    )
    return payrollInMonth.length >= 2
  })()

  // ── category change: update taxable default but keep user-editable ─────────

  const handleCategoryChange = (cat: Category) => {
    setDraft((d) => ({ ...d, category: cat, taxable: defaultTaxable(cat) }))
  }

  // ── known-source autocomplete callback ─────────────────────────────────────

  const handleSourceSelect = (ks: KnownSource) => {
    setDraft((d) => ({
      ...d,
      source: ks.source,
      category: ks.category,
      taxable: ks.taxable,
    }))
    setAutoFilled(true)
  }

  // Dismiss auto-fill note when source is manually changed afterward
  useEffect(() => {
    setAutoFilled(false)
  }, [draft.source])

  // ── save ───────────────────────────────────────────────────────────────────

  const handleSave = async (): Promise<void> => {
    if (hasError) return
    await save({
      date: draft.date,
      netAmount: Number(draft.netAmount),
      source: draft.source.trim(),
      category: draft.category,
      taxable: draft.taxable,
      note: draft.note,
    })
    setToast({ message: 'Check saved.', variant: 'success' })
    setDraft(emptyDraft())
    setTouched({})
    setAutoFilled(false)
    // Return focus to Date field for fast re-entry
    setTimeout(() => dateRef.current?.focus(), 0)
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6 flex flex-col gap-sp-4">

        {/* Date */}
        <div className="flex flex-col gap-sp-2">
          <label htmlFor="check-date" className={labelCls}>
            Date
          </label>
          <input
            ref={dateRef}
            id="check-date"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, date: true }))}
            aria-invalid={dateError ? 'true' : undefined}
            aria-describedby={dateError ? 'check-date-err' : undefined}
            className={`${inputBase} ${dateError ? 'border-destructive' : ''}`.trim()}
          />
          {dateError && (
            <span id="check-date-err" className={errorCls}>
              {dateError}
            </span>
          )}
        </div>

        {/* Net amount + surplus badge */}
        <div className="flex flex-col gap-sp-2">
          <NumberInput
            id="check-amount"
            label="Net amount"
            value={typeof draft.netAmount === 'number' ? draft.netAmount : 0}
            onChange={(n) => {
              setDraft((d) => ({ ...d, netAmount: n }))
              setTouched((t) => ({ ...t, netAmount: true }))
            }}
            error={amountError}
            className="font-mono"
          />
          {surplusVisible && (
            <span
              role="status"
              className="inline-flex self-start bg-success/15 text-success font-sans text-xs rounded-sm px-sp-2 py-sp-1"
            >
              3rd check this month — will be classified as surplus
            </span>
          )}
        </div>

        {/* Source with autocomplete */}
        <SourceAutocomplete
          id="check-source"
          value={draft.source}
          onChange={(v) => setDraft((d) => ({ ...d, source: v }))}
          onSelect={handleSourceSelect}
          onBlur={() => setTouched((t) => ({ ...t, source: true }))}
          error={sourceError}
        />
        {autoFilled && (
          <span className={helperCls}>Auto-filled from remembered source</span>
        )}

        {/* Category */}
        <div className="flex flex-col gap-sp-2">
          <label htmlFor="check-category" className={labelCls}>
            Category
          </label>
          <select
            id="check-category"
            value={draft.category}
            onChange={(e) => handleCategoryChange(e.target.value as Category)}
            className={`${inputBase} cursor-pointer`}
          >
            <option value="payroll">Payroll</option>
            <option value="gift">Gift</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Taxable */}
        <fieldset className="flex flex-col gap-sp-2">
          <legend className={labelCls}>Taxable</legend>
          <label className="inline-flex items-center gap-sp-2 min-h-[44px] cursor-pointer font-sans text-sm text-text-primary">
            <input
              id="check-taxable"
              type="checkbox"
              checked={draft.taxable}
              onChange={(e) => setDraft((d) => ({ ...d, taxable: e.target.checked }))}
              className="w-4 h-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            Taxable income
          </label>
        </fieldset>

        {/* Note */}
        <div className="flex flex-col gap-sp-2">
          <label htmlFor="check-note" className={labelCls}>
            Note <span className={helperCls + ' font-normal'}>(optional)</span>
          </label>
          <textarea
            id="check-note"
            rows={3}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            className={`${inputBase} resize-y`}
            placeholder="Paste raw block text or add a note"
          />
        </div>

        {/* Save CTA */}
        <div className="pt-sp-2">
          <PrimaryButton onClick={handleSave} disabled={hasError} className="w-full sm:w-auto">
            Save check
          </PrimaryButton>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
