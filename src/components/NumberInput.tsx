import type { InputHTMLAttributes } from 'react'

// Reusable number input. UI-SPEC §Component Specifications — Input — Number Field.
// Sans-20px-semibold display per the typography note in UI-SPEC (IBM Plex Mono
// has no 600-weight; prominent financial value shifts to sans at 600 to honor
// the two-weight system).

type Props = {
  id: string
  label: string
  value: number
  onChange: (next: number) => void
  helper?: string | undefined
  error?: string | undefined
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>

export default function NumberInput({
  id,
  label,
  value,
  onChange,
  helper,
  error,
  className = '',
  ...rest
}: Props) {
  const inputBase =
    'bg-surface-raised text-text-primary ' +
    'font-sans text-[20px] font-semibold ' +
    'min-h-[44px] w-full sm:max-w-[320px] px-[12px] py-[10px] rounded-sm ' +
    'border border-surface-border ' +
    'placeholder:text-text-disabled placeholder:font-mono placeholder:text-base ' +
    'focus:outline-none focus:border-accent ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'transition-colors duration-150 ease-out'
  const errorClass = error ? 'border-destructive' : ''
  return (
    <div className={`flex flex-col gap-sp-2 ${className}`.trim()}>
      <label
        htmlFor={id}
        className="font-sans text-sm font-semibold leading-[1.4] text-text-primary"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputBase} ${errorClass}`.trim()}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={helper || error ? `${id}-help` : undefined}
        {...rest}
      />
      {(helper || error) && (
        <span
          id={`${id}-help`}
          className={
            error
              ? 'font-sans text-sm text-destructive leading-[1.5]'
              : 'font-sans text-sm text-text-secondary leading-[1.5]'
          }
        >
          {error ?? helper}
        </span>
      )}
    </div>
  )
}
