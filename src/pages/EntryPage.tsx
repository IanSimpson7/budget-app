// EntryPage — /entry route. Two-tab shell: Manual entry (default) + Paste & parse placeholder.
// UI-SPEC §Surface 2: Check Entry verbatim.
// max-w-[480px] centered, font-display section heading "Add Income".
import { useState } from 'react'
import EntryTabBar, { type EntryTab, TAB_IDS, PANEL_IDS } from '../components/EntryTabBar'
import CheckEntryForm from '../domains/income/CheckEntryForm'

export default function EntryPage() {
  const [activeTab, setActiveTab] = useState<EntryTab>('manual')

  return (
    <div className="flex flex-col gap-sp-6 max-w-[480px] mx-auto">
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Add Income</h2>

      <EntryTabBar value={activeTab} onChange={setActiveTab} />

      {/* Manual entry panel */}
      <div
        id={PANEL_IDS['manual']}
        role="tabpanel"
        aria-labelledby={TAB_IDS['manual']}
        hidden={activeTab !== 'manual'}
      >
        {activeTab === 'manual' && <CheckEntryForm />}
      </div>

      {/* Paste & parse panel — placeholder; replaced by PasteParseFlow in 02-05 */}
      {/* MOUNT POINT: PasteParseFlow goes here in plan 02-05 */}
      <div
        id={PANEL_IDS['paste']}
        role="tabpanel"
        aria-labelledby={TAB_IDS['paste']}
        hidden={activeTab !== 'paste'}
      >
        {activeTab === 'paste' && (
          <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6">
            <p className="font-sans text-sm text-text-secondary">
              Paste &amp; parse — coming up
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
