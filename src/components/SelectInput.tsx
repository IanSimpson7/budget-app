// SelectInput — styled <select> matching NumberInput tokens.
// UI-SPEC §Component Reuse Map: "bg-surface-raised ... match NumberInput border/bg/focus tokens".
// Props: id, label, value, onChange, options array.

type Option = { value: string; label: string }

type Props = {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  options: Option[]
}

export default function SelectInput({ id, label, value, onChange, options }: Props) {
  return (
    <div className="flex flex-col gap-sp-2">
      <label
        htmlFor={id}
        className="font-sans text-sm font-semibold leading-[1.4] text-text-primary"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          'bg-surface-raised text-text-primary font-sans text-sm ' +
          'border border-surface-border rounded-sm min-h-[44px] px-[12px] ' +
          'focus:outline-none focus:border-accent ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
          'transition-colors duration-150 ease-out'
        }
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
