// ClassificationToggle — two-button mutually-exclusive PROTECTED / GATEABLE control.
// UI-SPEC §Surface 2 ClassificationToggle spec.
// ARIA: role="group" aria-label="Classification" on wrapper; aria-pressed on each button.
// No inline hex — token classes only.

import type { Classification } from '../storage/schema'

type Props = {
  value: Classification
  onChange: (next: Classification) => void
}

const activeClass =
  'bg-surface-raised border border-accent text-text-primary font-semibold ' +
  'font-sans text-sm min-h-[44px] px-[16px] py-[10px] rounded-sm ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'transition-colors duration-150 ease-out'

const inactiveClass =
  'bg-transparent border border-surface-border text-text-secondary ' +
  'font-sans text-sm min-h-[44px] px-[16px] py-[10px] rounded-sm ' +
  'hover:text-text-primary hover:border-accent ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'transition-colors duration-150 ease-out'

export default function ClassificationToggle({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Classification" className="flex flex-col gap-sp-2">
      <span className="font-sans text-sm font-semibold leading-[1.4] text-text-primary">
        Classification
      </span>
      <div className="flex gap-sp-2">
        <button
          type="button"
          aria-pressed={value === 'protected'}
          onClick={() => onChange('protected')}
          className={value === 'protected' ? activeClass : inactiveClass}
        >
          Protected
        </button>
        <button
          type="button"
          aria-pressed={value === 'gateable'}
          onClick={() => onChange('gateable')}
          className={value === 'gateable' ? activeClass : inactiveClass}
        >
          Gateable
        </button>
      </div>
    </div>
  )
}
