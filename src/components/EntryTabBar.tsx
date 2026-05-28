// EntryTabBar — ARIA two-tab control: Manual entry (default) + Paste & parse.
// UI-SPEC §Surface 2: Check Entry §Tab control verbatim.
// Active tab: bg-surface-raised border-b-2 border-accent text-text-primary
// Inactive: bg-surface-DEFAULT text-text-secondary hover:text-text-primary
// Arrow-key navigation per ARIA tabs pattern.
import type { KeyboardEvent } from 'react'

export type EntryTab = 'manual' | 'paste'

type Props = {
  value: EntryTab
  onChange: (tab: EntryTab) => void
}

const TAB_ORDER: EntryTab[] = ['manual', 'paste']

const tabBase =
  'inline-flex items-center justify-center flex-1 min-h-[44px] px-sp-4 ' +
  'font-sans text-sm font-semibold ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'transition-colors duration-150 ease-out'

function tabClasses(isActive: boolean): string {
  return isActive
    ? `${tabBase} bg-surface-raised border-b-2 border-accent text-text-primary`
    : `${tabBase} bg-surface border-b-2 border-transparent text-text-secondary hover:text-text-primary`
}

const TAB_IDS: Record<EntryTab, string> = {
  manual: 'entry-tab-manual',
  paste: 'entry-tab-paste',
}

const PANEL_IDS: Record<EntryTab, string> = {
  manual: 'entry-panel-manual',
  paste: 'entry-panel-paste',
}

const TAB_LABELS: Record<EntryTab, string> = {
  manual: 'Manual entry',
  paste: 'Paste & parse',
}

export { TAB_IDS, PANEL_IDS }

export default function EntryTabBar({ value, onChange }: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tab: EntryTab) => {
    const idx = TAB_ORDER.indexOf(tab)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = TAB_ORDER[(idx + 1) % TAB_ORDER.length]
      if (next !== undefined) onChange(next)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]
      if (prev !== undefined) onChange(prev)
    }
  }

  return (
    <div role="tablist" aria-label="Entry mode" className="flex border-b border-surface-border">
      {TAB_ORDER.map((tab) => (
        <button
          key={tab}
          id={TAB_IDS[tab]}
          role="tab"
          aria-selected={value === tab}
          aria-controls={PANEL_IDS[tab]}
          tabIndex={value === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(e) => handleKeyDown(e, tab)}
          className={tabClasses(value === tab)}
          type="button"
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  )
}
