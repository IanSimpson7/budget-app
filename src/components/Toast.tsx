import { useEffect } from 'react'

// Toast notification. UI-SPEC §Component Specifications — Toast.
// Auto-dismisses after 4000ms. Variant border color: success (#4a7c59),
// error (#a63228), default (#332d28). Position: bottom-center mobile,
// bottom-right desktop. No drop shadow.

export type ToastVariant = 'default' | 'success' | 'error'

type Props = {
  message: string
  variant?: ToastVariant
  onDismiss: () => void
}

export default function Toast({ message, variant = 'default', onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const border =
    variant === 'success'
      ? 'border-success'
      : variant === 'error'
        ? 'border-destructive'
        : 'border-surface-border'

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed z-50',
        'left-1/2 -translate-x-1/2 bottom-sp-4',
        'sm:left-auto sm:right-sp-4 sm:translate-x-0',
        'bg-surface-raised text-text-primary',
        'font-sans text-sm leading-[1.5]',
        'px-sp-4 py-sp-3 rounded-sm',
        'border',
        border,
        'transition-transform duration-200 ease-out translate-y-0',
      ].join(' ')}
    >
      {message}
    </div>
  )
}
