import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Primary CTA. UI-SPEC §Component Specifications — Button — Primary verbatim.
// bg-accent, hover bg-accent-hover, min-h-[44px] tap target, focus-visible
// outline-2 outline-offset-2 outline-accent, disabled opacity-40.
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }

export default function PrimaryButton({ children, className = '', type = 'button', ...rest }: Props) {
  const base =
    'bg-accent hover:bg-accent-hover active:scale-[0.98] text-text-primary ' +
    'font-sans text-sm font-semibold ' +
    'min-h-[44px] px-[20px] py-[10px] rounded-sm ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'disabled:opacity-40 disabled:cursor-not-allowed ' +
    'transition-colors duration-150 ease-out'
  return (
    <button type={type} className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
