import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Destructive action. UI-SPEC verbatim — bg-destructive, hover bg-destructive-hover.
// Used ONLY for "Replace and import" confirmation in Phase 1 per UI-SPEC contract.
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }

export default function DestructiveButton({
  children,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const base =
    'bg-destructive hover:bg-destructive-hover text-text-primary ' +
    'font-sans text-sm font-semibold ' +
    'min-h-[44px] px-[20px] py-[10px] rounded-sm ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive ' +
    'disabled:opacity-40 disabled:cursor-not-allowed ' +
    'transition-colors duration-150 ease-out'
  return (
    <button type={type} className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
