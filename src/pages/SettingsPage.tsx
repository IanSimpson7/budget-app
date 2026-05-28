import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  floorsLoadAtom,
  saveFloorsAtom,
} from '../domains/settings/settings.atoms'
import type { Floors } from '../storage/schema'
import NumberInput from '../components/NumberInput'
import PrimaryButton from '../components/PrimaryButton'
import Toast, { type ToastVariant } from '../components/Toast'

// UI-SPEC §Phase 1 Screens — Settings: 3 NumberInputs + Save settings primary CTA.
// Copywriting per UI-SPEC §Copywriting Contract verbatim.

export default function SettingsPage() {
  // { delay: 0 } per RESEARCH.md Pitfall 1 prophylaxis — harmless if patched
  // upstream; protects against React 19 + Jotai async-atom re-suspension flicker.
  const persisted = useAtomValue(floorsLoadAtom, { delay: 0 })
  const save = useSetAtom(saveFloorsAtom)

  const [draft, setDraft] = useState<Floors>(persisted)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  // Reconcile local draft with newly-loaded persisted floors (e.g. after an
  // import elsewhere refreshes the atom).
  useEffect(() => {
    setDraft(persisted)
  }, [persisted])

  const passiveError = !(draft.passive > 0) ? 'Must be greater than 0' : undefined
  const defendedError = !(draft.defended > 0) ? 'Must be greater than 0' : undefined
  const foodSeedError = !(draft.foodSeed > 0) ? 'Must be greater than 0' : undefined
  const hasError = Boolean(passiveError || defendedError || foodSeedError)

  const handleSave = async (): Promise<void> => {
    if (hasError) return
    await save(draft)
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

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
