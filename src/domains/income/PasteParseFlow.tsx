// PasteParseFlow — textarea → parseStatement → ConfirmTable → commit state machine.
// UI-SPEC §Paste & Parse Tab — two-step flow: input → confirm → done.
//
// Pattern: BackupPage.tsx explicit useState step-machine + try/catch + toast.
// Security T-02-X: toast copy is a fixed template ("Saved {N} checks.") —
//   never concatenates parsed content (BackupPage rule, lines 12-13).
// Security T-02-06: commit path calls only storage.addIncomeChecks + saveKnownSources.
// No import { db }. No refreshCounterAtom.
import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useNavigate } from 'react-router-dom'
import { parseStatement } from './parser/parseStatement'
import { checkingAdapter } from './parser/checkingAdapter'
import { defaultChecked, defaultTaxable } from './classify'
import { knownSourcesAtom, commitCheckedRowsAtom } from './income.atoms'
import ConfirmTable from './ConfirmTable'
import PrimaryButton from '../../components/PrimaryButton'
import SecondaryButton from '../../components/SecondaryButton'
import Toast, { type ToastVariant } from '../../components/Toast'
import type { CandidateRow } from './income.types'

type Step = 'input' | 'confirm' | 'committing' | 'done'

export default function PasteParseFlow() {
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [committedCount, setCommittedCount] = useState(0)

  const knownSources = useAtomValue(knownSourcesAtom)
  const commitRows = useSetAtom(commitCheckedRowsAtom)
  const navigate = useNavigate()

  const checkedCount = rows.filter((r) => r.checked).length

  const handleParse = (): void => {
    setParseError(null)
    try {
      const parsed = parseStatement(text, checkingAdapter)
      if (parsed.length === 0) {
        setParseError('No transaction rows found. Check the format and try again.')
        return
      }
      // Apply D-05 defaultChecked + defaultTaxable using knownSources
      const enriched: CandidateRow[] = parsed.map((row) => ({
        ...row,
        checked: defaultChecked(row, knownSources),
        taxable: row.taxable || defaultTaxable(row.category),
      }))
      setRows(enriched)
      setStep('confirm')
    } catch {
      // RangeError (DoS cap) or unexpected parse error
      setParseError('No transaction rows found. Check the format and try again.')
    }
  }

  const handleCommit = async (): Promise<void> => {
    setStep('committing')
    try {
      const n = rows.filter((r) => r.checked).length
      await commitRows(rows)
      setCommittedCount(n)
      setStep('done')
      setToast({ message: `Saved ${n} checks.`, variant: 'success' })
    } catch {
      setToast({ message: 'Commit failed. Please try again.', variant: 'error' })
      setStep('confirm')
    }
  }

  const handleBack = (): void => {
    setStep('input')
    setParseError(null)
  }

  const handleAddMore = (): void => {
    setStep('input')
    setText('')
    setRows([])
    setParseError(null)
    setToast(null)
  }

  return (
    <div className="flex flex-col gap-sp-4">
      {/* ── Step 1: Paste input ── */}
      {step === 'input' && (
        <div className="flex flex-col gap-sp-3">
          <label
            htmlFor="paste-textarea"
            className="font-sans text-xs font-semibold text-text-secondary"
          >
            Paste transaction text
          </label>
          <p className="font-sans text-xs text-text-secondary leading-[1.5]">
            Paste your checking statement block. Rows are parsed automatically.
          </p>
          <textarea
            id="paste-textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setParseError(null)
            }}
            rows={7}
            className={
              'min-h-[160px] w-full resize-y ' +
              'bg-surface-raised border border-surface-border rounded-sm ' +
              'px-sp-3 py-sp-2 font-mono text-sm text-text-primary ' +
              'placeholder:text-text-disabled ' +
              'focus:outline-none focus:border-accent ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
            }
            placeholder="Paste statement text here…"
          />

          {parseError && (
            <p
              role="alert"
              className="font-sans text-sm text-destructive"
            >
              {parseError}
            </p>
          )}

          <div>
            <PrimaryButton onClick={handleParse} disabled={!text.trim()}>
              Parse entries
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── Step 2: Confirm table ── */}
      {(step === 'confirm' || step === 'committing') && (
        <div className="flex flex-col gap-sp-3">
          <div>
            <SecondaryButton onClick={handleBack} disabled={step === 'committing'}>
              Back — re-paste
            </SecondaryButton>
          </div>

          <ConfirmTable rows={rows} onChange={setRows} />

          <p className="font-sans text-xs text-text-secondary">
            {checkedCount} of {rows.length} entries selected
          </p>

          <div>
            <PrimaryButton
              onClick={() => void handleCommit()}
              disabled={checkedCount === 0 || step === 'committing'}
            >
              {step === 'committing' ? 'Saving…' : `Commit ${checkedCount} checks`}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── Step 3: Done summary ── */}
      {step === 'done' && (
        <div className="flex flex-col gap-sp-4">
          <p className="font-sans text-sm text-text-primary">
            {committedCount} {committedCount === 1 ? 'check' : 'checks'} saved successfully.
          </p>
          <div className="flex gap-sp-3 flex-wrap">
            <SecondaryButton onClick={handleAddMore}>Add more</SecondaryButton>
            <SecondaryButton onClick={() => void navigate('/dashboard')}>
              View dashboard
            </SecondaryButton>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
