import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  floorsLoadAtom,
  saveFloorsAtom,
} from '../domains/settings/settings.atoms'
import type { Floors } from '../storage/schema'
import * as storage from '../storage/storage'
import NumberInput from '../components/NumberInput'
import PrimaryButton from '../components/PrimaryButton'
import Toast, { type ToastVariant } from '../components/Toast'

// UI-SPEC §Phase 1 Screens — Settings: 3 NumberInputs + Save settings primary CTA.
// Phase 2 extension: "Income parameters" section with estimatePerCheck (D-11 override-by-default).
// Copywriting per UI-SPEC §Copywriting Contract verbatim.

export default function SettingsPage() {
  // { delay: 0 } per RESEARCH.md Pitfall 1 prophylaxis — harmless if patched
  // upstream; protects against React 19 + Jotai async-atom re-suspension flicker.
  const persisted = useAtomValue(floorsLoadAtom, { delay: 0 })
  const save = useSetAtom(saveFloorsAtom)

  const [draft, setDraft] = useState<Floors>(persisted)
  const [estimatePerCheck, setEstimatePerCheck] = useState<number>(0)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  // Reconcile local draft with newly-loaded persisted floors (e.g. after an
  // import elsewhere refreshes the atom).
  useEffect(() => {
    setDraft(persisted)
  }, [persisted])

  // Load persisted estimatePerCheck on mount (D-11 override-by-default).
  // 0 means "derive from most recent payroll check" — do NOT auto-write on mount.
  useEffect(() => {
    storage.getEstimatePerCheck().then(setEstimatePerCheck).catch(() => {/* leave at 0 */})
  }, [])

  const passiveError = !(draft.passive > 0) ? 'Must be greater than 0' : undefined
  const defendedError = !(draft.defended > 0) ? 'Must be greater than 0' : undefined
  const foodSeedError = !(draft.foodSeed > 0) ? 'Must be greater than 0' : undefined
  const hasError = Boolean(passiveError || defendedError || foodSeedError)

  const handleSave = async (): Promise<void> => {
    if (hasError) return
    await save(draft)
    await storage.saveEstimatePerCheck(estimatePerCheck)
    setToast({ message: 'Settings saved.', variant: 'success' })
  }

  return (
    <div className="flex flex-col gap-sp-6">
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Settings</h2>

      <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6 flex flex-col gap-sp-4">
        <NumberInput
          id="passive-floor"
          label="Passive income floor"
          helper="Solvency baseline — income needed to stay solvent"
          value={draft.passive}
          onChange={(n) => setDraft((d) => ({ ...d, passive: n }))}
          error={passiveError}
        />
        <NumberInput
          id="defended-line"
          label="Defended line"
          helper="Backfill triggers above this threshold — default $3,000"
          value={draft.defended}
          onChange={(n) => setDraft((d) => ({ ...d, defended: n }))}
          error={defendedError}
        />
        <NumberInput
          id="food-floor-seed"
          label="Food floor seed"
          helper="Starting estimate — refines from receipts in Phase 4"
          value={draft.foodSeed}
          onChange={(n) => setDraft((d) => ({ ...d, foodSeed: n }))}
          error={foodSeedError}
        />

        <div className="pt-sp-2">
          <PrimaryButton onClick={handleSave} disabled={hasError}>
            Save settings
          </PrimaryButton>
        </div>
      </div>

      {/* Income parameters section — Phase 2 extension (D-11 estimatePerCheck override) */}
      <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6 flex flex-col gap-sp-4">
        <h3 className="font-sans text-base font-semibold text-text-primary">Income parameters</h3>
        <NumberInput
          id="estimate-per-check"
          label="Estimate per check"
          helper="Used to project monthly payroll when fewer than 2 checks are in."
          value={estimatePerCheck}
          onChange={setEstimatePerCheck}
        />
      </div>

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
