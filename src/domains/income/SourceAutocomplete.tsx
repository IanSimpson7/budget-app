// SourceAutocomplete — text input with dropdown of known-source strings.
// UI-SPEC §Known-source autocomplete: each item min-h-[44px], tokens only.
// On select, calls back with the matched KnownSource so the form auto-fills
// category + taxable.
import { useId, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { knownSourcesAtom } from './income.atoms'
import type { KnownSource } from './income.types'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  onSelect: (source: KnownSource) => void
  onBlur?: () => void
  error?: string | undefined
}

const inputBase =
  'bg-surface-raised border border-surface-border rounded-sm px-sp-3 py-sp-2 ' +
  'font-sans text-sm text-text-primary min-h-[44px] w-full ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'placeholder:text-text-disabled'

export default function SourceAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  onBlur,
  error,
}: Props) {
  // { delay: 0 } per PATTERNS §React-19 re-suspense prophylaxis (Pitfall 1).
  const knownSources = useAtomValue(knownSourcesAtom, { delay: 0 })
  const [open, setOpen] = useState(false)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter known sources by current typed value (case-insensitive prefix match)
  const filtered =
    value.length > 0
      ? knownSources.filter((ks) => ks.source.toLowerCase().includes(value.toLowerCase()))
      : knownSources

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setOpen(true)
  }

  const handleSelect = (ks: KnownSource) => {
    onChange(ks.source)
    onSelect(ks)
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay close so click on dropdown item registers first
    setTimeout(() => {
      setOpen(false)
      onBlur?.()
    }, 150)
    void e
  }

  const handleFocus = () => {
    if (knownSources.length > 0) setOpen(true)
  }

  const errorClass = error ? 'border-destructive' : ''

  return (
    <div className="flex flex-col gap-sp-2">
      <label
        htmlFor={id}
        className="font-sans text-xs font-semibold text-text-secondary"
      >
        Source
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={open && filtered.length > 0 ? listId : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`${inputBase} ${errorClass}`.trim()}
          placeholder="e.g. GLI EAST LANSING"
        />
        {open && filtered.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Known sources"
            className="absolute z-10 w-full mt-sp-1 bg-surface-raised border border-surface-border rounded-sm overflow-y-auto max-h-[220px]"
          >
            {filtered.map((ks) => (
              <li
                key={ks.source}
                role="option"
                aria-selected={value === ks.source}
                onMouseDown={() => handleSelect(ks)}
                className="min-h-[44px] px-sp-3 py-sp-2 font-sans text-sm text-text-primary hover:bg-surface-border cursor-pointer flex items-center"
              >
                {ks.source}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <span id={`${id}-err`} className="font-sans text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
