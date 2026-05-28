import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Secondary action. UI-SPEC verbatim — transparent bg, border surface-border,
// hover border text-secondary, min-h-[44px], same metrics as PrimaryButton.
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }

export default function SecondaryButton({
  children,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const base =
    'bg-transparent text-text-primary ' +
    'font-sans text-sm font-semibold ' +
    'min-h-[44px] px-[20px] py-[10px] rounded-sm ' +
    'border border-surface-border hover:border-text-secondary active:bg-surface-raised ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'disabled:opacity-40 disabled:cursor-not-allowed ' +
    'transition-colors duration-150 ease-out'
  return (
    <button type={type} className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
