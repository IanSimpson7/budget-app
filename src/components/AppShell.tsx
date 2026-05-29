import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

// App shell — header with "Budget" app name (DM Serif Display 28px), two nav
// links (Settings, Backup) with active border-b-2 border-accent indicator,
// then a centered main content slot. UI-SPEC §Page Header / App Shell verbatim.

type Props = { children: ReactNode }

const navItemBase =
  'inline-flex items-center min-h-[44px] px-sp-2 ' +
  'font-sans text-sm font-semibold ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function navClasses({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${navItemBase} text-text-primary border-b-2 border-accent`
    : `${navItemBase} text-text-secondary hover:text-text-primary border-b-2 border-transparent`
}

export default function AppShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <header className="bg-surface border-b border-surface-border px-sp-4 sm:px-sp-6 py-sp-3">
        <h1 className="font-display text-[28px] leading-[1.15] text-text-primary">Budget</h1>
        <nav className="flex gap-sp-6 mt-sp-2" aria-label="Primary">
          <NavLink to="/dashboard" className={navClasses}>
            Dashboard
          </NavLink>
          <NavLink to="/entry" className={navClasses}>
            Entry
          </NavLink>
          <NavLink to="/expenses" className={navClasses}>
            Expenses
          </NavLink>
          <NavLink to="/funds" className={navClasses}>
            Funds
          </NavLink>
          <NavLink to="/settings" className={navClasses}>
            Settings
          </NavLink>
          <NavLink to="/backup" className={navClasses}>
            Backup
          </NavLink>
        </nav>
      </header>
      <main className="px-sp-4 sm:px-sp-6 py-sp-6 max-w-[960px] mx-auto">{children}</main>
    </div>
  )
}
